import React, { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  UploadCloud,
  Sparkles,
  BookOpen,
  ArrowRight,
  FileText,
  Layers,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import { api } from '../services/api';
import { QuestionType, Difficulty } from '../types';
import { GeminiKeyModal } from '../components/GeminiKeyModal';

export const CreateAssessmentWizard: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const initialMode = (searchParams.get('tab') as 'import' | 'ai' | 'source') || 'import';
  
  const [mode, setMode] = useState<'import' | 'ai' | 'source'>(initialMode);
  const [showKeyModal, setShowKeyModal] = useState(false);
  const [userApiKey, setUserApiKey] = useState<string>(() => localStorage.getItem('quizforge_user_gemini_key') || '');
  
  // AI topic form state
  const [subject, setSubject] = useState('Computer Science');
  const [topic, setTopic] = useState('Data Structures');
  const [subtopics, setSubtopics] = useState('');
  const [questionCount, setQuestionCount] = useState<number | ''>(() => {
    const fromUrl = searchParams.get('count');
    if (fromUrl && !isNaN(parseInt(fromUrl, 10))) return parseInt(fromUrl, 10);
    const saved = sessionStorage.getItem('quizforge_desired_question_count');
    if (saved && !isNaN(parseInt(saved, 10))) return parseInt(saved, 10);
    return 10;
  });

  const updateQuestionCount = (val: number | '') => {
    setQuestionCount(val);
    if (typeof val === 'number') {
      sessionStorage.setItem('quizforge_desired_question_count', val.toString());
    }
  };

  const [difficulty, setDifficulty] = useState<Difficulty>('medium');
  const [selectedTypes, setSelectedTypes] = useState<QuestionType[]>(['single_choice']);
  const [sourceOnlyMode, setSourceOnlyMode] = useState(true);
  const [sourceText, setSourceText] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const questionTypeOptions: { type: QuestionType; label: string }[] = [
    { type: 'single_choice', label: 'Single-Choice MCQ' },
    { type: 'multiple_choice', label: 'Multiple-Select MCQ' },
    { type: 'true_false', label: 'True / False' },
    { type: 'fill_in_the_blank', label: 'Fill in the Blanks' },
    { type: 'match_the_following', label: 'Match the Following' },
    { type: 'arrange_in_order', label: 'Arrange in Order' },
    { type: 'coding', label: 'Interactive Coding Problem (with Test Cases)' },
    { type: 'code_output', label: 'Code Output MCQ' },
    { type: 'code_debug', label: 'Code Debugging & Fixes' },
    { type: 'numerical', label: 'Numerical Calculations' },
    { type: 'assertion_reasoning', label: 'Assertion & Reasoning' },
    { type: 'short_answer', label: 'Short Answer' },
    { type: 'descriptive', label: 'Descriptive' }
  ];

  const toggleType = (t: QuestionType) => {
    if (selectedTypes.includes(t)) {
      if (selectedTypes.length > 1) {
        setSelectedTypes(selectedTypes.filter(x => x !== t));
      }
    } else {
      setSelectedTypes([...selectedTypes, t]);
    }
  };

  const executeGeneration = async (keyToUse?: string) => {
    setError(null);
    setLoading(true);

    const finalCount = typeof questionCount === 'number' && questionCount > 0 ? questionCount : 10;
    try {
      const generated = await api.generateQuestions({
        subject,
        topic,
        subtopics: subtopics || undefined,
        question_count: finalCount,
        question_types: selectedTypes,
        difficulty,
        source_material: mode === 'source' ? sourceText : undefined,
        source_only_mode: mode === 'source' ? sourceOnlyMode : false,
        api_key: keyToUse || userApiKey || localStorage.getItem('quizforge_user_gemini_key') || undefined
      });

      // Save to temporary storage for review screen
      sessionStorage.setItem('quizforge_pending_questions', JSON.stringify(generated));
      sessionStorage.setItem('quizforge_generation_context', JSON.stringify({ subject, topic }));
      const targetQuizId = searchParams.get('quiz_id');
      if (targetQuizId) {
        sessionStorage.setItem('quizforge_generation_target_quiz_id', targetQuizId);
      } else {
        sessionStorage.removeItem('quizforge_generation_target_quiz_id');
      }
      navigate('/review-generated');
    } catch (err: any) {
      const msg = err.message || '';
      if (msg.toLowerCase().includes('gemini') || msg.toLowerCase().includes('key') || msg.toLowerCase().includes('api_key')) {
        setError(msg);
        setShowKeyModal(true);
      } else {
        setError(msg || 'Generation failed. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateAI = async () => {
    if (!subject.trim() || !topic.trim()) {
      setError('Please provide both subject and topic.');
      return;
    }
    setError(null);

    // Check if user has a Gemini key configured
    const activeKey = userApiKey || localStorage.getItem('quizforge_user_gemini_key');
    if (!activeKey) {
      try {
        const aiStatus = await api.getAISettings();
        if (!aiStatus.is_key_configured) {
          setShowKeyModal(true);
          return;
        }
      } catch {
        setShowKeyModal(true);
        return;
      }
    }

    await executeGeneration(activeKey || undefined);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-fadeIn">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold tracking-tight text-foreground">
          Create New Assessment
        </h2>
        <p className="text-sm text-muted-foreground mt-1">
          Choose a creation pathway to import existing questions or generate tailored assessments using Gemini.
        </p>
      </div>

      {/* Mode Switcher Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Mode A */}
        <button
          onClick={() => { setMode('import'); navigate('/imports'); }}
          className={`p-5 rounded-2xl border text-left transition-all ${
            mode === 'import'
              ? 'border-primary bg-primary/5 ring-2 ring-primary/20 shadow-sm'
              : 'border-border bg-card hover:border-primary/40'
          }`}
        >
          <div className="w-10 h-10 rounded-xl bg-indigo-500/10 text-indigo-500 flex items-center justify-center mb-4">
            <UploadCloud className="w-5 h-5" />
          </div>
          <h3 className="text-sm font-semibold text-foreground">Import Existing Questions</h3>
          <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed">
            Extract questions from PDF documents, pasted text, or structured JSON files with automated answer-key detection.
          </p>
        </button>

        {/* Mode B */}
        <button
          onClick={() => setMode('ai')}
          className={`p-5 rounded-2xl border text-left transition-all ${
            mode === 'ai'
              ? 'border-primary bg-primary/5 ring-2 ring-primary/20 shadow-sm'
              : 'border-border bg-card hover:border-primary/40'
          }`}
        >
          <div className="w-10 h-10 rounded-xl bg-purple-500/10 text-purple-500 flex items-center justify-center mb-4">
            <Sparkles className="w-5 h-5" />
          </div>
          <h3 className="text-sm font-semibold text-foreground">Generate From Topic</h3>
          <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed">
            Specify a topic, educational level, and target question types. Gemini generates a structured, verified question set.
          </p>
        </button>

        {/* Mode C */}
        <button
          onClick={() => setMode('source')}
          className={`p-5 rounded-2xl border text-left transition-all ${
            mode === 'source'
              ? 'border-primary bg-primary/5 ring-2 ring-primary/20 shadow-sm'
              : 'border-border bg-card hover:border-primary/40'
          }`}
        >
          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center mb-4">
            <BookOpen className="w-5 h-5" />
          </div>
          <h3 className="text-sm font-semibold text-foreground">Grounded In Study Material</h3>
          <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed">
            Provide textbook excerpts or lecture notes. Questions are generated strictly from the supplied content with citations.
          </p>
        </button>
      </div>

      {/* Mode B & C Configuration Form */}
      {(mode === 'ai' || mode === 'source') && (
        <div className="p-6 md:p-8 rounded-2xl bg-card border border-border shadow-sm space-y-6">
          <div className="border-b border-border pb-4">
            <h3 className="text-base font-semibold text-foreground flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-primary" />
              {mode === 'ai' ? 'Topic-Based Question Generation' : 'Source-Grounded Question Generation'}
            </h3>
            <p className="text-xs text-muted-foreground mt-1">
              Configure parameters for the AI question generation engine. All questions can be reviewed and edited before saving.
            </p>
          </div>

          {error && (
            <div className="p-4 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Form Fields */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground">Subject *</label>
              <input
                type="text"
                value={subject}
                onChange={e => setSubject(e.target.value)}
                placeholder="e.g. Computer Science, Medicine, Law"
                className="w-full px-3.5 py-2 rounded-lg bg-background border border-input text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground">Main Topic *</label>
              <input
                type="text"
                value={topic}
                onChange={e => setTopic(e.target.value)}
                placeholder="e.g. Binary Search Trees, Cell Biology"
                className="w-full px-3.5 py-2 rounded-lg bg-background border border-input text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-foreground">Subtopics / Specific Concepts (Optional)</label>
            <input
              type="text"
              value={subtopics}
              onChange={e => setSubtopics(e.target.value)}
              placeholder="e.g. AVL rotations, Red-Black balancing, asymptotic complexity"
              className="w-full px-3.5 py-2 rounded-lg bg-background border border-input text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
            />
          </div>

          {mode === 'source' && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-foreground">Study Material Content *</label>
                <label className="flex items-center space-x-2 text-xs text-muted-foreground cursor-pointer">
                  <input
                    type="checkbox"
                    checked={sourceOnlyMode}
                    onChange={e => setSourceOnlyMode(e.target.checked)}
                    className="rounded border-input text-primary focus:ring-primary"
                  />
                  <span>Strict source-only mode (no external facts)</span>
                </label>
              </div>
              <textarea
                value={sourceText}
                onChange={e => setSourceText(e.target.value)}
                rows={6}
                placeholder="Paste reference text, lecture notes, or chapter excerpts here..."
                className="w-full px-3.5 py-2 rounded-lg bg-background border border-input text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 font-mono text-xs"
              />
            </div>
          )}

          {/* Counts and Difficulty */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground">Question Count</label>
              <div className="flex flex-wrap items-center gap-2 w-full">
                {[5, 10, 15, 20].map(cnt => (
                  <button
                    key={cnt}
                    type="button"
                    onClick={() => updateQuestionCount(cnt)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                      questionCount === cnt
                        ? 'bg-primary text-primary-foreground border-primary'
                        : 'bg-background text-muted-foreground border-input hover:text-foreground'
                    }`}
                  >
                    {cnt}
                  </button>
                ))}
                <input
                  type="number"
                  min={1}
                  max={50}
                  value={questionCount}
                  onChange={e => {
                    const val = e.target.value;
                    if (val === '') {
                      updateQuestionCount('');
                    } else {
                      const parsed = parseInt(val, 10);
                      if (!isNaN(parsed)) {
                        updateQuestionCount(parsed);
                      }
                    }
                  }}
                  onBlur={() => {
                    if (questionCount === '' || questionCount < 1) {
                      updateQuestionCount(10);
                    } else if (questionCount > 50) {
                      updateQuestionCount(50);
                    }
                  }}
                  className="w-16 px-2.5 py-1.5 rounded-lg bg-background border border-input text-foreground text-xs text-center font-mono font-bold"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground">Difficulty</label>
              <div className="flex flex-wrap items-center gap-2 w-full">
                {(['easy', 'medium', 'hard', 'mixed'] as Difficulty[]).map(d => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => setDifficulty(d)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold border capitalize transition-all ${
                      difficulty === d
                        ? 'bg-primary text-primary-foreground border-primary'
                        : 'bg-background text-muted-foreground border-input hover:text-foreground'
                    }`}
                  >
                    {d}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Question Types */}
          <div className="space-y-2">
            <label className="text-xs font-semibold text-foreground">Allowed Question Types</label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {questionTypeOptions.map(opt => {
                const isSelected = selectedTypes.includes(opt.type);
                return (
                  <button
                    key={opt.type}
                    type="button"
                    onClick={() => toggleType(opt.type)}
                    className={`flex items-center space-x-2 px-3 py-2 rounded-lg text-xs font-medium border text-left transition-all ${
                      isSelected
                        ? 'bg-primary/10 border-primary text-foreground'
                        : 'bg-background border-input text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    <div className={`w-3.5 h-3.5 rounded flex items-center justify-center border ${isSelected ? 'bg-primary border-primary text-white' : 'border-input'}`}>
                      {isSelected && <CheckCircle2 className="w-3 h-3" />}
                    </div>
                    <span className="truncate">{opt.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Action Button */}
          <div className="pt-4 flex justify-end">
            <button
              onClick={handleGenerateAI}
              disabled={loading || (mode === 'source' && !sourceText.trim())}
              className="inline-flex items-center space-x-2 px-5 py-2.5 rounded-xl text-sm font-semibold bg-primary hover:bg-primary-hover disabled:opacity-50 text-primary-foreground shadow-sm transition-all"
            >
              {loading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Generating with Gemini...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  <span>Generate Questions</span>
                  <ArrowRight className="w-4 h-4 ml-1" />
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* Gemini API Key Setup Modal */}
      <GeminiKeyModal
        isOpen={showKeyModal}
        onClose={() => setShowKeyModal(false)}
        onSuccess={(savedKey) => {
          setUserApiKey(savedKey);
          executeGeneration(savedKey);
        }}
        title="Enter Your Gemini API Key"
        description="A Google Gemini key is required to formulate assessment questions. It's free and takes under 30 seconds to set up."
      />
    </div>
  );
};
