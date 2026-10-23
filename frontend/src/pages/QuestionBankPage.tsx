import React, { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  Search,
  Filter,
  Plus,
  Star,
  Copy,
  Trash2,
  Edit2,
  FileCheck2,
  Database,
  CheckSquare,
  Square,
  Sparkles,
  BookOpen,
  Play,
  Sliders,
  Code2
} from 'lucide-react';
import { api } from '../services/api';
import { Question, QuestionBank, Subject, Topic, QuestionType, Difficulty } from '../types';
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

export const QuestionBankPage: React.FC = () => {
  const navigate = useNavigate();
  const [questions, setQuestions] = useState<Question[]>([]);
  const [banks, setBanks] = useState<QuestionBank[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [topics, setTopics] = useState<Topic[]>([]);
  
  // Filters
  const [search, setSearch] = useState('');
  const [selectedDifficulty, setSelectedDifficulty] = useState<string>('');
  const [selectedType, setSelectedType] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [onlyFavorites, setOnlyFavorites] = useState(false);
  const [selectedSubjectId, setSelectedSubjectId] = useState<string>('');
  
  // Selection for assessment creation
  const [selectedQIds, setSelectedQIds] = useState<number[]>([]);
  const [loading, setLoading] = useState(true);
  const [startingQuickTest, setStartingQuickTest] = useState(false);

  const loadData = () => {
    setLoading(true);
    Promise.all([
      api.getQuestions({
        search: search || undefined,
        difficulty: selectedDifficulty || undefined,
        question_type: selectedType || undefined,
        is_favorite: onlyFavorites ? true : undefined,
        subject_id: selectedSubjectId ? parseInt(selectedSubjectId) : undefined
      }),
      api.getBanks(),
      api.getSubjects(),
      api.getTopics()
    ])
      .then(([qList, bList, sList, tList]) => {
        setQuestions(qList);
        setBanks(bList);
        setSubjects(sList);
        setTopics(tList);
      })
      .catch(err => console.error(err))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadData();
  }, [selectedDifficulty, selectedType, onlyFavorites, selectedSubjectId]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    loadData();
  };

  const toggleSelect = (id: number) => {
    if (selectedQIds.includes(id)) {
      setSelectedQIds(selectedQIds.filter(x => x !== id));
    } else {
      setSelectedQIds([...selectedQIds, id]);
    }
  };

  // Filter questions by Category client-side if a category is selected
  const displayedQuestions = questions.filter(q => {
    if (selectedCategory !== 'all') {
      const grp = CATEGORY_GROUPS.find(g => g.id === selectedCategory);
      if (grp && !grp.types.includes(q.question_type)) {
        return false;
      }
    }
    return true;
  });

  const selectAll = () => {
    const displayedIds = displayedQuestions.map(q => q.id);
    const allSelected = displayedIds.every(id => selectedQIds.includes(id));
    if (allSelected) {
      setSelectedQIds(selectedQIds.filter(id => !displayedIds.includes(id)));
    } else {
      setSelectedQIds(Array.from(new Set([...selectedQIds, ...displayedIds])));
    }
  };

  const handleDelete = async (id: number) => {
    try {
      await api.deleteQuestion(id);
      setQuestions(questions.filter(q => q.id !== id));
      setSelectedQIds(selectedQIds.filter(x => x !== id));
    } catch (err: any) {
      alert(`Delete failed: ${err.message}`);
    }
  };

  const handleBulkDelete = async () => {
    if (selectedQIds.length === 0) return;
    if (!window.confirm(`Delete ${selectedQIds.length} selected questions?`)) return;
    try {
      await api.batchDeleteQuestions(selectedQIds);
      setQuestions(questions.filter(q => !selectedQIds.includes(q.id)));
      setSelectedQIds([]);
    } catch (err: any) {
      alert(`Bulk delete failed: ${err.message}`);
    }
  };

  const handleClearAll = async () => {
    if (!window.confirm('Delete ALL questions from the system?')) return;
    try {
      await api.clearAllQuestions();
      setQuestions([]);
      setSelectedQIds([]);
    } catch (err: any) {
      alert(`Clear all failed: ${err.message}`);
    }
  };

  const handleDuplicate = async (id: number) => {
    const dup = await api.duplicateQuestion(id);
    setQuestions([dup, ...questions]);
  };

  const handleToggleFav = async (id: number) => {
    const updated = await api.toggleFavorite(id);
    setQuestions(questions.map(q => q.id === id ? updated : q));
  };

  // FAST 1-CLICK TEST START WITH SELECTED QUESTIONS
  const handleStartQuickTest = async () => {
    // 1. GUARANTEED AUTOMATIC FULLSCREEN: Execute synchronously on line 1 within user gesture!
    enterFullScreen();

    if (selectedQIds.length === 0) return;
    setStartingQuickTest(true);

    try {
      // Create a rapid practice assessment containing precisely the selected question IDs
      const newQuiz = await api.createQuiz({
        title: `Question Bank Test (${selectedQIds.length} Questions)`,
        description: `Assessment launched with ${selectedQIds.length} selected questions from the Question Bank.`,
        mode: 'practice',
        timing_mode: 'untimed',
        question_ids: selectedQIds,
        question_count_to_present: selectedQIds.length,
        positive_marks: 1.0,
        negative_marks: 0.0
      });

      const session = await api.startSession(newQuiz.id, selectedQIds.length, selectedQIds);
      navigate(`/session/${session.session_token}`);
    } catch (err: any) {
      alert(`Could not start assessment: ${err.message}`);
      setStartingQuickTest(false);
    }
  };

  const handleCustomizeAttempt = async () => {
    if (selectedQIds.length === 0) return;
    try {
      const newQuiz = await api.createQuiz({
        title: `Custom Test (${selectedQIds.length} Questions)`,
        description: `Custom assessment with ${selectedQIds.length} questions from Question Bank.`,
        mode: 'practice',
        timing_mode: 'untimed',
        question_ids: selectedQIds,
        question_count_to_present: selectedQIds.length,
        positive_marks: 1.0,
        negative_marks: 0.0
      });
      navigate(`/assessments/${newQuiz.id}/instructions`, { state: { selectedQIds } });
    } catch (err: any) {
      alert(`Error: ${err.message}`);
    }
  };

  const handleCreateAssessmentFromSelected = () => {
    if (selectedQIds.length === 0) return;
    sessionStorage.setItem('quizforge_builder_selected_qids', JSON.stringify(selectedQIds));
    navigate('/builder');
  };

  const getTypeBadgeClass = (type: string) => {
    if (['coding', 'code_output', 'code_debug', 'code_writing'].includes(type)) {
      return 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20';
    }
    if (['match_the_following', 'arrange_in_order'].includes(type)) {
      return 'bg-amber-500/10 text-amber-500 border border-amber-500/20';
    }
    if (['fill_in_the_blank', 'short_answer', 'numerical'].includes(type)) {
      return 'bg-teal-500/10 text-teal-500 border border-teal-500/20';
    }
    if (type === 'assertion_reasoning') {
      return 'bg-indigo-500/10 text-indigo-500 border border-indigo-500/20';
    }
    if (type === 'descriptive') {
      return 'bg-fuchsia-500/10 text-fuchsia-500 border border-fuchsia-500/20';
    }
    return 'bg-sky-500/10 text-sky-500 border border-sky-500/20';
  };

  return (
    <div className="space-y-6 animate-fadeIn pb-16">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-foreground">
            Question Bank
          </h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            All 14 question types across Choice, Math, Sequences, Coding, and Subjective categories.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {questions.length > 0 && (
            <button
              onClick={handleClearAll}
              className="inline-flex items-center space-x-1 px-3 py-2 rounded-xl text-xs font-semibold text-destructive hover:bg-destructive/10 border border-destructive/20 transition-all"
              title="Delete all questions"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Clear All ({questions.length})</span>
            </button>
          )}

          {selectedQIds.length > 0 && (
            <>
              {/* PRIMARY ACTION: START TEST WITH SELECTED */}
              <button
                onClick={handleStartQuickTest}
                disabled={startingQuickTest}
                className="inline-flex items-center space-x-2 px-4 py-2 rounded-xl text-xs font-bold bg-primary hover:bg-primary-hover text-primary-foreground shadow-sm shadow-primary/20 transition-all cursor-pointer"
              >
                {startingQuickTest ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Launching...</span>
                  </>
                ) : (
                  <>
                    <Play className="w-3.5 h-3.5 fill-white" />
                    <span>Start Test with Selected ({selectedQIds.length})</span>
                  </>
                )}
              </button>

              <button
                onClick={handleCustomizeAttempt}
                className="inline-flex items-center space-x-1.5 px-3 py-2 rounded-xl text-xs font-semibold bg-secondary hover:bg-muted text-secondary-foreground border border-border shadow-sm transition-all"
                title="Configure instructions, timers, or marking"
              >
                <Sliders className="w-3.5 h-3.5 text-primary" />
                <span>Configure ({selectedQIds.length})</span>
              </button>

              <button
                onClick={handleCreateAssessmentFromSelected}
                className="inline-flex items-center space-x-1.5 px-3 py-2 rounded-xl text-xs font-semibold bg-secondary hover:bg-muted text-secondary-foreground border border-border shadow-sm transition-all"
              >
                <FileCheck2 className="w-3.5 h-3.5 text-primary" />
                <span>Save to Assessment ({selectedQIds.length})</span>
              </button>

              <button
                onClick={handleBulkDelete}
                className="inline-flex items-center space-x-1 px-3 py-2 rounded-xl text-xs font-semibold bg-destructive/10 text-destructive hover:bg-destructive/20 border border-destructive/20 transition-all"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Delete ({selectedQIds.length})</span>
              </button>
            </>
          )}

          <Link
            to="/assessments"
            className="inline-flex items-center space-x-2 px-4 py-2 rounded-xl text-xs font-semibold bg-secondary hover:bg-muted text-secondary-foreground border border-border shadow-sm transition-all"
          >
            <BookOpen className="w-3.5 h-3.5" />
            <span>Assessments Hub</span>
          </Link>
        </div>
      </div>

      {/* Category Pills Navigation */}
      <div className="p-3 rounded-2xl bg-card border border-border shadow-sm space-y-2">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-xs font-semibold text-muted-foreground mr-1">Categories:</span>
          {CATEGORY_GROUPS.map(grp => {
            const count = grp.id === 'all'
              ? questions.length
              : questions.filter(q => grp.types.includes(q.question_type)).length;
            const isActive = selectedCategory === grp.id;
            return (
              <button
                key={grp.id}
                onClick={() => setSelectedCategory(grp.id)}
                className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-colors ${
                  isActive
                    ? 'bg-primary text-primary-foreground font-semibold shadow-xs'
                    : 'bg-muted/50 text-muted-foreground hover:text-foreground'
                }`}
              >
                {grp.label} ({count})
              </button>
            );
          })}
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="p-4 rounded-2xl bg-card border border-border shadow-sm space-y-3">
        <form onSubmit={handleSearchSubmit} className="flex gap-2">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search question statements, explanations, topics, tags..."
              className="w-full pl-9 pr-4 py-2 rounded-xl bg-background border border-input text-foreground text-xs focus:ring-2 focus:ring-primary/40"
            />
          </div>
          <button
            type="submit"
            className="px-4 py-2 rounded-xl text-xs font-semibold bg-secondary hover:bg-muted text-secondary-foreground border border-border"
          >
            Search
          </button>
        </form>

        <div className="flex flex-wrap items-center gap-2 pt-1 text-xs">
          {/* Difficulty filter */}
          <select
            value={selectedDifficulty}
            onChange={e => setSelectedDifficulty(e.target.value)}
            className="px-2.5 py-1.5 rounded-lg bg-background border border-input text-foreground text-xs"
          >
            <option value="">All Difficulties</option>
            <option value="easy">Easy</option>
            <option value="medium">Medium</option>
            <option value="hard">Hard</option>
          </select>

          {/* Type filter with ALL 14 QUESTION TYPES */}
          <select
            value={selectedType}
            onChange={e => setSelectedType(e.target.value)}
            className="px-2.5 py-1.5 rounded-lg bg-background border border-input text-foreground text-xs"
          >
            <option value="">All 14 Question Types</option>
            <optgroup label="Choice & Logic">
              <option value="single_choice">Single MCQ</option>
              <option value="multiple_choice">Multiple Select</option>
              <option value="true_false">True / False</option>
              <option value="assertion_reasoning">Assertion & Reasoning</option>
            </optgroup>
            <optgroup label="Text Entry & Math">
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

          {/* Subject filter */}
          {subjects.length > 0 && (
            <select
              value={selectedSubjectId}
              onChange={e => setSelectedSubjectId(e.target.value)}
              className="px-2.5 py-1.5 rounded-lg bg-background border border-input text-foreground text-xs"
            >
              <option value="">All Subjects</option>
              {subjects.map(s => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          )}

          {/* Favorite toggle button */}
          <button
            type="button"
            onClick={() => setOnlyFavorites(!onlyFavorites)}
            className={`flex items-center space-x-1 px-3 py-1.5 rounded-lg border text-xs transition-colors ${
              onlyFavorites
                ? 'bg-amber-500/10 border-amber-500/30 text-amber-500 font-semibold'
                : 'border-input text-muted-foreground hover:text-foreground'
            }`}
          >
            <Star className={`w-3.5 h-3.5 ${onlyFavorites ? 'fill-amber-500' : ''}`} />
            <span>Favorites</span>
          </button>

          {(selectedDifficulty || selectedType || selectedCategory !== 'all' || onlyFavorites || selectedSubjectId || search) && (
            <button
              type="button"
              onClick={() => {
                setSelectedDifficulty('');
                setSelectedType('');
                setSelectedCategory('all');
                setOnlyFavorites(false);
                setSelectedSubjectId('');
                setSearch('');
              }}
              className="text-primary hover:underline ml-auto"
            >
              Reset Filters
            </button>
          )}
        </div>
      </div>

      {/* Select All Bar */}
      {displayedQuestions.length > 0 && (
        <div className="flex items-center justify-between px-2 text-xs text-muted-foreground">
          <button
            onClick={selectAll}
            className="flex items-center space-x-2 hover:text-foreground transition-colors"
          >
            {displayedQuestions.every(q => selectedQIds.includes(q.id)) ? (
              <CheckSquare className="w-4 h-4 text-primary" />
            ) : (
              <Square className="w-4 h-4" />
            )}
            <span>Select all ({displayedQuestions.length} questions shown)</span>
          </button>
          <span className="font-semibold text-primary">{selectedQIds.length} selected</span>
        </div>
      )}

      {/* Questions List */}
      {loading ? (
        <div className="flex items-center justify-center min-h-[300px]">
          <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      ) : displayedQuestions.length === 0 ? (
        <div className="p-12 text-center rounded-2xl bg-card border border-dashed border-border space-y-3">
          <Database className="w-10 h-10 mx-auto text-muted-foreground mb-2" />
          <h3 className="text-sm font-semibold text-foreground">No questions found</h3>
          <p className="text-xs text-muted-foreground max-w-sm mx-auto">
            Try adjusting your search criteria, import questions from documents, or generate new ones using AI.
          </p>
          <div className="pt-2 flex justify-center gap-3">
            <Link
              to="/imports"
              className="px-4 py-2 rounded-xl text-xs font-semibold bg-secondary hover:bg-muted text-secondary-foreground border border-border"
            >
              Import Questions
            </Link>
            <Link
              to="/create-assessment?tab=ai"
              className="px-4 py-2 rounded-xl text-xs font-semibold bg-primary hover:bg-primary-hover text-primary-foreground"
            >
              Generate with Gemini
            </Link>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {displayedQuestions.map((q, idx) => {
            const isSelected = selectedQIds.includes(q.id);
            return (
              <div
                key={q.id}
                className={`p-5 rounded-2xl bg-card border transition-all ${
                  isSelected ? 'border-primary ring-1 ring-primary/20 bg-primary/5' : 'border-border hover:border-primary/40'
                }`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-center gap-2.5">
                    <button
                      onClick={() => toggleSelect(q.id)}
                      className="text-muted-foreground hover:text-foreground cursor-pointer"
                    >
                      {isSelected ? (
                        <CheckSquare className="w-4 h-4 text-primary" />
                      ) : (
                        <Square className="w-4 h-4" />
                      )}
                    </button>
                    <span className="flex items-center justify-center w-6 h-6 rounded-lg bg-muted text-foreground text-xs font-bold font-mono">
                      {idx + 1}
                    </span>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-semibold uppercase ${getTypeBadgeClass(q.question_type)}`}>
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
                    <span className="text-xs text-muted-foreground">
                      {q.points} pt{q.points > 1 ? 's' : ''}
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => handleToggleFav(q.id)}
                      className={`p-1.5 rounded-lg transition-colors ${
                        q.is_favorite ? 'text-amber-500' : 'text-muted-foreground hover:text-foreground'
                      }`}
                      title={q.is_favorite ? 'Remove favorite' : 'Add to favorites'}
                    >
                      <Star className={`w-4 h-4 ${q.is_favorite ? 'fill-amber-500' : ''}`} />
                    </button>
                    <button
                      onClick={() => handleDuplicate(q.id)}
                      className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted"
                      title="Duplicate question"
                    >
                      <Copy className="w-4 h-4" />
                    </button>
                    <Link
                      to={`/questions/${q.id}/edit`}
                      className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted"
                      title="Edit question"
                    >
                      <Edit2 className="w-4 h-4" />
                    </Link>
                    <button
                      onClick={() => handleDelete(q.id)}
                      className="p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                      title="Delete question"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <p className="text-sm font-medium text-foreground mt-3 leading-relaxed whitespace-pre-wrap">
                  {q.question_text}
                </p>

                {/* Options display for multiple/single choice */}
                {q.options && q.options.length > 0 && (
                  <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {q.options.map(opt => {
                      const isCorrect = Array.isArray(q.correct_answer)
                        ? q.correct_answer.includes(opt.id)
                        : String(q.correct_answer) === opt.id;
                      return (
                        <div
                          key={opt.id}
                          className={`px-3 py-2 rounded-xl text-xs flex items-center gap-2.5 border ${
                            isCorrect
                              ? 'border-emerald-500/40 bg-emerald-500/5 text-foreground font-medium'
                              : 'border-border bg-background/50 text-muted-foreground'
                          }`}
                        >
                          <span className={`w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-bold ${
                            isCorrect ? 'bg-emerald-500 text-white' : 'bg-muted text-muted-foreground'
                          }`}>
                            {opt.id}
                          </span>
                          <span className="truncate flex-1">{opt.text}</span>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Live Coding / Technical Question details */}
                {q.question_type === 'coding' && (
                  <div className="mt-3 p-3 rounded-xl bg-slate-900 border border-slate-800 text-xs text-slate-300 font-mono flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Code2 className="w-4 h-4 text-emerald-400" />
                      <span>Language: {q.metadata_extra?.language || 'python'}</span>
                      {q.metadata_extra?.expected_fn && (
                        <span>• Target: <span className="text-amber-300 font-bold">{q.metadata_extra.expected_fn}()</span></span>
                      )}
                    </div>
                    <span className="text-[11px] text-slate-400">
                      {(q.metadata_extra?.test_cases || []).length} Test Cases
                    </span>
                  </div>
                )}

                {/* Footer Reference & Explanation */}
                <div className="mt-3 pt-3 border-t border-border flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-muted-foreground">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-foreground">Answer / Target:</span>
                    <span className="px-2 py-0.5 rounded bg-primary/10 text-primary font-mono font-semibold max-w-sm truncate">
                      {Array.isArray(q.correct_answer)
                        ? q.correct_answer.join(', ')
                        : typeof q.correct_answer === 'object' && q.correct_answer !== null
                        ? JSON.stringify(q.correct_answer)
                        : String(q.correct_answer || 'Specified Solution')}
                    </span>
                    {q.source_ref && (
                      <span className="italic">({q.source_ref})</span>
                    )}
                  </div>
                  {q.explanation && (
                    <span className="truncate max-w-md">
                      {q.explanation}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
