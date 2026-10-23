import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import {
  FileCheck2,
  Clock,
  Award,
  ShieldAlert,
  ArrowRight,
  CheckCircle2,
  AlertTriangle,
  Play,
  Sliders,
  CheckSquare,
  Square,
  Search,
  Filter,
  Check,
  ListFilter,
  Code2
} from 'lucide-react';
import { api } from '../services/api';
import { Quiz, Question } from '../types';
import { enterFullScreen } from '../utils/fullscreen';

interface CategoryGroup {
  id: string;
  label: string;
  types: string[];
}

const CATEGORY_GROUPS: CategoryGroup[] = [
  { id: 'all', label: 'All Categories', types: [] },
  { id: 'choice_logic', label: 'Choice & Logic', types: ['single_choice', 'multiple_choice', 'true_false', 'assertion_reasoning'] },
  { id: 'text_math', label: 'Text & Math', types: ['fill_in_the_blank', 'short_answer', 'numerical'] },
  { id: 'relational', label: 'Relational & Sequence', types: ['match_the_following', 'arrange_in_order'] },
  { id: 'coding', label: 'Coding & Technical', types: ['coding', 'code_output', 'code_debug', 'code_writing'] },
  { id: 'subjective', label: 'Subjective', types: ['descriptive'] }
];

