import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Sparkles,
  Database,
  ArrowRight,
  Edit2,
  Trash2,
  CheckCircle2,
  Check,
  PlusCircle,
  FileCheck2
} from 'lucide-react';
import { api } from '../services/api';
import { ParsedQuestionItem } from '../types';

export const AIGenerationPage: React.FC = () => {
  const navigate = useNavigate();
  const [questions, setQuestions] = useState<ParsedQuestionItem[]>([]);
  const [context, setContext] = useState<{ subject: string; topic: string } | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const raw = sessionStorage.getItem('quizforge_pending_questions');
    const ctx = sessionStorage.getItem('quizforge_generation_context');
    if (raw) {
      try {
        setQuestions(JSON.parse(raw));
      } catch {
        // ignore
      }
    }
    if (ctx) {
      try {
        setContext(JSON.parse(ctx));
      } catch {
        // ignore
      }
    }
  }, []);

  if (questions.length === 0) {
    return (
      <div className="p-12 text-center rounded-2xl bg-card border border-border space-y-4">
        <Sparkles className="w-12 h-12 mx-auto text-primary" />
        <h3 className="text-base font-semibold text-foreground">No Generated Questions Found</h3>
        <p className="text-xs text-muted-foreground max-w-sm mx-auto">
          Start a new AI generation run to formulate assessment questions tailored to your topic.
        </p>
        <button
          onClick={() => navigate('/create-assessment?tab=ai')}
          className="px-4 py-2 rounded-xl text-xs font-semibold bg-primary text-primary-foreground hover:bg-primary-hover"
        >
          Open AI Generator
        </button>
      </div>
    );
  }

  const approvedCount = questions.filter(q => q.is_approved).length;

  const toggleApprove = (tempId: string) => {
    setQuestions(questions.map(q => q.temp_id === tempId ? { ...q, is_approved: !q.is_approved } : q));
  };

  const removeQuestion = (tempId: string) => {
    setQuestions(questions.filter(q => q.temp_id !== tempId));
  };

  const handleSaveToBank = async () => {
    setSaving(true);
    try {
      const targetQuizId = sessionStorage.getItem('quizforge_generation_target_quiz_id');
      if (targetQuizId) {
        await api.saveGeneratedToBank({
          quiz_id: Number(targetQuizId),
          questions: questions.filter(q => q.is_approved)
        });
        sessionStorage.removeItem('quizforge_pending_questions');
        sessionStorage.removeItem('quizforge_generation_target_quiz_id');
        navigate(`/assessments/${targetQuizId}/bank`);
        return;
      }
      
      // If no quiz pre-selected, create assessment directly
      await handleCreateQuizDirectly();
    } catch (err: any) {
      setError(err.message || 'Failed to save questions to bank.');
    } finally {
      setSaving(false);
    }
  };

  const handleCreateQuizDirectly = async () => {
    setSaving(true);
    try {
      const title = context ? `${context.topic} Assessment` : 'AI Generated Assessment';
      const distinctSections = Array.from(new Set(questions.map(q => q.section_name || 'General'))).map(s => ({ name: s, description: '' }));
      
      const newQuiz = await api.createQuiz({
        title,
        description: `Generated using Google Gemini covering ${context?.subject ?? ''} - ${context?.topic ?? ''}.`,
        mode: 'exam',
        timing_mode: 'total_duration',
        duration_minutes: 20,
        sections: distinctSections
      });

      await api.saveGeneratedToBank({
        quiz_id: newQuiz.id,
        questions: questions.filter(q => q.is_approved)
      });
      
      sessionStorage.removeItem('quizforge_pending_questions');
      sessionStorage.removeItem('quizforge_generation_target_quiz_id');
      navigate(`/assessments/${newQuiz.id}/bank`);
    } catch (err: any) {
      setError(err.message || 'Failed to build assessment.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6 animate-fadeIn pb-16">
      {/* Top Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-6 rounded-2xl bg-card border border-border shadow-sm">
        <div>
          <span className="text-xs font-semibold uppercase text-primary tracking-wider flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5" />
            Gemini Generated Question Set
          </span>
          <h2 className="text-xl font-bold text-foreground mt-0.5">
            {context ? `${context.subject} • ${context.topic}` : 'AI Question Batch'}
          </h2>
          <p className="text-xs text-muted-foreground mt-1">
            Review the generated items, verify the answer keys, and save to your question bank or start a quiz immediately.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleSaveToBank}
            disabled={saving || approvedCount === 0}
            className="inline-flex items-center space-x-2 px-4 py-2.5 rounded-xl text-xs font-semibold bg-secondary hover:bg-muted text-secondary-foreground border border-border shadow-sm transition-all"
          >
            <Database className="w-3.5 h-3.5" />
            <span>Save to Bank ({approvedCount})</span>
          </button>

          <button
            onClick={handleCreateQuizDirectly}
            disabled={saving || approvedCount === 0}
            className="inline-flex items-center space-x-2 px-4 py-2.5 rounded-xl text-xs font-semibold bg-primary hover:bg-primary-hover disabled:opacity-50 text-primary-foreground shadow-sm transition-all"
          >
            <FileCheck2 className="w-3.5 h-3.5" />
            <span>Start Assessment Now</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-xs">
          {error}
        </div>
      )}

      {/* Questions List */}
      <div className="space-y-4">
        {questions.map((q, idx) => (
          <div
            key={q.temp_id}
            className={`p-6 rounded-2xl bg-card border transition-all ${
              q.is_approved ? 'border-border hover:border-primary/40' : 'opacity-60 border-border bg-muted/20'
            }`}
          >
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-2">
                <span className="flex items-center justify-center w-6 h-6 rounded-lg bg-primary/10 text-primary text-xs font-bold font-mono">
                  {idx + 1}
                </span>
                <span className="px-2 py-0.5 rounded text-[10px] font-semibold uppercase bg-muted text-muted-foreground">
                  {q.question_type.replace(/_/g, ' ')}
                </span>
                <span className="px-2 py-0.5 rounded text-[10px] font-semibold uppercase bg-muted text-muted-foreground">
                  {q.difficulty}
                </span>
                {q.source_ref && (
                  <span className="text-[11px] text-muted-foreground italic">
                    ({q.source_ref})
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => toggleApprove(q.temp_id)}
                  className={`p-1.5 rounded-lg transition-colors ${
                    q.is_approved
                      ? 'text-emerald-500 hover:bg-emerald-500/10'
                      : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                  }`}
                  title={q.is_approved ? 'Approved' : 'Click to approve'}
                >
                  <CheckCircle2 className="w-4 h-4" />
                </button>
                <button
                  onClick={() => removeQuestion(q.temp_id)}
                  className="p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                  title="Remove question"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>

            <p className="text-sm font-medium text-foreground mt-3 leading-relaxed">
              {q.question_text}
            </p>

            {/* Options */}
            {q.options && q.options.length > 0 && (
              <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-2">
                {q.options.map(opt => {
                  const isTarget = Array.isArray(q.correct_answer)
                    ? q.correct_answer.includes(opt.id)
                    : String(q.correct_answer) === opt.id;

                  return (
                    <div
                      key={opt.id}
                      className={`p-3 rounded-xl border text-xs flex items-center gap-3 transition-colors ${
                        isTarget
                          ? 'border-emerald-500/50 bg-emerald-500/5 text-foreground font-semibold'
                          : 'border-border bg-background/50 text-muted-foreground'
                      }`}
                    >
                      <span className={`w-5 h-5 rounded-full flex items-center justify-center font-bold text-[10px] ${
                        isTarget ? 'bg-emerald-500 text-white' : 'bg-muted text-muted-foreground'
                      }`}>
                        {opt.id}
                      </span>
                      <span className="flex-1">{opt.text}</span>
                      {isTarget && <Check className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0" />}
                    </div>
                  );
                })}
              </div>
            )}

            {/* Explanation & Answer Key */}
            <div className="mt-4 pt-4 border-t border-border flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-foreground">Answer Key:</span>
                <span className="px-2 py-0.5 rounded bg-primary/10 text-primary font-mono font-semibold">
                  {Array.isArray(q.correct_answer) ? q.correct_answer.join(', ') : String(q.correct_answer)}
                </span>
              </div>
              {q.explanation && (
                <div className="text-muted-foreground max-w-lg">
                  <span className="font-semibold text-foreground">Explanation:</span> {q.explanation}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
