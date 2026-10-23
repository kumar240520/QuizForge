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
  Layers
} from 'lucide-react';
import { api } from '../services/api';
import { Quiz } from '../types';

export const MyAssessmentsPage: React.FC = () => {
  const navigate = useNavigate();
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [loading, setLoading] = useState(true);

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

  const handleDelete = async (id: number) => {
    if (window.confirm('Are you sure you want to delete this assessment?')) {
      await api.deleteQuiz(id);
      setQuizzes(quizzes.filter(q => q.id !== id));
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
    </div>
  );
};
