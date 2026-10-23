import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  ArrowLeft,
  CheckCircle2,
  XCircle,
  HelpCircle,
  Filter,
  Clock,
  Award,
  BookOpen,
  Code,
  Terminal
} from 'lucide-react';
import { api } from '../services/api';
import { QuizResult, QuestionAttemptDetail } from '../types';

export const DetailedReviewPage: React.FC = () => {
  const { resultId } = useParams<{ resultId: string }>();
  const navigate = useNavigate();

  const [result, setResult] = useState<QuizResult | null>(null);
  const [filterMode, setFilterMode] = useState<'all' | 'incorrect' | 'correct' | 'unanswered'>('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (resultId) {
      api.getResult(parseInt(resultId))
        .then(setResult)
        .catch(err => setError(err.message || 'Failed to load details.'))
        .finally(() => setLoading(false));
    }
  }, [resultId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (error || !result) {
    return (
      <div className="p-8 text-center text-destructive">
        <p>{error || 'Result details not available.'}</p>
        <button
          onClick={() => navigate('/history')}
          className="mt-4 px-4 py-2 rounded-xl text-xs font-semibold bg-primary text-primary-foreground"
        >
          Back to History
        </button>
      </div>
    );
  }

  const attempts = result.attempt_details || [];
  const filteredAttempts = attempts.filter((a) => {
    if (filterMode === 'incorrect') return !a.is_correct && a.user_answer !== null;
    if (filterMode === 'correct') return a.is_correct;
    if (filterMode === 'unanswered') return a.user_answer === null || a.user_answer === '';
    return true;
  });

  return (
    <div className="max-w-4xl mx-auto space-y-6 animate-fadeIn pb-16">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <Link
            to={`/results/${result.id}`}
            className="inline-flex items-center space-x-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground mb-1"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Results Dashboard</span>
          </Link>
          <h2 className="text-2xl font-bold tracking-tight text-foreground">
            Detailed Answer Review
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Compare your submitted answers side-by-side with verified keys and worked solutions.
          </p>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-1.5 bg-muted p-1 rounded-xl">
          {[
            { id: 'all', label: 'All' },
            { id: 'incorrect', label: `Incorrect (${result.incorrect_count})` },
            { id: 'correct', label: `Correct (${result.correct_count})` },
            { id: 'unanswered', label: `Skipped (${result.unanswered_count})` }
          ].map((f) => (
            <button
              key={f.id}
              onClick={() => setFilterMode(f.id as any)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                filterMode === f.id
                  ? 'bg-card text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Question Items Review */}
      <div className="space-y-4">
        {filteredAttempts.map((attempt, idx) => {
          const q = attempt.question_snapshot;
          const isCorrect = attempt.is_correct;
          const isUnanswered = attempt.user_answer === null || attempt.user_answer === '';

          return (
            <div
              key={attempt.id}
              className={`p-6 rounded-2xl bg-card border transition-all ${
                isCorrect
                  ? 'border-emerald-500/30'
                  : isUnanswered
                  ? 'border-border'
                  : 'border-rose-500/30'
              }`}
            >
              {/* Card Header */}
              <div className="flex items-center justify-between text-xs pb-3 border-b border-border">
                <div className="flex items-center gap-2">
                  <span className="flex items-center justify-center w-6 h-6 rounded-lg bg-muted text-foreground font-mono font-bold">
                    {idx + 1}
                  </span>
                  <span className="uppercase text-[10px] font-bold px-2 py-0.5 rounded bg-muted text-muted-foreground">
                    {q.question_type?.replace(/_/g, ' ') || 'QUESTION'}
                  </span>
                  <span className="uppercase text-[10px] font-bold px-2 py-0.5 rounded bg-muted text-muted-foreground">
                    {q.difficulty || 'medium'}
                  </span>
                  {q.source_ref && (
                    <span className="text-[11px] text-muted-foreground italic">
                      ({q.source_ref})
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-3">
                  <span className="text-muted-foreground font-mono">
                    Time: {attempt.time_spent_seconds}s
                  </span>
                  <span className={`font-bold font-mono px-2 py-0.5 rounded text-xs ${
                    isCorrect
                      ? 'bg-emerald-500/10 text-emerald-500'
                      : isUnanswered
                      ? 'bg-muted text-muted-foreground'
                      : 'bg-rose-500/10 text-rose-500'
                  }`}>
                    {attempt.marks_awarded > 0 ? `+${attempt.marks_awarded}` : attempt.marks_awarded} / {attempt.max_marks} pts
                  </span>
                </div>
              </div>

              {/* Statement */}
              <p className="text-sm font-medium text-foreground mt-4 leading-relaxed whitespace-pre-wrap">
                {q.question_text}
              </p>

              {/* Code Snippet for Code Output Questions */}
              {(q.metadata_extra?.code || q.metadata_extra?.code_snippet) && (
                <div className="mt-4 rounded-xl border border-border bg-slate-950 p-4 font-mono text-xs text-emerald-300 overflow-x-auto shadow-inner">
                  <div className="flex items-center gap-2 pb-2 mb-2 border-b border-slate-800 text-[10px] text-slate-400">
                    <Code className="w-3.5 h-3.5 text-indigo-400" />
                    <span className="uppercase font-bold tracking-wider text-indigo-400">
                      {q.metadata_extra?.language || 'python'} Code:
                    </span>
                  </div>
                  <pre className="whitespace-pre font-mono">{q.metadata_extra.code || q.metadata_extra.code_snippet}</pre>
                </div>
              )}

              {/* Options breakdown if MCQ / Code Output with Options */}
              {q.options && q.options.length > 0 && (
                <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {q.options.map((opt: any) => {
                    const isTarget = Array.isArray(q.correct_answer)
                      ? q.correct_answer.includes(opt.id)
                      : String(q.correct_answer) === opt.id;

                    const isUserChoice = Array.isArray(attempt.user_answer)
                      ? attempt.user_answer.includes(opt.id)
                      : String(attempt.user_answer) === opt.id;

                    let optBorder = 'border-border bg-background/50 text-muted-foreground';
                    if (isTarget) {
                      optBorder = 'border-emerald-500/50 bg-emerald-500/5 text-foreground font-semibold';
                    } else if (isUserChoice && !isTarget) {
                      optBorder = 'border-rose-500/50 bg-rose-500/5 text-rose-600 dark:text-rose-400 font-semibold';
                    }

                    return (
                      <div
                        key={opt.id}
                        className={`p-3 rounded-xl border text-xs flex items-center gap-3 ${optBorder}`}
                      >
                        <span className={`w-5 h-5 rounded-full flex items-center justify-center font-bold text-[10px] ${
                          isTarget
                            ? 'bg-emerald-500 text-white'
                            : isUserChoice
                            ? 'bg-rose-500 text-white'
                            : 'bg-muted text-muted-foreground'
                        }`}>
                          {opt.id}
                        </span>
                        <span className="flex-1">{opt.text}</span>
                        {isTarget && (
                          <span className="text-[10px] font-semibold text-emerald-500 uppercase tracking-wider">
                            Correct
                          </span>
                        )}
                        {isUserChoice && !isTarget && (
                          <span className="text-[10px] font-semibold text-rose-500 uppercase tracking-wider">
                            Your Choice
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Dedicated Coding Question Review */}
              {q.question_type === 'coding' ? (
                <div className="mt-4 space-y-3 text-xs">
                  {attempt.feedback && (
                    <div className={`p-3 rounded-xl border flex items-center gap-2 font-medium ${
                      isCorrect
                        ? 'bg-emerald-500/10 border-emerald-500/25 text-emerald-400'
                        : attempt.is_partially_correct
                        ? 'bg-amber-500/10 border-amber-500/25 text-amber-400'
                        : 'bg-rose-500/10 border-rose-500/25 text-rose-400'
                    }`}>
                      <Terminal className="w-4 h-4 shrink-0" />
                      <span>{attempt.feedback}</span>
                    </div>
                  )}

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-1.5 overflow-hidden">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                        Your Submitted Code:
                      </span>
                      <pre className="font-mono text-xs text-emerald-400 whitespace-pre-wrap overflow-x-auto max-h-60">
                        {isUnanswered ? '# No code submitted' : String(Array.isArray(attempt.user_answer) ? attempt.user_answer[0] : attempt.user_answer)}
                      </pre>
                    </div>

                    <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-1.5 overflow-hidden">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-400 block">
                        Accepted Reference Solution:
                      </span>
                      <pre className="font-mono text-xs text-indigo-300 whitespace-pre-wrap overflow-x-auto max-h-60">
                        {Array.isArray(q.correct_answer) ? q.correct_answer.join('\n') : String(q.correct_answer || '')}
                      </pre>
                    </div>
                  </div>
                </div>
              ) : (!q.options || q.options.length === 0) && (
                /* Text/Numerical answer comparison */
                <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div className="p-3 rounded-xl bg-background border border-border space-y-1">
                    <span className="text-[10px] font-semibold uppercase text-muted-foreground block">
                      Your Answer:
                    </span>
                    <span className="font-mono font-medium text-foreground">
                      {isUnanswered
                        ? '(No answer submitted)'
                        : Array.isArray(attempt.user_answer)
                        ? String(attempt.user_answer[0] ?? '')
                        : String(attempt.user_answer)}
                    </span>
                  </div>

                  <div className="p-3 rounded-xl bg-emerald-500/5 border border-emerald-500/30 space-y-1">
                    <span className="text-[10px] font-semibold uppercase text-emerald-600 dark:text-emerald-400 block">
                      Accepted Answer:
                    </span>
                    <span className="font-mono font-medium text-foreground">
                      {Array.isArray(q.correct_answer)
                        ? q.correct_answer.join(', ')
                        : String(q.correct_answer)}
                    </span>
                  </div>
                </div>
              )}

              {/* Explanation & Rationale */}
              {q.explanation && (
                <div className="mt-4 p-4 rounded-xl bg-muted/40 border border-border text-xs space-y-1">
                  <span className="font-bold text-foreground block">Explanation & Concept Rationale:</span>
                  <p className="text-muted-foreground leading-relaxed">{q.explanation}</p>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
