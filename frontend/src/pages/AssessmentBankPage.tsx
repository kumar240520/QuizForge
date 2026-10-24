import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  ArrowLeft,
  Plus,
  Trash2,
  Copy,
  Edit2,
  Clock,
  Sparkles,
  UploadCloud,
  CheckSquare,
  Square,
  Layers,
  FolderPlus,
  Play,
  Filter,
  CheckCircle2,
  AlertCircle,
  Sliders
} from 'lucide-react';
import { api } from '../services/api';
import { Quiz, Question, QuestionType, Difficulty } from '../types';
import { sanitizeText } from '../utils/textSanitizer';
import { enterFullScreen } from '../utils/fullscreen';

export const AssessmentBankPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const quizId = Number(id);
  const navigate = useNavigate();

  const [quiz, setQuiz] = useState<Quiz | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Active section tab ('all' or section name)
  const [activeSection, setActiveSection] = useState<string>('all');
  // Selected question type filter
  const [selectedType, setSelectedType] = useState<string>('all');
  // Selected question IDs for bulk actions
  const [selectedQIds, setSelectedQIds] = useState<number[]>([]);

  // Add section modal/input
  const [showAddSection, setShowAddSection] = useState(false);
  const [newSectionName, setNewSectionName] = useState('');

  const loadData = async () => {
    if (!quizId) return;
    setLoading(true);
    try {
      const [quizData, questionsData] = await Promise.all([
        api.getQuiz(quizId),
        api.getQuizQuestions(quizId)
      ]);
      setQuiz(quizData);
      setQuestions(questionsData);
    } catch (err: any) {
      setError(err.message || 'Failed to load assessment questions.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [quizId]);

  const showToast = (msg: string) => {
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(null), 3000);
  };

  // Extract unique sections
  const sectionsList: string[] = React.useMemo(() => {
    const fromQuiz = (quiz?.sections || []).map(s => s.name);
    const fromQuestions = questions.map(q => q.section_name || 'General');
    const combined = Array.from(new Set([...fromQuiz, ...fromQuestions].filter(Boolean)));
    return combined.length > 0 ? combined : ['General'];
  }, [quiz, questions]);

  // Filter questions based on active section and type
  const filteredQuestions = questions.filter(q => {
    const qSec = q.section_name || 'General';
    if (activeSection !== 'all' && qSec !== activeSection) return false;
    if (selectedType !== 'all' && q.question_type !== selectedType) return false;
    return true;
  });

  // 1-Click Delete Question
  const handleDeleteQuestion = async (qId: number) => {
    try {
      await api.deleteQuestionFromQuiz(quizId, qId);
      setQuestions(prev => prev.filter(q => q.id !== qId));
      setSelectedQIds(prev => prev.filter(id => id !== qId));
      showToast('Question deleted successfully.');
    } catch (err: any) {
      alert(`Delete failed: ${err.message}`);
    }
  };

  // 1-Click Delete Entire Active Section
  const handleDeleteSection = async () => {
    if (activeSection === 'all') return;
    const count = questions.filter(q => (q.section_name || 'General') === activeSection).length;
    if (!window.confirm(`Delete section "${activeSection}" and all its ${count} questions?`)) {
      return;
    }
    try {
      await api.deleteSectionFromQuiz(quizId, activeSection);
      setQuestions(prev => prev.filter(q => (q.section_name || 'General') !== activeSection));
      setActiveSection('all');
      showToast(`Section "${activeSection}" deleted.`);
    } catch (err: any) {
      alert(`Section deletion failed: ${err.message}`);
    }
  };

  // Bulk Delete Selected Questions
  const handleBulkDelete = async () => {
    if (selectedQIds.length === 0) return;
    if (!window.confirm(`Delete ${selectedQIds.length} selected questions?`)) return;
    try {
      await api.batchDeleteQuestions(selectedQIds);
      setQuestions(prev => prev.filter(q => !selectedQIds.includes(q.id)));
      setSelectedQIds([]);
      showToast(`Deleted ${selectedQIds.length} questions.`);
    } catch (err: any) {
      alert(`Bulk delete failed: ${err.message}`);
    }
  };

  // Direct Launch with Selected Questions and Auto-Fullscreen
  const handleStartWithSelected = async () => {
    // 1. GUARANTEED AUTOMATIC FULLSCREEN: Execute synchronously on line 1 within user gesture!
    enterFullScreen();

    if (selectedQIds.length === 0) return;

    try {
      const session = await api.startSession(quizId, selectedQIds.length, selectedQIds);
      navigate(`/session/${session.session_token}`);
    } catch (err: any) {
      alert(`Could not start session: ${err.message}`);
    }
  };

  const handleConfigureWithSelected = () => {
    if (selectedQIds.length === 0) return;
    navigate(`/assessments/${quizId}/instructions`, { state: { selectedQIds } });
  };

  // Update Individual Question Timer inline
  const handleUpdateTimer = async (qId: number, seconds: number) => {
    try {
      await api.updateQuestion(qId, { per_question_timer: seconds });
      setQuestions(prev => prev.map(q => q.id === qId ? { ...q, per_question_timer: seconds } : q));
    } catch (err: any) {
      console.error('Failed to update timer:', err);
    }
  };

  // Add a new section
  const handleAddSection = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSectionName.trim()) return;
    const name = newSectionName.trim();
    const existing = quiz?.sections || [];
    if (!existing.some(s => s.name.toLowerCase() === name.toLowerCase())) {
      const updatedSections = [...existing, { name, description: '' }];
      await api.updateQuiz(quizId, { sections: updatedSections });
      setQuiz(prev => prev ? { ...prev, sections: updatedSections } : prev);
    }
    setActiveSection(name);
    setNewSectionName('');
    setShowAddSection(false);
    showToast(`Section "${name}" added.`);
  };

  // Selection toggle
  const toggleSelect = (id: number) => {
    setSelectedQIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const selectAll = () => {
    if (selectedQIds.length === filteredQuestions.length) {
      setSelectedQIds([]);
    } else {
      setSelectedQIds(filteredQuestions.map(q => q.id));
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!quiz) {
    return (
      <div className="p-8 text-center bg-card rounded-2xl border border-border">
        <p className="text-foreground">Assessment not found.</p>
        <Link to="/assessments" className="mt-4 inline-block text-xs text-primary hover:underline">
          Return to My Assessments
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fadeIn pb-24">
      {/* Toast Notification */}
      {successMsg && (
        <div className="fixed top-6 right-6 z-50 px-4 py-2.5 rounded-xl bg-emerald-500 text-white text-xs font-semibold shadow-lg flex items-center gap-2 animate-fadeIn">
          <CheckCircle2 className="w-4 h-4" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center space-x-3">
          <button
            onClick={() => navigate('/assessments')}
            className="p-2 rounded-xl bg-card border border-border text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-bold tracking-tight text-foreground">
                {quiz.title}
              </h2>
              <span className="px-2 py-0.5 rounded text-[10px] font-semibold uppercase bg-primary/10 text-primary">
                Individual Bank
              </span>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              Dedicated question bank with section navigation and individual question timers.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => navigate(`/assessments/${quiz.id}/edit`)}
            className="inline-flex items-center space-x-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-secondary hover:bg-muted text-foreground border border-border shadow-xs transition-colors"
            title="Edit Assessment Configurations & Rules"
          >
            <Sliders className="w-3.5 h-3.5 text-primary" />
            <span>Edit Settings</span>
          </button>
          <button
            onClick={() => navigate(`/assessments/${quiz.id}/instructions`)}
            className="inline-flex items-center space-x-1.5 px-4 py-2 rounded-xl text-xs font-semibold bg-primary hover:bg-primary-hover text-primary-foreground shadow-sm transition-all"
            title="Start Assessment"
          >
            <Play className="w-3.5 h-3.5" />
            <span>Start Assessment</span>
          </button>
        </div>
      </div>

      {/* Informative Guidance Banner */}
      <div className="p-4 rounded-2xl bg-primary/5 border border-primary/20 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2.5 text-foreground">
          <Layers className="w-4 h-4 text-primary shrink-0" />
          <span>
            <strong>Assessment Question Bank:</strong> Questions below belong solely to this assessment. You can divide questions into sections, configure individual question timers, and delete items with a single click.
          </span>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Link
            to={`/create-assessment?tab=ai&quiz_id=${quiz.id}&count=${quiz.question_count_to_present || quiz.question_ids?.length || 10}`}
            className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-card border border-border hover:border-primary/50 text-foreground font-semibold"
          >
            <Sparkles className="w-3 h-3 text-primary" />
            <span>Generate with AI</span>
          </Link>
          <Link
            to={`/imports?quiz_id=${quiz.id}${activeSection !== 'all' ? `&section=${encodeURIComponent(activeSection)}` : ''}`}
            className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-card border border-border hover:border-primary/50 text-foreground font-semibold"
          >
            <UploadCloud className="w-3 h-3 text-primary" />
            <span>Import Questions {activeSection !== 'all' ? `(${activeSection})` : 'PDF'}</span>
          </Link>
        </div>
      </div>

      {/* Section Navigation Tabs */}
      <div className="p-3 rounded-2xl bg-card border border-border shadow-sm space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border pb-3">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-xs font-semibold text-muted-foreground mr-1">Sections:</span>
            <button
              onClick={() => setActiveSection('all')}
              className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-colors ${
                activeSection === 'all'
                  ? 'bg-primary text-primary-foreground font-semibold shadow-xs'
                  : 'bg-muted/50 text-muted-foreground hover:text-foreground'
              }`}
            >
              All Questions ({questions.length})
            </button>
            {sectionsList.map(sec => {
              const count = questions.filter(q => (q.section_name || 'General') === sec).length;
              const isActive = activeSection === sec;
              return (
                <button
                  key={sec}
                  onClick={() => setActiveSection(sec)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-colors ${
                    isActive
                      ? 'bg-primary text-primary-foreground font-semibold shadow-xs'
                      : 'bg-muted/50 text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {sec} ({count})
                </button>
              );
            })}
          </div>

          <div className="flex items-center gap-2">
            {activeSection !== 'all' && (
              <>
                <button
                  onClick={() => navigate(`/imports?quiz_id=${quiz.id}&section=${encodeURIComponent(activeSection)}`)}
                  className="inline-flex items-center space-x-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-primary/10 hover:bg-primary/20 text-primary border border-primary/20 transition-colors"
                  title={`Import questions directly into section "${activeSection}"`}
                >
                  <UploadCloud className="w-3.5 h-3.5" />
                  <span>Import to {activeSection}</span>
                </button>
                <button
                  onClick={handleDeleteSection}
                  className="inline-flex items-center space-x-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-destructive hover:bg-destructive/10 border border-destructive/20 transition-colors"
                  title={`Delete entire section "${activeSection}"`}
                >
                  <Trash2 className="w-3 h-3" />
                  <span>Delete Section</span>
                </button>
              </>
            )}

            <button
              onClick={() => setShowAddSection(!showAddSection)}
              className="inline-flex items-center space-x-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-muted hover:bg-muted/80 text-foreground transition-colors"
            >
              <FolderPlus className="w-3.5 h-3.5 text-primary" />
              <span>New Section</span>
            </button>
          </div>
        </div>

        {/* New Section Inline Form */}
        {showAddSection && (
          <form onSubmit={handleAddSection} className="flex items-center gap-2 pt-1 animate-fadeIn">
            <input
              type="text"
              value={newSectionName}
              onChange={e => setNewSectionName(e.target.value)}
              placeholder="e.g. Section B: Technical Aptitude"
              className="px-3 py-1.5 rounded-xl bg-background border border-input text-xs text-foreground focus:ring-2 focus:ring-primary/40 flex-1"
              autoFocus
            />
            <button
              type="submit"
              className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-primary text-primary-foreground hover:bg-primary-hover"
            >
              Save Section
            </button>
            <button
              type="button"
              onClick={() => setShowAddSection(false)}
              className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-muted text-muted-foreground hover:text-foreground"
            >
              Cancel
            </button>
          </form>
        )}

        {/* Question Type Filter Bar: ALL 14 QUESTION TYPES */}
        <div className="flex flex-wrap items-center gap-1.5 text-xs pt-1">
          <span className="text-muted-foreground flex items-center gap-1 mr-1">
            <Filter className="w-3 h-3" />
            <span>Type:</span>
          </span>
          {[
            { id: 'all', label: 'All 14 Types' },
            { id: 'single_choice', label: 'Single MCQ' },
            { id: 'multiple_choice', label: 'Multi-Select' },
            { id: 'true_false', label: 'True/False' },
            { id: 'assertion_reasoning', label: 'Assertion/Reason' },
            { id: 'fill_in_the_blank', label: 'Fill Blank' },
            { id: 'short_answer', label: 'Short Ans' },
            { id: 'numerical', label: 'Numerical' },
            { id: 'match_the_following', label: 'Match' },
            { id: 'arrange_in_order', label: 'Order' },
            { id: 'coding', label: 'Live Coding' },
            { id: 'code_output', label: 'Code Output' },
            { id: 'code_debug', label: 'Code Debug' },
            { id: 'code_writing', label: 'Code Writing' },
            { id: 'descriptive', label: 'Descriptive' }
          ].map(t => (
            <button
              key={t.id}
              onClick={() => setSelectedType(t.id)}
              className={`px-2.5 py-1 rounded-lg text-[11px] transition-colors ${
                selectedType === t.id
                  ? 'bg-foreground text-background font-semibold shadow-xs'
                  : 'bg-muted/40 text-muted-foreground hover:text-foreground'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Select All & Action Bar */}
      {filteredQuestions.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 px-2 text-xs text-muted-foreground">
          <button
            onClick={selectAll}
            className="flex items-center space-x-2 hover:text-foreground transition-colors cursor-pointer"
          >
            {selectedQIds.length === filteredQuestions.length ? (
              <CheckSquare className="w-4 h-4 text-primary" />
            ) : (
              <Square className="w-4 h-4" />
            )}
            <span>Select all ({filteredQuestions.length} shown)</span>
          </button>

          {selectedQIds.length > 0 && (
            <div className="flex items-center gap-2">
              <button
                onClick={handleStartWithSelected}
                className="inline-flex items-center space-x-1.5 px-3.5 py-1.5 rounded-xl bg-primary text-primary-foreground text-xs font-bold hover:bg-primary-hover shadow-sm shadow-primary/20 transition-all cursor-pointer"
              >
                <Play className="w-3.5 h-3.5 fill-white" />
                <span>Start Test with Selected ({selectedQIds.length})</span>
              </button>

              <button
                onClick={handleConfigureWithSelected}
                className="inline-flex items-center space-x-1 px-3 py-1.5 rounded-xl bg-secondary text-secondary-foreground text-xs font-semibold hover:bg-muted border border-border shadow-xs transition-all"
              >
                <Sliders className="w-3.5 h-3.5 text-primary" />
                <span>Configure ({selectedQIds.length})</span>
              </button>

              <button
                onClick={handleBulkDelete}
                className="inline-flex items-center space-x-1 px-2.5 py-1.5 rounded-xl bg-destructive/10 text-destructive text-xs font-semibold hover:bg-destructive/20 border border-destructive/20 transition-all"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Delete ({selectedQIds.length})</span>
              </button>
            </div>
          )}
        </div>
      )}

      {/* Question List */}
      {filteredQuestions.length === 0 ? (
        <div className="p-12 text-center rounded-2xl bg-card border border-dashed border-border space-y-3">
          <Layers className="w-10 h-10 mx-auto text-muted-foreground mb-2" />
          <h3 className="text-sm font-semibold text-foreground">No questions in this section</h3>
          <p className="text-xs text-muted-foreground max-w-sm mx-auto">
            Add questions using Gemini AI, import a PDF document, or create questions manually.
          </p>
          <div className="pt-2 flex justify-center gap-3">
            <Link
              to={`/create-assessment?tab=ai&quiz_id=${quiz.id}&count=${quiz.question_count_to_present || quiz.question_ids?.length || 10}`}
              className="px-4 py-2 rounded-xl text-xs font-semibold bg-primary hover:bg-primary-hover text-primary-foreground shadow-sm"
            >
              Generate with Gemini AI
            </Link>
            <Link
              to={`/imports?quiz_id=${quiz.id}`}
              className="px-4 py-2 rounded-xl text-xs font-semibold bg-secondary hover:bg-muted text-secondary-foreground border border-border"
            >
              Import PDF Questions
            </Link>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredQuestions.map((q, idx) => {
            const isSelected = selectedQIds.includes(q.id);
            return (
              <div
                key={q.id}
                className={`p-5 rounded-2xl bg-card border transition-all ${
                  isSelected ? 'border-primary ring-1 ring-primary/20 bg-primary/5' : 'border-border hover:border-primary/40'
                }`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      onClick={() => toggleSelect(q.id)}
                      className="text-muted-foreground hover:text-foreground"
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
                    <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-primary/10 text-primary">
                      {q.section_name || 'General'}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {q.points} pt{q.points > 1 ? 's' : ''}
                    </span>
                  </div>

                  <div className="flex items-center gap-3">
                    {/* Individual Question Timer */}
                    <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-muted/50 border border-border text-xs text-muted-foreground">
                      <Clock className="w-3.5 h-3.5 text-primary" />
                      <span>Timer:</span>
                      <input
                        type="number"
                        min="10"
                        max="600"
                        defaultValue={q.per_question_timer || 60}
                        onBlur={e => handleUpdateTimer(q.id, parseInt(e.target.value) || 60)}
                        className="w-12 px-1 py-0.5 rounded bg-background border border-input text-foreground text-center font-mono text-xs"
                      />
                      <span>s</span>
                    </div>

                    {/* Single-Click 1-Click Delete Button */}
                    <button
                      onClick={() => handleDeleteQuestion(q.id)}
                      className="p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                      title="1-Click Delete Question"
                    >
                      <Trash2 className="w-4 h-4 text-destructive" />
                    </button>
                  </div>
                </div>

                <p className="text-sm font-medium text-foreground mt-3 leading-relaxed whitespace-pre-wrap">
                  {sanitizeText(q.question_text)}
                </p>

                {/* Options display */}
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
                          <span className="truncate flex-1">{sanitizeText(opt.text)}</span>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Answer and Explanation */}
                <div className="mt-3 pt-3 border-t border-border flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-muted-foreground">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-foreground">Answer:</span>
                    <span className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-mono font-semibold">
                      {Array.isArray(q.correct_answer) ? q.correct_answer.join(', ') : String(q.correct_answer)}
                    </span>
                    {q.source_ref && (
                      <span className="italic text-muted-foreground/80">({q.source_ref})</span>
                    )}
                  </div>
                  {q.explanation && (
                    <span className="truncate max-w-md text-muted-foreground">
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
