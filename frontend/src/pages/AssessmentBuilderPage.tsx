import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  FileCheck2,
  Clock,
  Layers,
  CheckCircle2,
  Sliders,
  ShieldAlert,
  ShieldCheck,
  ArrowRight,
  Database,
  Info,
  UploadCloud,
  Sparkles,
  Search,
  FileQuestion,
  BookOpen,
  Plus
} from 'lucide-react';
import { api } from '../services/api';
import { Question } from '../types';

export const AssessmentBuilderPage: React.FC = () => {
  const navigate = useNavigate();

  const [title, setTitle] = useState('New Diagnostic Assessment');
  const [description, setDescription] = useState('');
  const [mode, setMode] = useState<'practice' | 'exam' | 'revision'>('exam');
  
  // Timing modes
  const [timingMode, setTimingMode] = useState<'total_duration' | 'per_question' | 'both' | 'untimed'>('total_duration');
  const [durationMinutes, setDurationMinutes] = useState(30);
  const [perQuestionSeconds, setPerQuestionSeconds] = useState(60);

  // Scoring
  const [positiveMarks, setPositiveMarks] = useState(1.0);
  const [negativeMarks, setNegativeMarks] = useState(0.25);
  const [partialCredit, setPartialCredit] = useState(true);

  // Navigation & feedback
  const [allowSkip, setAllowSkip] = useState(true);
  const [allowBackNav, setAllowBackNav] = useState(true);
  const [allowChangeAnswer, setAllowChangeAnswer] = useState(true);
  const [immediateFeedback, setImmediateFeedback] = useState(false);
  const [showExplanation, setShowExplanation] = useState(true);
  const [randomizeQuestions, setRandomizeQuestions] = useState(false);
  const [randomizeOptions, setRandomizeOptions] = useState(false);

  // Question selection (only unassigned or explicitly preselected questions)
  const [availableQuestions, setAvailableQuestions] = useState<Question[]>([]);
  const [selectedQIds, setSelectedQIds] = useState<number[]>([]);
  const [questionCountToPresent, setQuestionCountToPresent] = useState<number | ''>(() => {
    const saved = sessionStorage.getItem('quizforge_desired_question_count');
    return saved && !isNaN(parseInt(saved)) ? parseInt(saved) : 10;
  });

  // Filters for available questions
  const [filterSearch, setFilterSearch] = useState('');
  const [filterDifficulty, setFilterDifficulty] = useState<string>('all');
  const [filterType, setFilterType] = useState<string>('all');

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Check if question IDs were explicitly preselected from Question Bank / Revision
    const preselectedRaw = sessionStorage.getItem('quizforge_builder_selected_qids');
    let preselected: number[] = [];
    if (preselectedRaw) {
      try {
        preselected = JSON.parse(preselectedRaw);
      } catch {}
      sessionStorage.removeItem('quizforge_builder_selected_qids');
    }

    const fetchPromise = preselected.length > 0
      ? api.getQuestions()
      : api.getQuestions({ unassigned_only: true });

    fetchPromise
      .then(qList => {
        setAvailableQuestions(qList);
        if (preselected.length > 0) {
          setSelectedQIds(preselected);
        } else {
          // Dedicated assessment bank starts fresh and empty
          setSelectedQIds([]);
        }
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const toggleQuestion = (id: number) => {
    if (selectedQIds.includes(id)) {
      setSelectedQIds(selectedQIds.filter(x => x !== id));
    } else {
      setSelectedQIds([...selectedQIds, id]);
    }
  };

  const handleCreate = async (e?: React.FormEvent, nextAction: 'ai' | 'import' | 'bank' = 'bank') => {
    if (e) e.preventDefault();
    if (!title.trim()) {
      setError('Assessment title is required.');
      return;
    }

    setSaving(true);
    try {
      const quiz = await api.createQuiz({
        title,
        description,
        mode,
        timing_mode: timingMode,
        duration_minutes: ['total_duration', 'both'].includes(timingMode) ? durationMinutes : null,
        per_question_seconds: ['per_question', 'both'].includes(timingMode) ? perQuestionSeconds : null,
        positive_marks: positiveMarks,
        negative_marks: negativeMarks,
        partial_credit: partialCredit,
        allow_skip: allowSkip,
        allow_back_nav: allowBackNav,
        allow_change_answer: allowChangeAnswer,
        immediate_feedback: mode === 'practice' ? immediateFeedback : false,
        show_explanation: showExplanation,
        randomize_questions: randomizeQuestions,
        randomize_options: randomizeOptions,
        auto_submit_on_timeout: true,
        question_ids: selectedQIds,
        question_count_to_present: questionCountToPresent !== '' ? Number(questionCountToPresent) : null,
        sections: [{ name: "Section 1", description: "General" }]
      });

      if (nextAction === 'ai') {
        const cnt = questionCountToPresent || 10;
        sessionStorage.setItem('quizforge_desired_question_count', String(cnt));
        navigate(`/create-assessment?tab=ai&quiz_id=${quiz.id}&count=${cnt}`);
      } else if (nextAction === 'import') {
        navigate(`/imports?quiz_id=${quiz.id}`);
      } else {
        navigate(`/assessments/${quiz.id}/bank`);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to create assessment.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-fadeIn pb-16">
      <div>
        <h2 className="text-2xl font-bold tracking-tight text-foreground">
          Assessment Builder
        </h2>
        <p className="text-sm text-muted-foreground mt-0.5">
          Configure assessment rules, server-authoritative timer limits, scoring policies, and select questions.
        </p>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-xs">
          {error}
        </div>
      )}

      <form onSubmit={handleCreate} className="space-y-6">
        {/* Basic Info */}
        <div className="p-6 rounded-2xl bg-card border border-border shadow-sm space-y-4">
          <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <FileCheck2 className="w-4 h-4 text-primary" />
            General Information
          </h3>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-foreground">Assessment Title *</label>
            <input
              type="text"
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="e.g. Midterm Algorithmic Assessment 2024"
              className="w-full px-3.5 py-2.5 rounded-xl bg-background border border-input text-foreground text-sm font-medium focus:ring-2 focus:ring-primary/40"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-foreground">Description / Instructions</label>
            <textarea
              rows={2}
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Instructions displayed to candidates before beginning the session..."
              className="w-full p-3 rounded-xl bg-background border border-input text-foreground text-xs leading-relaxed"
            />
          </div>

          {/* Mode Selector */}
          <div className="space-y-1.5 pt-1">
            <label className="text-xs font-semibold text-foreground">Assessment Mode</label>
            <div className="grid grid-cols-3 gap-3">
              {[
                { id: 'exam', label: 'Exam Mode', desc: 'Authoritative evaluation. Answers revealed only after full submission.' },
                { id: 'practice', label: 'Practice Mode', desc: 'Formative learning. Optional immediate answer feedback and retry.' },
                { id: 'revision', label: 'Revision Mode', desc: 'Focuses on mistakes, spaced memory reinforcement, and weak concepts.' }
              ].map(m => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => setMode(m.id as any)}
                  className={`p-4 rounded-xl border text-left transition-all ${
                    mode === m.id
                      ? 'border-primary bg-primary/5 ring-1 ring-primary/20'
                      : 'border-border bg-background hover:border-primary/40'
                  }`}
                >
                  <span className="text-xs font-bold text-foreground block">{m.label}</span>
                  <span className="text-[11px] text-muted-foreground mt-1 block leading-tight">{m.desc}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Timing Configuration Wizard */}
        <div className="p-6 rounded-2xl bg-card border border-border shadow-sm space-y-4">
          <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <Clock className="w-4 h-4 text-primary" />
            Timing Configuration Wizard
          </h3>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { id: 'total_duration', label: 'Mode A: Total Duration', desc: 'Countdown for whole quiz' },
              { id: 'per_question', label: 'Mode B: Per-Question', desc: 'Countdown per question' },
              { id: 'both', label: 'Mode C: Both Timers', desc: 'Global & question deadlines' },
              { id: 'untimed', label: 'Mode D: Untimed', desc: 'No time limits' }
            ].map(tm => (
              <button
                key={tm.id}
                type="button"
                onClick={() => setTimingMode(tm.id as any)}
                className={`p-3 rounded-xl border text-left transition-all ${
                  timingMode === tm.id
                    ? 'border-primary bg-primary/5 ring-1 ring-primary/20'
                    : 'border-border bg-background hover:border-primary/40'
                }`}
              >
                <span className="text-xs font-bold text-foreground block">{tm.label}</span>
                <span className="text-[10px] text-muted-foreground mt-0.5 block">{tm.desc}</span>
              </button>
            ))}
          </div>

          {['total_duration', 'both'].includes(timingMode) && (
            <div className="p-4 rounded-xl bg-muted/40 border border-border space-y-2">
              <label className="text-xs font-semibold text-foreground">Total Session Duration (Minutes)</label>
              <div className="flex items-center gap-2">
                {[15, 30, 45, 60, 90].map(m => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setDurationMinutes(m)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold border ${
                      durationMinutes === m ? 'bg-primary text-primary-foreground border-primary' : 'bg-background text-muted-foreground border-input'
                    }`}
                  >
                    {m}m
                  </button>
                ))}
                <input
                  type="number"
                  min={1}
                  value={durationMinutes}
                  onChange={e => setDurationMinutes(parseInt(e.target.value) || 1)}
                  className="w-20 px-2 py-1.5 rounded-lg bg-background border border-input text-foreground text-xs"
                />
              </div>
            </div>
          )}

          {['per_question', 'both'].includes(timingMode) && (
            <div className="p-4 rounded-xl bg-muted/40 border border-border space-y-2">
              <label className="text-xs font-semibold text-foreground">Default Per-Question Time Limit (Seconds)</label>
              <div className="flex items-center gap-2">
                {[30, 45, 60, 90, 120].map(s => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setPerQuestionSeconds(s)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold border ${
                      perQuestionSeconds === s ? 'bg-primary text-primary-foreground border-primary' : 'bg-background text-muted-foreground border-input'
                    }`}
                  >
                    {s}s
                  </button>
                ))}
                <input
                  type="number"
                  min={5}
                  value={perQuestionSeconds}
                  onChange={e => setPerQuestionSeconds(parseInt(e.target.value) || 5)}
                  className="w-20 px-2 py-1.5 rounded-lg bg-background border border-input text-foreground text-xs"
                />
              </div>
              <p className="text-[11px] text-muted-foreground">
                In Mode C, the active question deadline is strictly bounded by the remaining session deadline.
              </p>
            </div>
          )}
        </div>

        {/* Scoring & Navigation Policies */}
        <div className="p-6 rounded-2xl bg-card border border-border shadow-sm space-y-4">
          <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <Sliders className="w-4 h-4 text-primary" />
            Scoring & Assessment Policies
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-foreground">Positive Marks (per question)</label>
              <input
                type="number"
                step="0.25"
                min="0.25"
                value={positiveMarks}
                onChange={e => setPositiveMarks(parseFloat(e.target.value) || 1.0)}
                className="w-full px-3 py-2 rounded-lg bg-background border border-input text-foreground text-xs"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-foreground">Negative Marks (penalty for incorrect)</label>
              <input
                type="number"
                step="0.25"
                min="0"
                value={negativeMarks}
                onChange={e => setNegativeMarks(parseFloat(e.target.value) || 0.0)}
                className="w-full px-3 py-2 rounded-lg bg-background border border-input text-foreground text-xs"
              />
            </div>

            <div className="flex items-center space-x-2 pt-6">
              <input
                type="checkbox"
                id="partial-credit"
                checked={partialCredit}
                onChange={e => setPartialCredit(e.target.checked)}
                className="rounded border-input text-primary focus:ring-primary"
              />
              <label htmlFor="partial-credit" className="text-xs font-semibold text-foreground cursor-pointer">
                Award Partial Credit
              </label>
            </div>
          </div>

          <div className="pt-2 grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            <label className="flex items-center space-x-2 cursor-pointer">
              <input
                type="checkbox"
                checked={allowSkip}
                onChange={e => setAllowSkip(e.target.checked)}
                className="rounded border-input text-primary focus:ring-primary"
              />
              <span>Allow candidate to skip questions</span>
            </label>

            <label className="flex items-center space-x-2 cursor-pointer">
              <input
                type="checkbox"
                checked={allowBackNav}
                onChange={e => setAllowBackNav(e.target.checked)}
                className="rounded border-input text-primary focus:ring-primary"
              />
              <span>Allow backward navigation to previous questions</span>
            </label>

            <label className="flex items-center space-x-2 cursor-pointer">
              <input
                type="checkbox"
                checked={allowChangeAnswer}
                onChange={e => setAllowChangeAnswer(e.target.checked)}
                className="rounded border-input text-primary focus:ring-primary"
              />
              <span>Allow changing answers before final submission</span>
            </label>

            <label className="flex items-center space-x-2 cursor-pointer">
              <input
                type="checkbox"
                checked={randomizeQuestions}
                onChange={e => setRandomizeQuestions(e.target.checked)}
                className="rounded border-input text-primary focus:ring-primary"
              />
              <span>Randomize question presentation order</span>
            </label>

            <div className="pt-2 border-t border-border">
              <label className="text-xs font-semibold text-foreground block mb-1">
                Custom Question Count per Test Attempt (Optional)
              </label>
              <p className="text-[11px] text-muted-foreground mb-2">
                Leave empty to present all questions from the bank, or set a number (e.g. 25) so each candidate attempt serves a custom subset.
              </p>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min="1"
                  max="1000"
                  value={questionCountToPresent}
                  onChange={e => {
                    const val = e.target.value === '' ? '' : parseInt(e.target.value);
                    setQuestionCountToPresent(val);
                    if (typeof val === 'number' && !isNaN(val)) {
                      sessionStorage.setItem('quizforge_desired_question_count', String(val));
                    }
                  }}
                  placeholder="e.g. 25 (default: All)"
                  className="w-48 px-3.5 py-2 rounded-xl bg-background border border-input text-foreground text-xs"
                />
                <span className="text-xs text-muted-foreground">questions per attempt</span>
              </div>
            </div>
          </div>
        </div>

        {/* Dedicated Assessment Question Bank Section */}
        <div className="p-6 md:p-8 rounded-2xl bg-card border border-border shadow-sm space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border pb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-foreground flex items-center gap-2">
                  <span>Individual Question Bank</span>
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
                    Isolated
                  </span>
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Every assessment owns its own private Question Bank. Questions are never shared or mixed across assessments.
                </p>
              </div>
            </div>
          </div>

          {/* Quick Setup Pathways */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-5 rounded-2xl bg-background border border-border/80 hover:border-primary/40 transition-all flex flex-col justify-between space-y-4">
              <div className="space-y-2">
                <div className="w-9 h-9 rounded-xl bg-purple-500/10 text-purple-500 flex items-center justify-center">
                  <Sparkles className="w-4 h-4" />
                </div>
                <h4 className="text-sm font-semibold text-foreground">Generate Questions with AI</h4>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Automatically generate fresh questions tailored to your subject and difficulty directly into this assessment's bank.
                </p>
              </div>
              <button
                type="button"
                disabled={saving}
                onClick={e => handleCreate(e, 'ai')}
                className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold bg-primary hover:bg-primary-hover disabled:opacity-50 text-primary-foreground shadow-sm transition-all"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>Save & Generate AI</span>
              </button>
            </div>

            <div className="p-5 rounded-2xl bg-background border border-border/80 hover:border-primary/40 transition-all flex flex-col justify-between space-y-4">
              <div className="space-y-2">
                <div className="w-9 h-9 rounded-xl bg-indigo-500/10 text-indigo-500 flex items-center justify-center">
                  <UploadCloud className="w-4 h-4" />
                </div>
                <h4 className="text-sm font-semibold text-foreground">Import from PDF / Text / JSON</h4>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Extract questions directly from exam PDFs, pasted question papers, or formatted JSON into this assessment.
                </p>
              </div>
              <button
                type="button"
                disabled={saving}
                onClick={e => handleCreate(e, 'import')}
                className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold bg-secondary hover:bg-muted text-secondary-foreground border border-border shadow-sm transition-all"
              >
                <UploadCloud className="w-3.5 h-3.5 text-primary" />
                <span>Save & Import Questions</span>
              </button>
            </div>

            <div className="p-5 rounded-2xl bg-background border border-border/80 hover:border-primary/40 transition-all flex flex-col justify-between space-y-4">
              <div className="space-y-2">
                <div className="w-9 h-9 rounded-xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center">
                  <Layers className="w-4 h-4" />
                </div>
                <h4 className="text-sm font-semibold text-foreground">Clean Blank Bank</h4>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Create this assessment with an empty question bank, and add custom questions or configure sections manually.
                </p>
              </div>
              <button
                type="button"
                disabled={saving}
                onClick={e => handleCreate(e, 'bank')}
                className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold border border-border hover:bg-muted text-foreground transition-all"
              >
                <Layers className="w-3.5 h-3.5 text-primary" />
                <span>Save & Open Bank</span>
              </button>
            </div>
          </div>

          {/* Optional: Only show unassigned standalone questions if any exist in the global database */}
          {availableQuestions.length > 0 && (
            <div className="pt-4 border-t border-border space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h4 className="text-xs font-semibold text-foreground flex items-center gap-2">
                    <Database className="w-3.5 h-3.5 text-primary" />
                    <span>Optional: Standalone Unassigned Questions ({selectedQIds.length} of {availableQuestions.length} selected)</span>
                  </h4>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    These questions are unassigned to any assessment. You may pick any to include, or leave blank to start fresh.
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      const filtered = availableQuestions.filter(q => {
                        if (filterSearch && !q.question_text.toLowerCase().includes(filterSearch.toLowerCase())) return false;
                        if (filterDifficulty !== 'all' && q.difficulty !== filterDifficulty) return false;
                        if (filterType !== 'all' && q.question_type !== filterType) return false;
                        return true;
                      });
                      const filteredIds = filtered.map(q => q.id);
                      const allFilteredSelected = filteredIds.every(id => selectedQIds.includes(id));
                      if (allFilteredSelected) {
                        setSelectedQIds(selectedQIds.filter(id => !filteredIds.includes(id)));
                      } else {
                        setSelectedQIds(Array.from(new Set([...selectedQIds, ...filteredIds])));
                      }
                    }}
                    className="text-xs font-semibold text-primary hover:underline px-2.5 py-1 rounded-lg hover:bg-primary/10 transition-colors"
                  >
                    Select Visible
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (selectedQIds.length === availableQuestions.length) {
                        setSelectedQIds([]);
                      } else {
                        setSelectedQIds(availableQuestions.map(q => q.id));
                      }
                    }}
                    className="text-xs font-semibold text-muted-foreground hover:text-foreground px-2.5 py-1 rounded-lg border border-border hover:bg-muted transition-colors"
                  >
                    {selectedQIds.length === availableQuestions.length ? 'Deselect All' : 'Select All'}
                  </button>
                </div>
              </div>

              {/* Search and Filters */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-1">
                <div className="relative">
                  <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <input
                    type="text"
                    value={filterSearch}
                    onChange={e => setFilterSearch(e.target.value)}
                    placeholder="Search unassigned questions..."
                    className="w-full pl-8 pr-3 py-1.5 rounded-lg bg-background border border-input text-foreground text-xs"
                  />
                </div>

                <select
                  value={filterDifficulty}
                  onChange={e => setFilterDifficulty(e.target.value)}
                  className="px-2.5 py-1.5 rounded-lg bg-background border border-input text-foreground text-xs"
                >
                  <option value="all">All Difficulties</option>
                  <option value="easy">Easy</option>
                  <option value="medium">Medium</option>
                  <option value="hard">Hard</option>
                </select>

                <select
                  value={filterType}
                  onChange={e => setFilterType(e.target.value)}
                  className="px-2.5 py-1.5 rounded-lg bg-background border border-input text-foreground text-xs"
                >
                  <option value="all">All 14 Question Types</option>
                  <optgroup label="Choice & Logic">
                    <option value="single_choice">Single Choice (MCQ)</option>
                    <option value="multiple_choice">Multiple Choice</option>
                    <option value="true_false">True / False</option>
                    <option value="assertion_reasoning">Assertion & Reasoning</option>
                  </optgroup>
                  <optgroup label="Text & Math">
                    <option value="fill_in_the_blank">Fill in the Blanks</option>
                    <option value="short_answer">Short Answer</option>
                    <option value="numerical">Numerical Calculations</option>
                  </optgroup>
                  <optgroup label="Relational & Sequence">
                    <option value="match_the_following">Match the Following</option>
                    <option value="arrange_in_order">Arrange in Order</option>
                  </optgroup>
                  <optgroup label="Coding & Technical">
                    <option value="coding">Live Coding Challenge</option>
                    <option value="code_output">Code Output Prediction</option>
                    <option value="code_debug">Code Debugging</option>
                    <option value="code_writing">Code Writing</option>
                  </optgroup>
                  <optgroup label="Subjective">
                    <option value="descriptive">Descriptive Answer</option>
                  </optgroup>
                </select>
              </div>

              <div className="max-h-60 overflow-y-auto space-y-2 pr-1">
                {availableQuestions
                  .filter(q => {
                    if (filterSearch && !q.question_text.toLowerCase().includes(filterSearch.toLowerCase())) return false;
                    if (filterDifficulty !== 'all' && q.difficulty !== filterDifficulty) return false;
                    if (filterType !== 'all' && q.question_type !== filterType) return false;
                    return true;
                  })
                  .map((q) => {
                    const isSelected = selectedQIds.includes(q.id);
                    return (
                      <div
                        key={q.id}
                        onClick={() => toggleQuestion(q.id)}
                        className={`p-3 rounded-xl border text-xs flex items-center gap-3 cursor-pointer transition-colors ${
                          isSelected
                            ? 'border-primary bg-primary/5 text-foreground'
                            : 'border-border bg-background/50 text-muted-foreground hover:border-primary/40'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => {}}
                          className="rounded border-input text-primary"
                        />
                        <span className="font-semibold px-2 py-0.5 rounded bg-muted text-[10px] uppercase">
                          {q.question_type.replace(/_/g, ' ')}
                        </span>
                        <span className="truncate flex-1 font-medium">{q.question_text}</span>
                        <span className="text-[10px] uppercase font-bold text-muted-foreground">{q.difficulty}</span>
                      </div>
                    );
                  })}
              </div>
            </div>
          )}
        </div>

        {/* Submit Bar */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Info className="w-4 h-4 text-primary shrink-0" />
            <span>Questions will be exclusively linked to this assessment.</span>
          </div>

          <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
            <button
              type="button"
              onClick={() => navigate('/assessments')}
              className="px-5 py-2.5 rounded-xl text-xs font-semibold border border-border text-muted-foreground hover:text-foreground"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center space-x-2 px-6 py-2.5 rounded-xl text-xs font-semibold bg-primary hover:bg-primary-hover disabled:opacity-50 text-primary-foreground shadow-sm transition-all"
            >
              {saving ? (
                <span>Creating Assessment...</span>
              ) : (
                <>
                  <span>Create Assessment & Open Bank</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </>
              )}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
};
