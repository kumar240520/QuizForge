import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Save,
  ArrowLeft,
  Plus,
  Trash2,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import { api } from '../services/api';
import { QuestionType, Difficulty, QuestionOption, Subject, Topic } from '../types';

export const QuestionEditorPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const isEditing = Boolean(id);
  const navigate = useNavigate();

  const [questionText, setQuestionText] = useState('');
  const [questionType, setQuestionType] = useState<QuestionType>('single_choice');
  const [difficulty, setDifficulty] = useState<Difficulty>('medium');
  const [points, setPoints] = useState<number | ''>(1.0);
  const [negativeMarks, setNegativeMarks] = useState<number | ''>(0.0);
  
  // MCQ options
  const [options, setOptions] = useState<QuestionOption[]>([
    { id: 'A', text: '' },
    { id: 'B', text: '' },
    { id: 'C', text: '' },
    { id: 'D', text: '' }
  ]);
  const [correctAnswer, setCorrectAnswer] = useState<string>('A');
  const [multiSelectAnswers, setMultiSelectAnswers] = useState<string[]>(['A']);
  
  // Other types
  const [textAnswer, setTextAnswer] = useState('');
  const [acceptedAnswersStr, setAcceptedAnswersStr] = useState('');
  const [numericalTolerance, setNumericalTolerance] = useState<number | ''>(0.0);
  
  const [explanation, setExplanation] = useState('');
  const [sourceRef, setSourceRef] = useState('');
  
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [topics, setTopics] = useState<Topic[]>([]);
  const [selectedSubjectId, setSelectedSubjectId] = useState<number | null>(null);
  const [selectedTopicId, setSelectedTopicId] = useState<number | null>(null);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.getSubjects().then(setSubjects).catch(console.error);
    if (isEditing && id) {
      setLoading(true);
      api.getQuestion(parseInt(id))
        .then(q => {
          setQuestionText(q.question_text);
          setQuestionType(q.question_type);
          setDifficulty(q.difficulty);
          setPoints(q.points);
          setNegativeMarks(q.negative_marks);
          if (q.options && q.options.length > 0) {
            setOptions(q.options);
          }
          if (Array.isArray(q.correct_answer)) {
            setCorrectAnswer(q.correct_answer[0] || 'A');
            setMultiSelectAnswers(q.correct_answer);
          } else {
            setTextAnswer(String(q.correct_answer || ''));
          }
          setAcceptedAnswersStr((q.accepted_answers || []).join(', '));
          setNumericalTolerance(q.numerical_tolerance || 0.0);
          setExplanation(q.explanation || '');
          setSourceRef(q.source_ref || '');
          setSelectedSubjectId(q.subject_id || null);
          setSelectedTopicId(q.topic_id || null);
        })
        .catch(err => setError(err.message))
        .finally(() => setLoading(false));
    }
  }, [id, isEditing]);

  useEffect(() => {
    if (selectedSubjectId) {
      api.getTopics(selectedSubjectId).then(setTopics).catch(console.error);
    } else {
      setTopics([]);
    }
  }, [selectedSubjectId]);

  const addOption = () => {
    const nextChar = String.fromCharCode(65 + options.length);
    setOptions([...options, { id: nextChar, text: '' }]);
  };

  const removeOption = (idx: number) => {
    if (options.length <= 2) return;
    const newOpts = options.filter((_, i) => i !== idx);
    setOptions(newOpts);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!questionText.trim()) {
      setError('Question text is required.');
      return;
    }

    let finalCorrectAnswer: any = [correctAnswer];
    let finalOptions = options;
    if (questionType === 'true_false') {
      const boolVal = String(correctAnswer).toUpperCase().includes('FALSE') || String(correctAnswer).toUpperCase() === 'B' ? 'FALSE' : 'TRUE';
      finalCorrectAnswer = [boolVal];
      finalOptions = [
        { id: 'TRUE', text: 'True' },
        { id: 'FALSE', text: 'False' }
      ];
    } else if (questionType === 'multiple_choice') {
      finalCorrectAnswer = multiSelectAnswers;
    } else if (questionType === 'numerical') {
      finalCorrectAnswer = [parseFloat(textAnswer) || 0.0];
    } else if (['fill_in_the_blank', 'short_answer', 'code_output'].includes(questionType)) {
      finalCorrectAnswer = [textAnswer.trim()];
    }

    const finalPoints = typeof points === 'number' && points >= 0 ? points : 1.0;
    const finalNegativeMarks = typeof negativeMarks === 'number' && negativeMarks >= 0 ? negativeMarks : 0.0;
    const finalTolerance = typeof numericalTolerance === 'number' && numericalTolerance >= 0 ? numericalTolerance : 0.0;

    const payload = {
      question_text: questionText,
      question_type: questionType,
      difficulty,
      points: finalPoints,
      negative_marks: finalNegativeMarks,
      options: ['single_choice', 'multiple_choice', 'true_false', 'assertion_reasoning'].includes(questionType) ? finalOptions : [],
      correct_answer: finalCorrectAnswer,
      accepted_answers: acceptedAnswersStr ? acceptedAnswersStr.split(',').map(s => s.trim()).filter(Boolean) : [],
      numerical_tolerance: finalTolerance,
      explanation,
      source_ref: sourceRef,
      subject_id: selectedSubjectId,
      topic_id: selectedTopicId
    };

    setLoading(true);
    try {
      if (isEditing && id) {
        await api.updateQuestion(parseInt(id), payload);
      } else {
        await api.createQuestion(payload);
      }
      navigate('/questions');
    } catch (err: any) {
      setError(err.message || 'Failed to save question.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6 animate-fadeIn pb-16">
      {/* Top Header */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => navigate('/questions')}
          className="inline-flex items-center space-x-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Question Bank</span>
        </button>

        <h2 className="text-lg font-bold text-foreground">
          {isEditing ? 'Edit Question' : 'Create Question'}
        </h2>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <form onSubmit={handleSave} className="p-6 md:p-8 rounded-2xl bg-card border border-border shadow-sm space-y-6">
        {/* Type and Difficulty Row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-foreground">Question Type</label>
            <select
              value={questionType}
              onChange={e => setQuestionType(e.target.value as QuestionType)}
              className="w-full px-3 py-2 rounded-lg bg-background border border-input text-foreground text-xs"
            >
              <option value="single_choice">Single-Choice MCQ</option>
              <option value="multiple_choice">Multiple-Select MCQ</option>
              <option value="true_false">True / False</option>
              <option value="fill_in_the_blank">Fill in the Blanks</option>
              <option value="numerical">Numerical Calculations</option>
              <option value="assertion_reasoning">Assertion & Reasoning</option>
              <option value="short_answer">Short Answer</option>
              <option value="descriptive">Descriptive</option>
            </select>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-foreground">Difficulty</label>
            <select
              value={difficulty}
              onChange={e => setDifficulty(e.target.value as Difficulty)}
              className="w-full px-3 py-2 rounded-lg bg-background border border-input text-foreground text-xs"
            >
              <option value="easy">Easy</option>
              <option value="medium">Medium</option>
              <option value="hard">Hard</option>
            </select>
          </div>
        </div>

        {/* Question Text */}
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-foreground">Question Statement *</label>
          <textarea
            rows={4}
            value={questionText}
            onChange={e => setQuestionText(e.target.value)}
            placeholder="Enter question text here..."
            className="w-full p-3.5 rounded-xl bg-background border border-input text-foreground text-sm focus:ring-2 focus:ring-primary/40 leading-relaxed"
          />
        </div>

        {/* Options Editor (MCQ / True-False) */}
        {['single_choice', 'multiple_choice', 'assertion_reasoning'].includes(questionType) && (
          <div className="space-y-3 pt-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-foreground">Answer Options</label>
              <button
                type="button"
                onClick={addOption}
                className="inline-flex items-center space-x-1 text-xs font-semibold text-primary hover:underline"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Option</span>
              </button>
            </div>

            <div className="space-y-2">
              {options.map((opt, idx) => {
                const isSelected = questionType === 'multiple_choice'
                  ? multiSelectAnswers.includes(opt.id)
                  : correctAnswer === opt.id;

                return (
                  <div key={opt.id} className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        if (questionType === 'multiple_choice') {
                          if (multiSelectAnswers.includes(opt.id)) {
                            if (multiSelectAnswers.length > 1) {
                              setMultiSelectAnswers(multiSelectAnswers.filter(x => x !== opt.id));
                            }
                          } else {
                            setMultiSelectAnswers([...multiSelectAnswers, opt.id]);
                          }
                        } else {
                          setCorrectAnswer(opt.id);
                        }
                      }}
                      className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold font-mono transition-colors border ${
                        isSelected
                          ? 'bg-emerald-500 border-emerald-500 text-white'
                          : 'bg-muted border-input text-muted-foreground hover:border-primary/50'
                      }`}
                      title={isSelected ? 'Correct Answer' : 'Click to mark as correct'}
                    >
                      {opt.id}
                    </button>
                    <input
                      type="text"
                      value={opt.text}
                      onChange={e => {
                        const newOpts = [...options];
                        newOpts[idx].text = e.target.value;
                        setOptions(newOpts);
                      }}
                      placeholder={`Option ${opt.id} text...`}
                      className="flex-1 px-3 py-2 rounded-lg bg-background border border-input text-foreground text-xs"
                    />
                    {options.length > 2 && (
                      <button
                        type="button"
                        onClick={() => removeOption(idx)}
                        className="p-1.5 text-muted-foreground hover:text-destructive"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* True / False Selection */}
        {questionType === 'true_false' && (
          <div className="space-y-2 pt-2">
            <label className="text-xs font-semibold text-foreground">Select Correct Answer *</label>
            <div className="grid grid-cols-2 gap-3 max-w-sm">
              {['TRUE', 'FALSE'].map(val => {
                const normCurrent = String(correctAnswer).toUpperCase().includes('FALSE') || String(correctAnswer).toUpperCase() === 'B' ? 'FALSE' : 'TRUE';
                const isSelected = normCurrent === val;
                return (
                  <button
                    key={val}
                    type="button"
                    onClick={() => setCorrectAnswer(val)}
                    className={`py-3 rounded-xl border text-sm font-bold transition-all shadow-xs ${
                      isSelected
                        ? 'border-emerald-500 bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 ring-2 ring-emerald-500/30'
                        : 'border-input bg-card hover:bg-muted text-muted-foreground'
                    }`}
                  >
                    {val === 'TRUE' ? 'True' : 'False'}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Text/Numerical input */}
        {['fill_in_the_blank', 'short_answer', 'numerical'].includes(questionType) && (
          <div className="space-y-3 pt-2">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground">Expected Answer *</label>
              <input
                type={questionType === 'numerical' ? 'number' : 'text'}
                step="any"
                value={textAnswer}
                onChange={e => setTextAnswer(e.target.value)}
                placeholder="Enter expected answer..."
                className="w-full px-3 py-2 rounded-lg bg-background border border-input text-foreground text-xs"
              />
            </div>

            {questionType === 'numerical' && (
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground">Allowed Absolute Tolerance (±)</label>
                <input
                  type="number"
                  step="any"
                  value={numericalTolerance}
                  onChange={e => {
                    const val = e.target.value;
                    setNumericalTolerance(val === '' ? '' : parseFloat(val));
                  }}
                  onBlur={() => {
                    if (numericalTolerance === '' || numericalTolerance < 0) {
                      setNumericalTolerance(0.0);
                    }
                  }}
                  className="w-32 px-3 py-2 rounded-lg bg-background border border-input text-foreground text-xs font-mono"
                />
              </div>
            )}

            {questionType === 'fill_in_the_blank' && (
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground">Alternative Accepted Answers (comma-separated)</label>
                <input
                  type="text"
                  value={acceptedAnswersStr}
                  onChange={e => setAcceptedAnswersStr(e.target.value)}
                  placeholder="e.g. 201 Created, HTTP 201"
                  className="w-full px-3 py-2 rounded-lg bg-background border border-input text-foreground text-xs"
                />
              </div>
            )}
          </div>
        )}

        {/* Points and Marks */}
        <div className="grid grid-cols-2 gap-4 pt-2">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-foreground">Points (Positive Marks)</label>
            <input
              type="number"
              step="0.25"
              min="0.25"
              value={points}
              onChange={e => {
                const val = e.target.value;
                setPoints(val === '' ? '' : parseFloat(val));
              }}
              onBlur={() => {
                if (points === '' || points < 0.25) {
                  setPoints(1.0);
                }
              }}
              className="w-full px-3 py-2 rounded-lg bg-background border border-input text-foreground text-xs font-mono"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-foreground">Negative Marks (Penalty)</label>
            <input
              type="number"
              step="0.25"
              min="0"
              value={negativeMarks}
              onChange={e => {
                const val = e.target.value;
                setNegativeMarks(val === '' ? '' : parseFloat(val));
              }}
              onBlur={() => {
                if (negativeMarks === '' || negativeMarks < 0) {
                  setNegativeMarks(0.0);
                }
              }}
              className="w-full px-3 py-2 rounded-lg bg-background border border-input text-foreground text-xs font-mono"
            />
          </div>
        </div>

        {/* Explanation & Source Reference */}
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-foreground">Explanation & Worked Solution</label>
          <textarea
            rows={3}
            value={explanation}
            onChange={e => setExplanation(e.target.value)}
            placeholder="Detailed rationale explaining why this answer is correct..."
            className="w-full p-3 rounded-lg bg-background border border-input text-foreground text-xs leading-relaxed"
          />
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-foreground">Source Reference (Optional)</label>
          <input
            type="text"
            value={sourceRef}
            onChange={e => setSourceRef(e.target.value)}
            placeholder="e.g. Textbook Chapter 4, Page 82 or Exam 2024"
            className="w-full px-3 py-2 rounded-lg bg-background border border-input text-foreground text-xs"
          />
        </div>

        {/* Action Buttons */}
        <div className="pt-4 flex justify-end gap-3 border-t border-border">
          <button
            type="button"
            onClick={() => navigate('/questions')}
            className="px-4 py-2 rounded-xl text-xs font-medium border border-border text-muted-foreground hover:text-foreground hover:bg-muted"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={loading}
            className="inline-flex items-center space-x-2 px-5 py-2.5 rounded-xl text-xs font-semibold bg-primary hover:bg-primary-hover disabled:opacity-50 text-primary-foreground shadow-sm transition-all"
          >
            <Save className="w-3.5 h-3.5" />
            <span>{isEditing ? 'Update Question' : 'Save Question'}</span>
          </button>
        </div>
      </form>
    </div>
  );
};