export const PreAssessmentPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();

  const [quiz, setQuiz] = useState<Quiz | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [starting, setStarting] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Assessment mode: 'exam' | 'practice' | 'revision'
  const [assessmentMode, setAssessmentMode] = useState<'exam' | 'practice' | 'revision'>('exam');

  // Selection mode: 'count' (preset count) or 'specific' (custom selected questions)
  const [selectionMode, setSelectionMode] = useState<'count' | 'specific'>('count');

  // Count mode state
  const [selectedQuestionCount, setSelectedQuestionCount] = useState<number>(0);
  const [countMode, setCountMode] = useState<'all' | '10' | '25' | '50' | 'custom'>('all');
  const [customInputVal, setCustomInputVal] = useState<string>('20');

  // Specific question selection state
  const [selectedSpecificQIds, setSelectedSpecificQIds] = useState<number[]>([]);
  const [filterSearch, setFilterSearch] = useState('');
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [filterType, setFilterType] = useState<string>('all');

  useEffect(() => {
    if (id) {
      const qId = parseInt(id);
      Promise.all([api.getQuiz(qId), api.getQuizQuestions(qId).catch(() => [])])
        .then(([qData, qList]) => {
          setQuiz(qData);
          setQuestions(qList);
          setAssessmentMode((qData.mode as any) || 'exam');

          const totalInBank = qData.question_ids?.length || qList.length || 0;
          
          // Check if specific questions were passed from Question Bank / Assessment Bank
          const incomingIds = (location.state as any)?.selectedQIds as number[] | undefined;
          if (incomingIds && Array.isArray(incomingIds) && incomingIds.length > 0) {
            setSelectedSpecificQIds(incomingIds);
            setSelectionMode('specific');
            setSelectedQuestionCount(incomingIds.length);
          } else if (qData.question_count_to_present && qData.question_count_to_present > 0 && qData.question_count_to_present < totalInBank) {
            setSelectedQuestionCount(qData.question_count_to_present);
            setCountMode('custom');
            setCustomInputVal(String(qData.question_count_to_present));
            setSelectedSpecificQIds(qList.map(q => q.id));
          } else {
            setSelectedQuestionCount(totalInBank);
            setCountMode('all');
            setSelectedSpecificQIds(qList.map(q => q.id));
          }
        })
        .catch(err => setError(err.message || 'Failed to load assessment instructions.'))
        .finally(() => setLoading(false));
    }
  }, [id, location.state]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (error || !quiz) {
    return (
      <div className="p-8 text-center rounded-2xl bg-card border border-destructive/20 text-destructive">
        <p>{error || 'Assessment not found.'}</p>
        <button
          onClick={() => navigate('/assessments')}
          className="mt-4 px-4 py-2 rounded-xl text-xs font-semibold bg-primary text-primary-foreground"
        >
          Return to Assessments
        </button>
      </div>
    );
  }

  const totalAvailable = quiz.question_ids?.length || questions.length || 0;

  const handleSelectCountMode = (mode: 'all' | '10' | '25' | '50' | 'custom') => {
    setCountMode(mode);
    if (mode === 'all') {
      setSelectedQuestionCount(totalAvailable);
    } else if (mode === '10') {
      setSelectedQuestionCount(Math.min(10, totalAvailable));
    } else if (mode === '25') {
      setSelectedQuestionCount(Math.min(25, totalAvailable));
    } else if (mode === '50') {
      setSelectedQuestionCount(Math.min(50, totalAvailable));
    } else if (mode === 'custom') {
      const val = parseInt(customInputVal) || 10;
      setSelectedQuestionCount(Math.min(Math.max(1, val), totalAvailable));
    }
  };

  const handleCustomInputChange = (valStr: string) => {
    setCustomInputVal(valStr);
    const parsed = parseInt(valStr);
    if (!isNaN(parsed) && parsed > 0) {
      setSelectedQuestionCount(Math.min(parsed, totalAvailable));
    }
  };

  const toggleSpecificQuestion = (qId: number) => {
    setSelectedSpecificQIds(prev =>
      prev.includes(qId) ? prev.filter(id => id !== qId) : [...prev, qId]
    );
  };

  // Filter questions for the interactive specific selection view
  const filteredQuestions = questions.filter(q => {
    if (filterSearch && !q.question_text.toLowerCase().includes(filterSearch.toLowerCase())) {
      return false;
    }
    if (filterCategory !== 'all') {
      const grp = CATEGORY_GROUPS.find(g => g.id === filterCategory);
      if (grp && !grp.types.includes(q.question_type)) {
        return false;
      }
    }
    if (filterType !== 'all' && q.question_type !== filterType) {
      return false;
    }
    return true;
  });

  const selectAllFiltered = () => {
    const ids = filteredQuestions.map(q => q.id);
    const allSelected = ids.every(id => selectedSpecificQIds.includes(id));
    if (allSelected) {
      setSelectedSpecificQIds(prev => prev.filter(id => !ids.includes(id)));
    } else {
      setSelectedSpecificQIds(prev => Array.from(new Set([...prev, ...ids])));
    }
  };

  const handleStart = async () => {
    // 1. GUARANTEED AUTOMATIC FULLSCREEN: Execute synchronously on line 1 within user gesture!
    enterFullScreen();

    if (selectionMode === 'specific' && selectedSpecificQIds.length === 0) {
      setError('Please select at least 1 question to start the assessment.');
      return;
    }
    if (selectionMode === 'count' && selectedQuestionCount <= 0) {
      setError('Please select at least 1 question count to start the assessment.');
      return;
    }

    setStarting(true);
    setError(null);

    try {
      const questionCountArg = selectionMode === 'count' ? selectedQuestionCount : selectedSpecificQIds.length;
      const questionIdsArg = selectionMode === 'specific' ? selectedSpecificQIds : undefined;

      const session = await api.startSession(quiz.id, questionCountArg, questionIdsArg, assessmentMode);
      navigate(`/session/${session.session_token}`);
    } catch (err: any) {
      setError(err.message || 'Could not initialize assessment session.');
      setStarting(false);
    }
  };

  const effectiveCount = selectionMode === 'count' ? selectedQuestionCount : selectedSpecificQIds.length;

  return (
    <div className="max-w-3xl mx-auto space-y-6 animate-fadeIn py-6">
      <div className="p-8 rounded-2xl bg-card border border-border shadow-sm space-y-6">
        <div>
          <span className={`px-2.5 py-0.5 rounded text-[11px] font-semibold uppercase tracking-wider ${
            assessmentMode === 'exam'
              ? 'bg-rose-500/10 text-rose-500 border border-rose-500/20'
              : assessmentMode === 'practice'
              ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20'
              : 'bg-indigo-500/10 text-indigo-500 border border-indigo-500/20'
          }`}>
            {assessmentMode} Mode
          </span>
          <h2 className="text-2xl font-bold tracking-tight text-foreground mt-2">
            {quiz.title}
          </h2>
          {quiz.description && (
            <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed">
              {quiz.description}
            </p>
          )}
        </div>

        {/* Interactive Mode Selector */}
        <div className="space-y-2">
          <label className="text-xs font-bold text-foreground">Select Attempt Mode</label>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <button
              type="button"
              onClick={() => setAssessmentMode('exam')}
              className={`p-3.5 rounded-2xl border text-left transition-all cursor-pointer ${
                assessmentMode === 'exam'
                  ? 'border-rose-500 bg-rose-500/10 ring-2 ring-rose-500/20'
                  : 'border-border bg-card hover:border-border/80'
              }`}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-bold text-foreground">Exam Mode</span>
                <span className="w-2 h-2 rounded-full bg-rose-500" />
              </div>
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                Strict timed evaluation. Answers sealed until full submission. Negative marking applies.
              </p>
            </button>

            <button
              type="button"
              onClick={() => setAssessmentMode('practice')}
              className={`p-3.5 rounded-2xl border text-left transition-all cursor-pointer ${
                assessmentMode === 'practice'
                  ? 'border-emerald-500 bg-emerald-500/10 ring-2 ring-emerald-500/20'
                  : 'border-border bg-card hover:border-border/80'
              }`}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-bold text-foreground">Practice Mode</span>
                <span className="w-2 h-2 rounded-full bg-emerald-500" />
              </div>
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                Formative learning. Instant "Check Answer" button, green/red feedback, worked solutions & retries.
              </p>
            </button>

            <button
              type="button"
              onClick={() => setAssessmentMode('revision')}
              className={`p-3.5 rounded-2xl border text-left transition-all cursor-pointer ${
                assessmentMode === 'revision'
                  ? 'border-indigo-500 bg-indigo-500/10 ring-2 ring-indigo-500/20'
                  : 'border-border bg-card hover:border-border/80'
              }`}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-bold text-foreground">Revision Mode</span>
                <span className="w-2 h-2 rounded-full bg-indigo-500" />
              </div>
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                Spaced memory reinforcement targeting previous mistakes and updating your Leitner mastery tiers.
              </p>
            </button>
          </div>
        </div>

        {error && (
          <div className="p-3 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-xs">
            {error}
          </div>
        )}

        {/* Specs Overview */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <div className="p-4 rounded-xl bg-background border border-border">
            <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider block">Questions</span>
            <span className="text-xl font-bold text-primary mt-1 block">
              {effectiveCount} <span className="text-xs font-normal text-muted-foreground">of {totalAvailable}</span>
            </span>
          </div>

          <div className="p-4 rounded-xl bg-background border border-border">
            <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider block">Time Limit</span>
            <span className="text-xl font-bold text-foreground mt-1 block">
              {quiz.timing_mode === 'untimed'
                ? 'Untimed'
                : quiz.duration_minutes
                ? `${quiz.duration_minutes} Mins`
                : `${quiz.per_question_seconds}s / Question`}
            </span>
          </div>

          <div className="p-4 rounded-xl bg-background border border-border">
            <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider block">Marking</span>
            <span className="text-xl font-bold text-foreground mt-1 block">
              +{quiz.positive_marks} / -{quiz.negative_marks}
            </span>
          </div>
        </div>

        {/* QUESTION SELECTION MODE TABS: Count-based vs Specific Question Checklist */}
        <div className="p-5 rounded-2xl bg-primary/5 border border-primary/20 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-primary/10 pb-3">
            <div className="flex items-center gap-2">
              <Sliders className="w-4 h-4 text-primary" />
              <h4 className="text-xs font-bold text-foreground uppercase tracking-wider">
                Question Selection Method
              </h4>
            </div>

            <div className="flex items-center gap-1 bg-background p-1 rounded-xl border border-border">
              <button
                type="button"
                onClick={() => setSelectionMode('count')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  selectionMode === 'count'
                    ? 'bg-primary text-primary-foreground shadow-xs'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                Preset Count ({selectedQuestionCount})
              </button>
              <button
                type="button"
                onClick={() => setSelectionMode('specific')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  selectionMode === 'specific'
                    ? 'bg-primary text-primary-foreground shadow-xs'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                Select Specific Questions ({selectedSpecificQIds.length})
              </button>
            </div>
          </div>

          {/* MODE 1: PRESET COUNT */}
          {selectionMode === 'count' && (
            <div className="space-y-3">
              <p className="text-xs text-muted-foreground">
                Choose how many questions to appear in your assessment session from the {totalAvailable} questions in the bank.
              </p>

              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 pt-1">
                {[
                  { id: '10', label: '10 Qs', max: 10 },
                  { id: '25', label: '25 Qs', max: 25 },
                  { id: '50', label: '50 Qs', max: 50 },
                  { id: 'all', label: `All (${totalAvailable})`, max: totalAvailable },
                  { id: 'custom', label: 'Custom', max: totalAvailable }
                ].map(opt => {
                  const isSelected = countMode === opt.id;
                  const isDisabled = opt.id !== 'all' && opt.id !== 'custom' && totalAvailable < opt.max;
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      disabled={isDisabled}
                      onClick={() => handleSelectCountMode(opt.id as any)}
                      className={`py-2 px-3 rounded-xl text-xs font-semibold border transition-all ${
                        isSelected
                          ? 'border-primary bg-primary text-primary-foreground shadow-xs font-bold'
                          : isDisabled
                          ? 'border-border bg-muted/30 text-muted-foreground opacity-40 cursor-not-allowed'
                          : 'border-border bg-card hover:border-primary/40 text-foreground'
                      }`}
                    >
                      {opt.label}
                    </button>
                  );
                })}
              </div>

              {countMode === 'custom' && (
                <div className="pt-2 flex flex-col sm:flex-row items-center gap-3 bg-card p-3 rounded-xl border border-border">
                  <span className="text-xs text-muted-foreground whitespace-nowrap">Enter custom count:</span>
                  <input
                    type="number"
                    min="1"
                    max={totalAvailable}
                    value={customInputVal}
                    onChange={e => handleCustomInputChange(e.target.value)}
                    className="w-24 px-3 py-1.5 rounded-lg bg-background border border-input text-foreground text-sm font-mono font-bold text-center focus:ring-2 focus:ring-primary/40"
                  />
                  <input
                    type="range"
                    min="1"
                    max={totalAvailable}
                    value={selectedQuestionCount}
                    onChange={e => handleCustomInputChange(e.target.value)}
                    className="flex-1 accent-primary cursor-pointer w-full"
                  />
                  <span className="text-xs font-mono text-muted-foreground whitespace-nowrap">
                    max {totalAvailable}
                  </span>
                </div>
              )}
            </div>
          )}

          {/* MODE 2: INTERACTIVE SPECIFIC QUESTIONS CHECKLIST */}
          {selectionMode === 'specific' && (
            <div className="space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <p className="text-xs text-muted-foreground">
                  Check or uncheck individual questions below. The assessment will start containing <strong>only</strong> your chosen questions.
                </p>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={selectAllFiltered}
                    className="text-xs font-semibold text-primary hover:underline px-2.5 py-1 rounded-lg hover:bg-primary/10 transition-colors"
                  >
                    Toggle Visible ({filteredQuestions.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedSpecificQIds([])}
                    className="text-xs font-semibold text-muted-foreground hover:text-foreground px-2.5 py-1 rounded-lg border border-border hover:bg-muted transition-colors"
                  >
                    Clear All
                  </button>
                </div>
              </div>

              {/* Category Filter Pills */}
              <div className="flex flex-wrap items-center gap-1.5 pt-1">
                {CATEGORY_GROUPS.map(grp => {
                  const count = grp.id === 'all'
                    ? questions.length
                    : questions.filter(q => grp.types.includes(q.question_type)).length;
                  const isActive = filterCategory === grp.id;
                  return (
                    <button
                      key={grp.id}
                      type="button"
                      onClick={() => setFilterCategory(grp.id)}
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-medium transition-all ${
                        isActive
                          ? 'bg-primary text-primary-foreground font-semibold shadow-xs'
                          : 'bg-background border border-border text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      {grp.label} ({count})
                    </button>
                  );
                })}
              </div>

              {/* Search & Type filter */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                <div className="relative">
                  <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <input
                    type="text"
                    value={filterSearch}
                    onChange={e => setFilterSearch(e.target.value)}
                    placeholder="Search question statements..."
                    className="w-full pl-8 pr-3 py-1.5 rounded-lg bg-background border border-input text-foreground text-xs"
                  />
                </div>

                <select
                  value={filterType}
                  onChange={e => setFilterType(e.target.value)}
                  className="px-2.5 py-1.5 rounded-lg bg-background border border-input text-foreground text-xs"
                >
                  <option value="all">All 14 Question Types</option>
                  <optgroup label="Choice & Logic">
                    <option value="single_choice">Single Choice (MCQ)</option>
                    <option value="multiple_choice">Multiple Select</option>
                    <option value="true_false">True / False</option>
                    <option value="assertion_reasoning">Assertion & Reasoning</option>
                  </optgroup>
                  <optgroup label="Text & Math">
                    <option value="fill_in_the_blank">Fill in the Blanks</option>
                    <option value="short_answer">Short Answer</option>
                    <option value="numerical">Numerical</option>
                  </optgroup>
                  <optgroup label="Relational & Sequence">
                    <option value="match_the_following">Match the Following</option>
                    <option value="arrange_in_order">Arrange in Order</option>
                  </optgroup>
                  <optgroup label="Coding & Technical">
                    <option value="coding">Live Coding Challenge</option>
                    <option value="code_output">Code Output</option>
                    <option value="code_debug">Code Debugging</option>
                    <option value="code_writing">Code Writing</option>
                  </optgroup>
                  <optgroup label="Subjective">
                    <option value="descriptive">Descriptive</option>
                  </optgroup>
                </select>
              </div>

              {/* Scrollable Questions Checklist Container */}
              <div className="max-h-72 overflow-y-auto space-y-2 pr-1 border border-border/80 rounded-xl p-2 bg-background/50 scrollbar-thin">
                {filteredQuestions.length === 0 ? (
                  <div className="p-6 text-center text-xs text-muted-foreground">
                    No questions match your current filters.
                  </div>
                ) : (
                  filteredQuestions.map((q, idx) => {
                    const isChecked = selectedSpecificQIds.includes(q.id);
                    return (
                      <div
                        key={q.id}
                        onClick={() => toggleSpecificQuestion(q.id)}
                        className={`p-3 rounded-xl border text-left cursor-pointer transition-all flex items-start gap-3 ${
                          isChecked
                            ? 'bg-primary/10 border-primary shadow-xs'
                            : 'bg-card border-border hover:border-primary/40'
                        }`}
                      >
                        <div className="mt-0.5 text-primary">
                          {isChecked ? (
                            <CheckSquare className="w-4 h-4 fill-primary text-white" />
                          ) : (
                            <Square className="w-4 h-4 text-muted-foreground" />
                          )}
                        </div>

                        <div className="flex-1 min-w-0 space-y-1">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span className="font-mono text-[11px] font-bold text-foreground">
                              Q{idx + 1}
                            </span>
                            <span className="px-2 py-0.5 rounded text-[10px] font-semibold uppercase bg-muted text-muted-foreground">
                              {q.question_type.replace(/_/g, ' ')}
                            </span>
                            <span className={`px-2 py-0.5 rounded text-[10px] font-semibold uppercase ${
                              q.difficulty === 'hard'
                                ? 'bg-rose-500/10 text-rose-500'
                                : q.difficulty === 'medium'
                                ? 'bg-amber-500/10 text-amber-500'
                                : 'bg-emerald-500/10 text-emerald-500'
                            }`}>
                              {q.difficulty}
                            </span>
                            {q.section_name && (
                              <span className="text-[10px] text-muted-foreground">
                                • {q.section_name}
                              </span>
                            )}
                          </div>

                          <p className="text-xs text-foreground font-medium line-clamp-2 leading-relaxed">
                            {q.question_text}
                          </p>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              <div className="flex items-center justify-between text-xs text-muted-foreground pt-1">
                <span className="font-semibold text-primary">
                  {selectedSpecificQIds.length} of {questions.length} questions selected
                </span>
                <span>
                  {selectedSpecificQIds.length === 0 ? '⚠️ At least 1 question required' : 'Ready to start'}
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Assessment Instructions */}
        <div className="space-y-3 pt-2 border-t border-border">
          <h4 className="text-xs font-bold text-foreground uppercase tracking-wider">
            Important Instructions & Policies:
          </h4>
          <ul className="space-y-2 text-xs text-muted-foreground">
            <li className="flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" />
              <span>
                <strong>Authoritative Timers:</strong> The countdown is verified and synchronized with server UTC timestamps. Refreshing or reopening the browser will not reset the clock.
              </span>
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" />
              <span>
                <strong>Answer Auto-Save:</strong> Your submitted responses are saved to the persistent database as you navigate.
              </span>
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" />
              <span>
                <strong>Automatic Fullscreen:</strong> Your browser automatically shifts to full screen mode when you begin the assessment for a focused CBT exam experience.
              </span>
            </li>
            {quiz.negative_marks > 0 && (
              <li className="flex items-start gap-2 text-amber-500 font-medium">
                <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <span>
                  Negative marking is enabled (-{quiz.negative_marks} for each incorrect answer). Unanswered questions receive 0 marks.
                </span>
              </li>
            )}
            {quiz.mode === 'exam' && (
              <li className="flex items-start gap-2">
                <ShieldAlert className="w-4 h-4 text-rose-500 flex-shrink-0 mt-0.5" />
                <span>
                  In Exam Mode, correct answers and detailed explanations are sealed until your assessment is fully submitted.
                </span>
              </li>
            )}
          </ul>
        </div>

        {/* Start Button */}
        <div className="pt-4 border-t border-border flex items-center justify-between">
          <button
            onClick={() => navigate('/assessments')}
            className="text-xs font-semibold text-muted-foreground hover:text-foreground"
          >
            Cancel
          </button>

          <button
            onClick={handleStart}
            disabled={starting || effectiveCount === 0}
            className="inline-flex items-center space-x-2 px-6 py-3 rounded-xl text-sm font-semibold bg-primary hover:bg-primary-hover disabled:opacity-50 text-primary-foreground shadow-sm shadow-primary/20 transition-all cursor-pointer"
          >
            {starting ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                <span>Starting Session...</span>
              </>
            ) : (
              <>
                <Play className="w-4 h-4 fill-white" />
                <span>Begin Assessment ({effectiveCount} Qs)</span>
                <ArrowRight className="w-4 h-4 ml-1" />
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
