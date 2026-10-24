import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Sparkles,
  Database,
  ArrowRight,
  Edit2,
  Trash2,
  CheckCircle2,
  Check,
  PlusCircle,
  FileCheck2,
  Lock,
  Unlock,
  Eye,
  EyeOff,
  Clock,
  Sliders
} from 'lucide-react';
import { api } from '../services/api';
import { ParsedQuestionItem } from '../types';

export const AIGenerationPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [questions, setQuestions] = useState<ParsedQuestionItem[]>([]);
  const [context, setContext] = useState<{ subject: string; topic: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Blind mode to prevent question spoilers before attempt
  const [blindMode, setBlindMode] = useState<boolean>(true);
  
  // Custom attempt count
  const [attemptCount, setAttemptCount] = useState<number>(10);

  // Target quiz id if generating for an existing assessment
  const targetQuizId = searchParams.get('quiz_id') || sessionStorage.getItem('quizforge_generation_target_quiz_id');

  useEffect(() => {
    const raw = sessionStorage.getItem('quizforge_pending_questions');
    const ctx = sessionStorage.getItem('quizforge_generation_context');
    const savedCount = sessionStorage.getItem('quizforge_desired_question_count');
    if (raw) {
      try {
        const parsed = JSON.parse(raw);
        setQuestions(parsed);
        if (savedCount && !isNaN(parseInt(savedCount))) {
          setAttemptCount(Math.min(parseInt(savedCount), parsed.length));
        } else {
          setAttemptCount(parsed.length);
        }
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
      <div className="p-12 text-center rounded-2xl bg-card border border-border space-y-4 max-w-2xl mx-auto my-8">
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
    setError(null);
    try {
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
      await handleCreateQuizDirectly(false);
    } catch (err: any) {
      setError(err.message || 'Failed to save questions to bank.');
    } finally {
      setSaving(false);
    }
  };

  const handleStartAssessment = async () => {
    setSaving(true);
    setError(null);
    try {
      if (targetQuizId) {
        // Attach questions to the existing quiz, NEVER create a duplicate
        await api.saveGeneratedToBank({
          quiz_id: Number(targetQuizId),
          questions: questions.filter(q => q.is_approved)
        });
        sessionStorage.removeItem('quizforge_pending_questions');
        sessionStorage.removeItem('quizforge_generation_target_quiz_id');
        navigate(`/assessments/${targetQuizId}/instructions`);
        return;
      }

      // No existing quiz -> create new assessment and navigate to pre-assessment
      await handleCreateQuizDirectly(true);
    } catch (err: any) {
      setError(err.message || 'Failed to start assessment.');
    } finally {
      setSaving(false);
    }
  };

  const handleCreateQuizDirectly = async (proceedToAttempt: boolean) => {
    const title = context ? `${context.topic} Assessment` : 'AI Generated Assessment';
    const distinctSections = Array.from(new Set(questions.map(q => q.section_name || 'General'))).map(s => ({ name: s, description: '' }));
    
    // Check if a desired duration or count was set in session
    const savedCount = sessionStorage.getItem('quizforge_desired_question_count');
    const countToPresent = savedCount && !isNaN(parseInt(savedCount)) ? parseInt(savedCount) : attemptCount;

    const newQuiz = await api.createQuiz({
      title,
      description: `Generated using Google Gemini covering ${context?.subject ?? ''} - ${context?.topic ?? ''}.`,
      mode: 'exam',
      timing_mode: 'total_duration',
      duration_minutes: 15,
      question_count_to_present: countToPresent > 0 ? countToPresent : null,
      sections: distinctSections
    });

    await api.saveGeneratedToBank({
      quiz_id: newQuiz.id,
      questions: questions.filter(q => q.is_approved)
    });
    
    sessionStorage.removeItem('quizforge_pending_questions');
    sessionStorage.removeItem('quizforge_generation_target_quiz_id');
    
    if (proceedToAttempt) {
      navigate(`/assessments/${newQuiz.id}/instructions`);
    } else {
      navigate(`/assessments/${newQuiz.id}/bank`);
    }
  };

  return (
    <div className="space-y-6 animate-fadeIn pb-16 max-w-5xl mx-auto px-2 sm:px-4">
      {/* Top Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 sm:p-6 rounded-2xl bg-card border border-border shadow-sm">
        <div>
          <span className="text-xs font-semibold uppercase text-primary tracking-wider flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5" />
            Gemini Generated Question Set
          </span>
          <h2 className="text-xl font-bold text-foreground mt-0.5">
            {context ? `${context.subject} • ${context.topic}` : 'AI Question Batch'}
          </h2>
          <p className="text-xs text-muted-foreground mt-1">
            {targetQuizId ? (
              <span className="text-emerald-600 dark:text-emerald-400 font-semibold">
                ✓ Linking to Assessment #{targetQuizId}. Questions will attach directly without duplicating.
              </span>
            ) : (
              'Review items, manage visibility to avoid spoilers, and save or attempt your assessment.'
            )}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          <button
            onClick={handleSaveToBank}
            disabled={saving || approvedCount === 0}
            className="flex-1 sm:flex-none inline-flex items-center justify-center space-x-2 px-4 py-2.5 rounded-xl text-xs font-semibold bg-secondary hover:bg-muted text-secondary-foreground border border-border shadow-xs transition-all"
          >
            <Database className="w-3.5 h-3.5" />
            <span>{targetQuizId ? 'Save to Assessment' : 'Save to Bank'} ({approvedCount})</span>
          </button>

          <button
            onClick={handleStartAssessment}
            disabled={saving || approvedCount === 0}
            className="flex-1 sm:flex-none inline-flex items-center justify-center space-x-2 px-5 py-2.5 rounded-xl text-xs font-semibold bg-primary hover:bg-primary-hover disabled:opacity-50 text-primary-foreground shadow-sm transition-all font-bold"
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

      {/* Blind Assessment Mode Controls */}
      <div className="p-4 sm:p-5 rounded-2xl bg-primary/5 border border-primary/20 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            {blindMode ? (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 text-xs font-bold">
                <Lock className="w-3.5 h-3.5" />
                Blind Assessment Mode Active
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 text-xs font-bold">
                <Eye className="w-3.5 h-3.5" />
                Review & Edit Mode Active
              </span>
            )}
          </div>
          <p className="text-xs text-muted-foreground leading-relaxed">
            {blindMode
              ? 'Questions and answer keys are locked so you can take this test honestly without spoiler bias.'
              : 'All question statements, options, and answer keys are visible for authoring and inspection.'}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Question count selector */}
          <div className="flex items-center gap-1.5 bg-background p-1.5 rounded-xl border border-border">
            <span className="text-[11px] font-semibold text-muted-foreground px-2">Attempt:</span>
            {[5, 10, questions.length].map(cnt => (
              <button
                key={cnt}
                type="button"
                onClick={() => setAttemptCount(cnt)}
                className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all ${
                  attemptCount === cnt
                    ? 'bg-primary text-primary-foreground font-bold shadow-xs'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {cnt === questions.length ? `All (${cnt})` : `${cnt} Qs`}
              </button>
            ))}
          </div>

          {/* Toggle Blind Mode */}
          <button
            type="button"
            onClick={() => setBlindMode(!blindMode)}
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold bg-background border border-border hover:border-primary/50 text-foreground transition-all shadow-xs"
          >
            {blindMode ? (
              <>
                <Unlock className="w-3.5 h-3.5 text-primary" />
                <span>Unlock / Reveal Questions</span>
              </>
            ) : (
              <>
                <Lock className="w-3.5 h-3.5 text-amber-500" />
                <span>Lock Questions (Blind Mode)</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Questions List */}
      <div className="space-y-4">
        {questions.map((q, idx) => (
          <div
            key={q.temp_id}
            className={`p-5 sm:p-6 rounded-2xl bg-card border transition-all ${
              q.is_approved ? 'border-border hover:border-primary/40' : 'opacity-60 border-border bg-muted/20'
            }`}
          >
            <div className="flex items-start justify-between gap-3 sm:gap-4">
              <div className="flex flex-wrap items-center gap-2">
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
                  <span className="text-[11px] text-muted-foreground italic truncate max-w-[200px]">
                    ({q.source_ref})
                  </span>
                )}
              </div>

              <div className="flex items-center gap-1.5 shrink-0">
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

            {blindMode ? (
              <div className="mt-4 p-4 rounded-xl bg-muted/30 border border-border/80 flex items-center justify-between gap-3 text-xs">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Lock className="w-4 h-4 text-amber-500 shrink-0" />
                  <span>
                    <strong>Question Statement & Answer Key Locked</strong> — Preserved to test your knowledge without spoilers.
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setBlindMode(false)}
                  className="text-primary hover:underline font-semibold shrink-0"
                >
                  Inspect
                </button>
              </div>
            ) : (
              <>
                <p className="text-sm font-medium text-foreground mt-3 leading-relaxed break-words">
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
                          className={`p-3 rounded-xl border text-xs flex items-center gap-3 transition-colors min-w-0 ${
                            isTarget
                              ? 'border-emerald-500/50 bg-emerald-50/5 text-foreground font-semibold'
                              : 'border-border bg-background/50 text-muted-foreground'
                          }`}
                        >
                          <span className={`w-5 h-5 rounded-full flex items-center justify-center font-bold text-[10px] shrink-0 ${
                            isTarget ? 'bg-emerald-500 text-white' : 'bg-muted text-muted-foreground'
                          }`}>
                            {opt.id}
                          </span>
                          <span className="flex-1 break-words">{opt.text}</span>
                          {isTarget && <Check className="w-3.5 h-3.5 text-emerald-500 shrink-0" />}
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Match the Following Preview */}
                {q.question_type === 'match_the_following' && q.metadata_extra?.match_targets && (
                  <div className="mt-3 p-3 rounded-xl bg-muted/20 border border-border text-xs space-y-1.5">
                    <span className="font-bold text-muted-foreground">Match Targets:</span>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {q.metadata_extra.match_targets.map((tgt: any) => (
                        <div key={tgt.id} className="p-2 rounded-lg bg-background border border-border flex items-center gap-2">
                          <span className="w-5 h-5 rounded bg-indigo-500/10 text-indigo-500 font-mono font-bold text-center text-[10px] flex items-center justify-center">
                            {tgt.id}
                          </span>
                          <span className="truncate">{tgt.text}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Explanation & Answer Key */}
                <div className="mt-4 pt-4 border-t border-border flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-foreground">Answer Key:</span>
                    <span className="px-2 py-0.5 rounded bg-primary/10 text-primary font-mono font-semibold">
                      {q.question_type === 'true_false'
                        ? (Array.isArray(q.correct_answer) ? q.correct_answer[0] : q.correct_answer) === 'TRUE' ? 'True' : 'False'
                        : Array.isArray(q.correct_answer)
                        ? q.correct_answer.join(', ')
                        : typeof q.correct_answer === 'object' && q.correct_answer !== null
                        ? JSON.stringify(q.correct_answer)
                        : String(q.correct_answer)}
                    </span>
                  </div>
                  {q.explanation && (
                    <div className="text-muted-foreground max-w-lg break-words">
                      <span className="font-semibold text-foreground">Explanation:</span> {q.explanation}
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};
