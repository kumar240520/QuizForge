import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  CheckCircle2,
  AlertTriangle,
  Trash2,
  Edit2,
  Save,
  ArrowRight,
  Database,
  Layers,
  Check,
  X
} from 'lucide-react';
import { api } from '../services/api';
import { ImportJob, ParsedQuestionItem, QuestionOption } from '../types';
import { sanitizeText } from '../utils/textSanitizer';

export const ImportReviewPage: React.FC = () => {
  const { jobId } = useParams<{ jobId: string }>();
  const navigate = useNavigate();

  const [job, setJob] = useState<ImportJob | null>(null);
  const [questions, setQuestions] = useState<ParsedQuestionItem[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [targetQuizId] = useState<string | null>(sessionStorage.getItem('quizforge_import_target_quiz_id'));
  const [targetSection, setTargetSection] = useState<string>(sessionStorage.getItem('quizforge_import_target_section') || '');
  const [existingSections, setExistingSections] = useState<string[]>([]);

  useEffect(() => {
    if (jobId) {
      api.getImportJob(parseInt(jobId))
        .then(j => {
          setJob(j);
          const initialSec = sessionStorage.getItem('quizforge_import_target_section');
          if (initialSec) {
            setQuestions(j.parsed_questions.map(q => ({ ...q, section_name: initialSec })));
          } else {
            setQuestions(j.parsed_questions);
          }
        })
        .catch(err => setError(err.message || 'Failed to load import job.'))
        .finally(() => setLoading(false));
    }
  }, [jobId]);

  useEffect(() => {
    if (targetQuizId) {
      api.getQuiz(Number(targetQuizId))
        .then(q => {
          const secs = (q.sections || []).map(s => s.name).filter(Boolean);
          setExistingSections(secs);
          if (!targetSection && secs.length > 0) {
            setTargetSection(secs[0]);
          }
        })
        .catch(() => {});
    }
  }, [targetQuizId]);

  const handleApplySectionToAll = () => {
    if (!targetSection.trim()) return;
    setQuestions(prev => prev.map(q => ({ ...q, section_name: targetSection.trim() })));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (error || !job) {
    return (
      <div className="p-8 text-center rounded-2xl bg-card border border-destructive/20 text-destructive">
        <p>{error || 'Job not found.'}</p>
        <button
          onClick={() => navigate('/imports')}
          className="mt-4 px-4 py-2 rounded-xl text-xs font-semibold bg-primary text-primary-foreground"
        >
          Return to Imports
        </button>
      </div>
    );
  }

  const validCount = questions.filter(q => q.status === 'valid').length;
  const issueCount = questions.filter(q => q.status !== 'valid').length;
  const approvedCount = questions.filter(q => q.is_approved).length;

  const toggleApprove = (tempId: string) => {
    setQuestions(questions.map(q => q.temp_id === tempId ? { ...q, is_approved: !q.is_approved } : q));
  };

  const removeQuestion = (tempId: string) => {
    setQuestions(questions.filter(q => q.temp_id !== tempId));
  };

  const updateQuestionField = (tempId: string, field: keyof ParsedQuestionItem, value: any) => {
    setQuestions(questions.map(q => {
      if (q.temp_id === tempId) {
        const updated = { ...q, [field]: value };
        // If question text and answer are now present, clear missing_answer status
        if (field === 'correct_answer' && value && q.status === 'missing_answer') {
          updated.status = 'valid';
          updated.issues = [];
          updated.is_approved = true;
        }
        return updated;
      }
      return q;
    }));
  };

  const updateOptionText = (tempId: string, optId: string, text: string) => {
    setQuestions(questions.map(q => {
      if (q.temp_id === tempId) {
        const newOpts = q.options.map(opt => opt.id === optId ? { ...opt, text } : opt);
        return { ...q, options: newOpts };
      }
      return q;
    }));
  };

  const handleApproveAll = async () => {
    setSaving(true);
    try {
      const finalSec = targetSection.trim();
      await api.approveImportJob(job.id, {
        quiz_id: targetQuizId ? Number(targetQuizId) : undefined,
        target_section: finalSec || undefined,
        questions: questions.filter(q => q.is_approved).map(q => ({
          ...q,
          section_name: finalSec || q.section_name || 'General'
        }))
      });
      sessionStorage.removeItem('quizforge_import_target_quiz_id');
      sessionStorage.removeItem('quizforge_import_target_section');
      if (targetQuizId) {
        navigate(`/assessments/${targetQuizId}/bank`);
      } else {
        navigate('/assessments');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to approve questions.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6 animate-fadeIn pb-16">
      {/* Top Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-6 rounded-2xl bg-card border border-border shadow-sm">
        <div>
          <span className="text-xs font-semibold uppercase text-primary tracking-wider">
            Import Review • {job.source_type.toUpperCase()}
          </span>
          <h2 className="text-xl font-bold text-foreground mt-0.5">
            {job.filename || 'Extracted Question Set'}
          </h2>
          <div className="flex items-center gap-4 text-xs text-muted-foreground mt-2">
            <span>Total: <strong>{questions.length}</strong></span>
            <span>•</span>
            <span className="text-emerald-500 font-semibold">Valid: {validCount}</span>
            <span>•</span>
            <span className={issueCount > 0 ? 'text-amber-500 font-semibold' : ''}>
              Needs Review: {issueCount}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setQuestions(questions.map(q => ({ ...q, is_approved: true })))}
            className="px-3.5 py-2 rounded-xl text-xs font-medium border border-border hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
          >
            Select All
          </button>
          <button
            onClick={handleApproveAll}
            disabled={saving || approvedCount === 0}
            className="inline-flex items-center space-x-2 px-5 py-2.5 rounded-xl text-xs font-semibold bg-primary hover:bg-primary-hover disabled:opacity-50 text-primary-foreground shadow-sm transition-all"
          >
            {saving ? (
              <span>Saving...</span>
            ) : (
              <>
                <Database className="w-3.5 h-3.5" />
                <span>Approve & Save to Bank ({approvedCount})</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </>
            )}
          </button>
        </div>
      </div>

      {/* Target Section Routing Card */}
      <div className="p-4 rounded-2xl bg-card border border-border shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
            <Layers className="w-5 h-5" />
          </div>
          <div>
            <h4 className="text-xs font-bold text-foreground">Target Assessment Section</h4>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              Specify which section these questions should be stored into. Prevents unwanted auto-created sections like "Section 1" or "Section 3".
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {existingSections.length > 0 && (
            <select
              value={existingSections.includes(targetSection) ? targetSection : ''}
              onChange={e => {
                if (e.target.value) setTargetSection(e.target.value);
              }}
              className="px-3 py-1.5 rounded-xl bg-background border border-input text-foreground text-xs font-medium focus:ring-2 focus:ring-primary/40 cursor-pointer"
            >
              <option value="" disabled>Select existing section...</option>
              {existingSections.map(s => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          )}

          <input
            type="text"
            value={targetSection}
            onChange={e => setTargetSection(e.target.value)}
            placeholder="e.g. apptitude, Reasoning, Section A"
            className="px-3 py-1.5 rounded-xl bg-background border border-input text-foreground text-xs font-medium focus:ring-2 focus:ring-primary/40 w-44"
          />

          <button
            type="button"
            onClick={handleApplySectionToAll}
            className="px-3 py-1.5 rounded-xl bg-muted hover:bg-muted/80 text-foreground text-xs font-semibold transition-colors cursor-pointer"
            title="Update all questions below to this section"
          >
            Apply to All Questions
          </button>
        </div>
      </div>

      {/* Questions Review List */}
      <div className="space-y-4">
        {questions.map((q, idx) => {
          const isEditing = editingId === q.temp_id;
          const hasIssues = q.issues && q.issues.length > 0;

          return (
            <div
              key={q.temp_id}
              className={`p-6 rounded-2xl bg-card border transition-all ${
                !q.is_approved
                  ? 'opacity-60 border-border bg-muted/20'
                  : hasIssues
                  ? 'border-amber-500/40 ring-1 ring-amber-500/10'
                  : 'border-border hover:border-primary/40'
              }`}
            >
              {/* Question Header */}
              <div className="flex items-start justify-between gap-4">
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
                  <div className="flex items-center gap-1.5 ml-1 pl-2 border-l border-border">
                    <span className="text-[10px] text-muted-foreground font-semibold">Section:</span>
                    <input
                      type="text"
                      value={q.section_name || ''}
                      onChange={e => updateQuestionField(q.temp_id, 'section_name', e.target.value)}
                      placeholder="General"
                      className="px-2 py-0.5 rounded-md bg-muted/60 border border-input text-foreground text-[11px] font-semibold w-28 focus:w-40 transition-all"
                    />
                  </div>
                  {q.source_ref && (
                    <span className="text-[11px] text-muted-foreground italic">
                      ({q.source_ref})
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setEditingId(isEditing ? null : q.temp_id)}
                    className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted"
                    title={isEditing ? 'Done editing' : 'Edit question'}
                  >
                    {isEditing ? <Check className="w-4 h-4 text-emerald-500" /> : <Edit2 className="w-4 h-4" />}
                  </button>
                  <button
                    onClick={() => toggleApprove(q.temp_id)}
                    className={`p-1.5 rounded-lg transition-colors ${
                      q.is_approved
                        ? 'text-emerald-500 hover:bg-emerald-500/10'
                        : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                    }`}
                    title={q.is_approved ? 'Approved for import' : 'Click to approve'}
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

              {/* Issues Banner */}
              {hasIssues && (
                <div className="mt-3 p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-400 text-xs flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                  <span>{q.issues.join(' • ')}. Please verify the answer key below.</span>
                </div>
              )}

              {/* Question Statement */}
              <div className="mt-4">
                {isEditing ? (
                  <textarea
                    rows={2}
                    value={q.question_text}
                    onChange={e => updateQuestionField(q.temp_id, 'question_text', e.target.value)}
                    className="w-full p-3 rounded-lg bg-background border border-input text-foreground text-sm font-medium focus:ring-2 focus:ring-primary/40"
                  />
                ) : (
                  <p className="text-sm font-medium text-foreground leading-relaxed whitespace-pre-wrap">
                    {sanitizeText(q.question_text)}
                  </p>
                )}
              </div>

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
                        onClick={() => {
                          if (isEditing) {
                            updateQuestionField(q.temp_id, 'correct_answer', [opt.id]);
                          }
                        }}
                        className={`p-3 rounded-xl border text-xs flex items-center gap-3 transition-colors ${
                          isTarget
                            ? 'border-emerald-500/50 bg-emerald-500/5 text-foreground font-semibold'
                            : 'border-border bg-background/50 text-muted-foreground'
                        } ${isEditing ? 'cursor-pointer hover:border-primary/50' : ''}`}
                      >
                        <span className={`w-5 h-5 rounded-full flex items-center justify-center font-bold text-[10px] ${
                          isTarget ? 'bg-emerald-500 text-white' : 'bg-muted text-muted-foreground'
                        }`}>
                          {opt.id}
                        </span>
                        {isEditing ? (
                          <input
                            type="text"
                            value={opt.text}
                            onChange={e => updateOptionText(q.temp_id, opt.id, e.target.value)}
                            className="flex-1 bg-transparent border-b border-border text-foreground text-xs focus:outline-none"
                          />
                        ) : (
                          <span className="flex-1">{sanitizeText(opt.text)}</span>
                        )}
                        {isTarget && <Check className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0" />}
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Answer Key & Explanation */}
              <div className="mt-4 pt-4 border-t border-border flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-foreground">Answer Key:</span>
                  {isEditing ? (
                    <input
                      type="text"
                      value={Array.isArray(q.correct_answer) ? q.correct_answer.join(', ') : String(q.correct_answer || '')}
                      onChange={e => updateQuestionField(q.temp_id, 'correct_answer', [e.target.value.trim().toUpperCase()])}
                      className="px-2 py-1 rounded bg-background border border-input text-foreground text-xs font-mono w-24"
                    />
                  ) : (
                    <span className="px-2 py-0.5 rounded bg-primary/10 text-primary font-mono font-semibold">
                      {Array.isArray(q.correct_answer) ? q.correct_answer.join(', ') : String(q.correct_answer || 'N/A')}
                    </span>
                  )}
                </div>

                {q.explanation && (
                  <div className="text-muted-foreground truncate max-w-md">
                    <span className="font-semibold">Reason:</span> {q.explanation}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
