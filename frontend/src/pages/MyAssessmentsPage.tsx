import React, { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  FileCheck2,
  Plus,
  Play,
  Settings,
  Trash2,
  Clock,
  Sparkles,
  Award,
  Layers,
  Edit2,
  Sliders,
  X,
  CheckCircle2,
  AlertCircle,
  ExternalLink
} from 'lucide-react';
import { api } from '../services/api';
import { Quiz } from '../types';

export const MyAssessmentsPage: React.FC = () => {
  const navigate = useNavigate();
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [loading, setLoading] = useState(true);

  // Quick Edit Modal State
  const [editingQuiz, setEditingQuiz] = useState<Quiz | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editMode, setEditMode] = useState<'practice' | 'exam' | 'revision'>('exam');
  const [editTimingMode, setEditTimingMode] = useState<'total_duration' | 'per_question' | 'both' | 'untimed'>('total_duration');
  const [editDurationMinutes, setEditDurationMinutes] = useState<number | ''>(30);
  const [editPerQuestionSeconds, setEditPerQuestionSeconds] = useState<number | ''>(60);
  const [editPositiveMarks, setEditPositiveMarks] = useState<number | ''>(1.0);
  const [editNegativeMarks, setEditNegativeMarks] = useState<number | ''>(0.0);
  const [editPartialCredit, setEditPartialCredit] = useState(true);
  const [editAllowSkip, setEditAllowSkip] = useState(true);
  const [editAllowBackNav, setEditAllowBackNav] = useState(true);
  const [editAllowChangeAnswer, setEditAllowChangeAnswer] = useState(true);
  const [editImmediateFeedback, setEditImmediateFeedback] = useState(false);
  const [editShowExplanation, setEditShowExplanation] = useState(true);
  const [editRandomizeQuestions, setEditRandomizeQuestions] = useState(false);
  const [editRandomizeOptions, setEditRandomizeOptions] = useState(false);
  const [editQuestionCountToPresent, setEditQuestionCountToPresent] = useState<number | ''>('');

  const [savingQuiz, setSavingQuiz] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  const [successToast, setSuccessToast] = useState<string | null>(null);

  const loadQuizzes = () => {
    setLoading(true);
    api.getQuizzes()
      .then(setQuizzes)
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadQuizzes();
  }, []);

  const openEditModal = (quiz: Quiz) => {
    setEditingQuiz(quiz);
    setEditTitle(quiz.title || '');
    setEditDescription(quiz.description || '');
    setEditMode((quiz.mode as any) || 'exam');
    setEditTimingMode((quiz.timing_mode as any) || 'total_duration');
    setEditDurationMinutes(quiz.duration_minutes || 30);
    setEditPerQuestionSeconds(quiz.per_question_seconds || 60);
    setEditPositiveMarks(quiz.positive_marks ?? 1.0);
    setEditNegativeMarks(quiz.negative_marks ?? 0.0);
    setEditPartialCredit(quiz.partial_credit ?? true);
    setEditAllowSkip(quiz.allow_skip ?? true);
    setEditAllowBackNav(quiz.allow_back_nav ?? true);
    setEditAllowChangeAnswer(quiz.allow_change_answer ?? true);
    setEditImmediateFeedback(quiz.immediate_feedback ?? false);
    setEditShowExplanation(quiz.show_explanation ?? true);
    setEditRandomizeQuestions(quiz.randomize_questions ?? false);
    setEditRandomizeOptions(quiz.randomize_options ?? false);
    setEditQuestionCountToPresent(quiz.question_count_to_present ?? '');
    setEditError(null);
  };

  const handleSaveQuiz = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!editingQuiz) return;
    if (!editTitle.trim()) {
      setEditError('Assessment title is required.');
      return;
    }

    setSavingQuiz(true);
    setEditError(null);
    const finalDuration = typeof editDurationMinutes === 'number' && editDurationMinutes > 0 ? editDurationMinutes : 30;
    const finalPerQuestion = typeof editPerQuestionSeconds === 'number' && editPerQuestionSeconds > 0 ? editPerQuestionSeconds : 60;
    const finalPositive = typeof editPositiveMarks === 'number' && editPositiveMarks >= 0 ? editPositiveMarks : 1.0;
    const finalNegative = typeof editNegativeMarks === 'number' && editNegativeMarks >= 0 ? editNegativeMarks : 0.0;
    const finalCountToPresent = typeof editQuestionCountToPresent === 'number' && editQuestionCountToPresent > 0 ? editQuestionCountToPresent : null;

    try {
      const payload = {
        title: editTitle.trim(),
        description: editDescription.trim(),
        mode: editMode,
        timing_mode: editTimingMode,
        duration_minutes: ['total_duration', 'both'].includes(editTimingMode) ? finalDuration : null,
        per_question_seconds: ['per_question', 'both'].includes(editTimingMode) ? finalPerQuestion : null,
        positive_marks: finalPositive,
        negative_marks: finalNegative,
        partial_credit: editPartialCredit,
        allow_skip: editAllowSkip,
        allow_back_nav: editAllowBackNav,
        allow_change_answer: editAllowChangeAnswer,
        immediate_feedback: editMode === 'practice' ? editImmediateFeedback : false,
        show_explanation: editShowExplanation,
        randomize_questions: editRandomizeQuestions,
        randomize_options: editRandomizeOptions,
        question_count_to_present: finalCountToPresent,
      };

      const updated = await api.updateQuiz(editingQuiz.id, payload);
      setQuizzes(prev => prev.map(q => q.id === editingQuiz.id ? { ...q, ...updated } : q));
      setEditingQuiz(null);
      setSuccessToast(`"${updated.title}" updated successfully!`);
      setTimeout(() => setSuccessToast(null), 3000);
    } catch (err: any) {
      setEditError(err.message || 'Failed to update assessment.');
    } finally {
      setSavingQuiz(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (window.confirm('Are you sure you want to delete this assessment?')) {
      await api.deleteQuiz(id);
      setQuizzes(quizzes.filter(q => q.id !== id));
      setSuccessToast('Assessment deleted.');
      setTimeout(() => setSuccessToast(null), 3000);
    }
  };

  return (
    <div className="space-y-6 animate-fadeIn pb-16">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-foreground">
            My Assessments
          </h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            Configured exams, practice tests, and revision sessions ready for execution.
          </p>
        </div>

        <Link
          to="/builder"
          className="inline-flex items-center space-x-2 px-4 py-2 rounded-xl text-xs font-semibold bg-primary hover:bg-primary-hover text-primary-foreground shadow-sm transition-all"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>New Assessment</span>
        </Link>
      </div>

      {loading ? (
        <div className="flex items-center justify-center min-h-[300px]">
          <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      ) : quizzes.length === 0 ? (
        <div className="p-12 text-center rounded-2xl bg-card border border-dashed border-border space-y-3">
          <FileCheck2 className="w-10 h-10 mx-auto text-muted-foreground mb-2" />
          <h3 className="text-sm font-semibold text-foreground">No assessments configured</h3>
          <p className="text-xs text-muted-foreground max-w-sm mx-auto">
            Build your first customized assessment with timer rules, marks, and question distributions.
          </p>
          <button
            onClick={() => navigate('/builder')}
            className="mt-3 px-4 py-2 rounded-xl text-xs font-semibold bg-primary text-primary-foreground hover:bg-primary-hover"
          >
            Open Assessment Builder
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {quizzes.map((quiz) => (
            <div
              key={quiz.id}
              className="p-5 rounded-2xl bg-card border border-border hover:border-primary/40 transition-all shadow-sm flex flex-col justify-between"
            >
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className={`px-2 py-0.5 rounded text-[10px] font-semibold uppercase ${
                    quiz.mode === 'exam'
                      ? 'bg-rose-500/10 text-rose-500 border border-rose-500/20'
                      : quiz.mode === 'revision'
                      ? 'bg-amber-500/10 text-amber-500 border border-amber-500/20'
                      : 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20'
                  }`}>
                    {quiz.mode}
                  </span>

                  <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5" />
                    {quiz.timing_mode === 'untimed'
                      ? 'Untimed'
                      : quiz.timing_mode === 'per_question'
                      ? `${quiz.per_question_seconds || 60}s per question`
                      : quiz.duration_minutes
                      ? `${quiz.duration_minutes}m total`
                      : `${quiz.per_question_seconds || 60}s/q`}
                  </span>
                </div>

                <h3 className="text-base font-bold text-foreground line-clamp-1">
                  {quiz.title}
                </h3>

                <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
                  {quiz.description || 'Dedicated assessment with individual question bank.'}
                </p>

                {/* Section tags if available */}
                {quiz.sections && quiz.sections.length > 0 && (
                  <div className="flex flex-wrap items-center gap-1 pt-1">
                    {quiz.sections.slice(0, 3).map((sec, idx) => (
                      <span key={idx} className="px-2 py-0.5 rounded text-[10px] font-medium bg-muted text-muted-foreground">
                        {sec.name}
                      </span>
                    ))}
                    {quiz.sections.length > 3 && (
                      <span className="text-[10px] text-muted-foreground">
                        +{quiz.sections.length - 3} more
                      </span>
                    )}
                  </div>
                )}

                <div className="flex items-center gap-4 text-xs text-muted-foreground pt-1">
                  <span>{quiz.question_ids?.length ?? 0} Questions</span>
                  <span>•</span>
                  <span>+{quiz.positive_marks} / -{quiz.negative_marks}</span>
                </div>
              </div>

              <div className="pt-4 border-t border-border mt-4 flex flex-col gap-2">
                {/* Dedicated Question Bank Button */}
                <button
                  onClick={() => navigate(`/assessments/${quiz.id}/bank`)}
                  className="w-full inline-flex items-center justify-center space-x-1.5 px-3 py-2 rounded-xl text-xs font-semibold bg-muted hover:bg-muted/80 text-foreground transition-colors"
                >
                  <Layers className="w-3.5 h-3.5 text-primary" />
                  <span>Question Bank & Sections ({quiz.question_ids?.length ?? 0})</span>
                </button>

                <div className="flex items-center justify-between gap-2">
                  <button
                    onClick={() => handleDelete(quiz.id)}
                    className="p-2 rounded-xl text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                    title="1-Click Delete Assessment & Bank"
                  >
                    <Trash2 className="w-4 h-4 text-destructive" />
                  </button>

                  <button
                    onClick={() => openEditModal(quiz)}
                    className="p-2 rounded-xl text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors"
                    title="Edit Assessment Choices & Timing"
                  >
                    <Edit2 className="w-4 h-4 text-primary" />
                  </button>

                  <button
                    onClick={() => navigate(`/assessments/${quiz.id}/instructions`)}
                    className="flex-1 inline-flex items-center justify-center space-x-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-primary hover:bg-primary-hover text-primary-foreground shadow-sm transition-all"
                  >
                    <Play className="w-3.5 h-3.5" />
                    <span>Start Test</span>
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Floating Success Toast */}
      {successToast && (
        <div className="fixed top-6 right-6 z-50 px-4 py-2.5 rounded-xl bg-emerald-600 text-white text-xs font-semibold shadow-lg flex items-center gap-2 animate-fadeIn">
          <CheckCircle2 className="w-4 h-4" />
          <span>{successToast}</span>
        </div>
      )}

      {/* Full Edit Assessment Modal */}
      {editingQuiz && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 overflow-y-auto animate-fadeIn">
          <div className="relative w-full max-w-2xl bg-card border border-border rounded-2xl sm:rounded-3xl shadow-2xl overflow-hidden my-auto">
            {/* Modal Header */}
            <div className="p-5 sm:p-6 border-b border-border flex items-center justify-between bg-muted/20">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
                  <Sliders className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-foreground">
                    Edit Assessment Settings
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    Update timer limits, question limits, exam rules, and marking scheme
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setEditingQuiz(null)}
                className="p-2 rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Body */}
            <form onSubmit={handleSaveQuiz} className="p-5 sm:p-6 space-y-4 max-h-[75vh] overflow-y-auto scrollbar-thin">
              {editError && (
                <div className="p-3 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{editError}</span>
                </div>
              )}

              {/* Title */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground">Assessment Title *</label>
                <input
                  type="text"
                  value={editTitle}
                  onChange={e => setEditTitle(e.target.value)}
                  placeholder="e.g. Operating Systems Final Exam"
                  className="w-full px-3.5 py-2 rounded-xl bg-background border border-input text-foreground text-sm font-medium focus:ring-2 focus:ring-primary/40"
                />
              </div>

              {/* Description */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground">Description / Instructions</label>
                <textarea
                  rows={2}
                  value={editDescription}
                  onChange={e => setEditDescription(e.target.value)}
                  placeholder="Instructions displayed to candidates before taking the test..."
                  className="w-full p-3 rounded-xl bg-background border border-input text-foreground text-xs leading-relaxed"
                />
              </div>

              {/* Assessment Mode */}
              <div className="space-y-1.5 pt-1">
                <label className="text-xs font-semibold text-foreground">Assessment Mode</label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  {[
                    { id: 'exam', label: 'Exam Mode', desc: 'Score after submission' },
                    { id: 'practice', label: 'Practice Mode', desc: 'Immediate feedback allowed' },
                    { id: 'revision', label: 'Revision Mode', desc: 'Spaced repetition focus' }
                  ].map(m => (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => setEditMode(m.id as any)}
                      className={`p-2.5 rounded-xl border text-left transition-all ${
                        editMode === m.id
                          ? 'border-primary bg-primary/10 text-foreground ring-1 ring-primary'
                          : 'border-border bg-background text-muted-foreground hover:border-primary/40'
                      }`}
                    >
                      <span className="font-bold text-xs block text-foreground">{m.label}</span>
                      <span className="text-[10px] text-muted-foreground">{m.desc}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Timing Mode & Timer Settings */}
              <div className="space-y-2.5 pt-1">
                <label className="text-xs font-semibold text-foreground">Timing Mode</label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {[
                    { id: 'total_duration', label: 'Total Duration' },
                    { id: 'per_question', label: 'Per Question' },
                    { id: 'both', label: 'Combined Timer' },
                    { id: 'untimed', label: 'Untimed' }
                  ].map(t => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => setEditTimingMode(t.id as any)}
                      className={`px-3 py-2 rounded-xl border text-xs font-semibold transition-all ${
                        editTimingMode === t.id
                          ? 'border-primary bg-primary text-primary-foreground'
                          : 'border-border bg-background text-muted-foreground hover:border-primary/40'
                      }`}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>

                {/* Total Duration Limit */}
                {['total_duration', 'both'].includes(editTimingMode) && (
                  <div className="p-3.5 rounded-xl bg-muted/30 border border-border space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-foreground">Total Exam Duration (Minutes)</span>
                      <span className="text-xs font-bold font-mono text-primary">{editDurationMinutes} mins</span>
                    </div>
                    <div className="flex flex-wrap items-center gap-1.5">
                      {[5, 10, 15, 20, 30, 45, 60, 90, 120].map(mins => (
                        <button
                          key={mins}
                          type="button"
                          onClick={() => setEditDurationMinutes(mins)}
                          className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all ${
                            editDurationMinutes === mins
                              ? 'bg-primary text-primary-foreground shadow-xs'
                              : 'bg-background border border-border text-muted-foreground hover:border-primary/40'
                          }`}
                        >
                          {mins}m
                        </button>
                      ))}
                    </div>
                    <input
                      type="number"
                      min="1"
                      max="600"
                      value={editDurationMinutes}
                      onChange={e => {
                        const val = e.target.value;
                        setEditDurationMinutes(val === '' ? '' : parseInt(val, 10));
                      }}
                      onBlur={() => {
                        if (editDurationMinutes === '' || editDurationMinutes < 1) {
                          setEditDurationMinutes(30);
                        }
                      }}
                      className="w-full px-3 py-1.5 rounded-lg bg-background border border-input text-foreground text-xs font-mono font-bold"
                    />
                  </div>
                )}

                {/* Per-Question Countdown Timer */}
                {['per_question', 'both'].includes(editTimingMode) && (
                  <div className="p-3.5 rounded-xl bg-muted/30 border border-border space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-foreground">Per-Question Limit (Seconds)</span>
                      <span className="text-xs font-bold font-mono text-primary">
                        {editPerQuestionSeconds !== '' ? `${editPerQuestionSeconds}s` : '--'}
                      </span>
                    </div>
                    <div className="flex flex-wrap items-center gap-1.5">
                      {[30, 45, 60, 90, 120, 180, 240].map(sec => (
                        <button
                          key={sec}
                          type="button"
                          onClick={() => setEditPerQuestionSeconds(sec)}
                          className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all ${
                            editPerQuestionSeconds === sec
                              ? 'bg-primary text-primary-foreground shadow-xs'
                              : 'bg-background border border-border text-muted-foreground hover:border-primary/40'
                          }`}
                        >
                          {sec}s
                        </button>
                      ))}
                    </div>
                    <input
                      type="number"
                      min="5"
                      max="1200"
                      value={editPerQuestionSeconds}
                      onChange={e => {
                        const val = e.target.value;
                        setEditPerQuestionSeconds(val === '' ? '' : parseInt(val, 10));
                      }}
                      onBlur={() => {
                        if (editPerQuestionSeconds === '' || editPerQuestionSeconds < 5) {
                          setEditPerQuestionSeconds(60);
                        }
                      }}
                      className="w-full px-3 py-1.5 rounded-lg bg-background border border-input text-foreground text-xs font-mono font-bold"
                    />
                  </div>
                )}
              </div>

              {/* Marking Scheme & Presentation Limits */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-foreground">Positive Marks (+)</label>
                  <input
                    type="number"
                    step="0.25"
                    min="0.25"
                    value={editPositiveMarks}
                    onChange={e => {
                      const val = e.target.value;
                      setEditPositiveMarks(val === '' ? '' : parseFloat(val));
                    }}
                    onBlur={() => {
                      if (editPositiveMarks === '' || editPositiveMarks < 0.25) {
                        setEditPositiveMarks(1.0);
                      }
                    }}
                    className="w-full px-3 py-2 rounded-xl bg-background border border-input text-foreground text-xs font-mono"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-foreground">Negative Penalty (-)</label>
                  <input
                    type="number"
                    step="0.25"
                    min="0.0"
                    value={editNegativeMarks}
                    onChange={e => {
                      const val = e.target.value;
                      setEditNegativeMarks(val === '' ? '' : parseFloat(val));
                    }}
                    onBlur={() => {
                      if (editNegativeMarks === '' || editNegativeMarks < 0) {
                        setEditNegativeMarks(0.0);
                      }
                    }}
                    className="w-full px-3 py-2 rounded-xl bg-background border border-input text-foreground text-xs font-mono"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-foreground">Present Count (blank = All)</label>
                  <input
                    type="number"
                    min="1"
                    placeholder="All in bank"
                    value={editQuestionCountToPresent}
                    onChange={e => {
                      const val = e.target.value;
                      setEditQuestionCountToPresent(val === '' ? '' : parseInt(val, 10));
                    }}
                    onBlur={() => {
                      if (typeof editQuestionCountToPresent === 'number' && editQuestionCountToPresent < 1) {
                        setEditQuestionCountToPresent('');
                      }
                    }}
                    className="w-full px-3 py-2 rounded-xl bg-background border border-input text-foreground text-xs font-mono"
                  />
                </div>
              </div>

              {/* Rules & Checkboxes */}
              <div className="space-y-2 pt-2 border-t border-border">
                <span className="text-xs font-semibold text-foreground block">Exam Navigation & Display Rules</span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                  <label className="flex items-center gap-2 cursor-pointer p-2 rounded-lg bg-muted/20 border border-border">
                    <input
                      type="checkbox"
                      checked={editAllowBackNav}
                      onChange={e => setEditAllowBackNav(e.target.checked)}
                      className="rounded border-input text-primary"
                    />
                    <span>Allow Back Navigation</span>
                  </label>

                  <label className="flex items-center gap-2 cursor-pointer p-2 rounded-lg bg-muted/20 border border-border">
                    <input
                      type="checkbox"
                      checked={editAllowChangeAnswer}
                      onChange={e => setEditAllowChangeAnswer(e.target.checked)}
                      className="rounded border-input text-primary"
                    />
                    <span>Allow Changing Answers</span>
                  </label>

                  <label className="flex items-center gap-2 cursor-pointer p-2 rounded-lg bg-muted/20 border border-border">
                    <input
                      type="checkbox"
                      checked={editRandomizeQuestions}
                      onChange={e => setEditRandomizeQuestions(e.target.checked)}
                      className="rounded border-input text-primary"
                    />
                    <span>Randomize Question Order</span>
                  </label>

                  <label className="flex items-center gap-2 cursor-pointer p-2 rounded-lg bg-muted/20 border border-border">
                    <input
                      type="checkbox"
                      checked={editRandomizeOptions}
                      onChange={e => setEditRandomizeOptions(e.target.checked)}
                      className="rounded border-input text-primary"
                    />
                    <span>Randomize Option Order</span>
                  </label>

                  {editMode === 'practice' && (
                    <label className="flex items-center gap-2 cursor-pointer p-2 rounded-lg bg-muted/20 border border-border col-span-1 sm:col-span-2">
                      <input
                        type="checkbox"
                        checked={editImmediateFeedback}
                        onChange={e => setEditImmediateFeedback(e.target.checked)}
                        className="rounded border-input text-primary"
                      />
                      <span>Immediate Feedback on Check Answer</span>
                    </label>
                  )}
                </div>
              </div>

              {/* Modal Footer Controls */}
              <div className="pt-4 border-t border-border flex flex-col sm:flex-row items-center justify-between gap-3">
                <Link
                  to={`/assessments/${editingQuiz.id}/edit`}
                  onClick={() => setEditingQuiz(null)}
                  className="text-xs font-semibold text-primary hover:underline flex items-center gap-1 self-start sm:self-center"
                >
                  <span>Open Full Builder & Manage Questions</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </Link>

                <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                  <button
                    type="button"
                    onClick={() => setEditingQuiz(null)}
                    className="px-4 py-2 rounded-xl text-xs font-semibold border border-border text-muted-foreground hover:text-foreground"
                  >
                    Cancel
                  </button>

                  <button
                    type="submit"
                    disabled={savingQuiz}
                    className="px-5 py-2 rounded-xl text-xs font-semibold bg-primary hover:bg-primary-hover disabled:opacity-50 text-primary-foreground shadow-sm transition-all"
                  >
                    {savingQuiz ? 'Saving...' : 'Save Changes'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
