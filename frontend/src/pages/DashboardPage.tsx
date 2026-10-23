import React, { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  FileCheck2,
  Plus,
  ArrowRight,
  TrendingUp,
  Brain,
  AlertTriangle,
  RotateCcw,
  Sparkles,
  Award,
  CheckCircle2,
  Clock
} from 'lucide-react';
import { api } from '../services/api';
import { authService } from '../services/auth';
import { DashboardSummary, Quiz } from '../types';
import { GeminiKeyModal } from '../components/GeminiKeyModal';

export const DashboardPage: React.FC = () => {
  const navigate = useNavigate();
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [loading, setLoading] = useState(true);

  // Gemini Key state & modal
  const [showGeminiModal, setShowGeminiModal] = useState(false);
  const [aiConfigured, setAiConfigured] = useState(false);
  const [aiMaskedKey, setAiMaskedKey] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      api.getDashboardSummary(),
      api.getQuizzes(),
      api.getAISettings().catch(() => null)
    ])
      .then(([dash, qz, aiSettings]) => {
        setSummary(dash);
        setQuizzes(qz);
        if (aiSettings) {
          setAiConfigured(aiSettings.is_key_configured);
          setAiMaskedKey(aiSettings.masked_key || null);
        }
      })
      .catch(err => console.error(err))
      .finally(() => setLoading(false));
  }, []);

  const handleKeySaved = (newKey: string) => {
    setAiConfigured(true);
    setAiMaskedKey(`${newKey.slice(0, 6)}...${newKey.slice(-4)}`);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const hasData = summary && summary.total_assessments_taken > 0;

  return (
    <div className="space-y-8 animate-fadeIn">
      {/* Top Banner & Quick Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-6 rounded-2xl bg-gradient-to-r from-primary/10 via-primary/5 to-transparent border border-primary/20">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-foreground">
            Welcome to QuizForge
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Enterprise-grade assessment engine powered by structured question intelligence.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link
            to="/create-assessment"
            className="inline-flex items-center space-x-2 px-4 py-2.5 rounded-xl text-sm font-semibold bg-primary hover:bg-primary-hover text-primary-foreground shadow-sm transition-all shadow-primary/20"
          >
            <Plus className="w-4 h-4" />
            <span>Create Assessment</span>
          </Link>
          <Link
            to="/questions"
            className="inline-flex items-center space-x-2 px-4 py-2.5 rounded-xl text-sm font-semibold bg-secondary hover:bg-muted text-secondary-foreground border border-border transition-colors"
          >
            <span>Question Bank</span>
          </Link>
        </div>
      </div>

      {/* One-Time Gemini Setup or Active Status Banner */}
      {!aiConfigured ? (
        <div className="p-5 sm:p-6 rounded-2xl bg-gradient-to-r from-indigo-500/15 via-purple-500/10 to-card border border-indigo-500/30 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start space-x-3.5">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 text-white flex items-center justify-center flex-shrink-0 shadow-md shadow-indigo-500/20">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm sm:text-base font-bold text-foreground">
                  One-Time Setup: Configure Your Free Gemini AI Key
                </h3>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                  Setup Required
                </span>
              </div>
              <p className="text-xs text-muted-foreground mt-1 max-w-xl leading-relaxed">
                Unlock instant AI assessment generation from any topic or study notes using your own free Google Gemini API key. No credit card required.
              </p>
            </div>
          </div>
          <button
            onClick={() => setShowGeminiModal(true)}
            className="inline-flex items-center space-x-2 px-4 py-2.5 rounded-xl text-xs font-semibold bg-primary hover:bg-primary-hover text-primary-foreground shadow-md shadow-primary/25 whitespace-nowrap self-start sm:self-center transition-all"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Configure Gemini Key</span>
          </button>
        </div>
      ) : (
        <div className="px-5 py-3 rounded-xl bg-card border border-border flex items-center justify-between text-xs">
          <div className="flex items-center space-x-2.5">
            <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-muted-foreground">
              Gemini AI Generation Ready <strong className="text-foreground ml-1">({aiMaskedKey || 'Active'})</strong>
            </span>
          </div>
          <div className="flex items-center space-x-3">
            <button
              onClick={() => setShowGeminiModal(true)}
              className="text-primary hover:underline font-semibold text-xs"
            >
              Change Key
            </button>
            <span className="text-border">|</span>
            <Link to="/settings/ai" className="text-muted-foreground hover:text-foreground text-xs">
              AI Settings
            </Link>
          </div>
        </div>
      )}

      {/* KPI Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-5 rounded-xl bg-card border border-border shadow-sm">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-medium uppercase tracking-wider">Assessments Taken</span>
            <FileCheck2 className="w-4 h-4 text-primary" />
          </div>
          <p className="text-3xl font-bold text-foreground mt-3">
            {summary?.total_assessments_taken ?? 0}
          </p>
          <span className="text-xs text-muted-foreground mt-1 block">Completed evaluations</span>
        </div>

        <div className="p-5 rounded-xl bg-card border border-border shadow-sm">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-medium uppercase tracking-wider">Accuracy Rate</span>
            <TrendingUp className="w-4 h-4 text-emerald-500" />
          </div>
          <p className="text-3xl font-bold text-foreground mt-3">
            {summary?.accuracy_rate ?? 0}%
          </p>
          <span className="text-xs text-muted-foreground mt-1 block">Across all attempted items</span>
        </div>

        <div className="p-5 rounded-xl bg-card border border-border shadow-sm">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-medium uppercase tracking-wider">Average Score</span>
            <Award className="w-4 h-4 text-amber-500" />
          </div>
          <p className="text-3xl font-bold text-foreground mt-3">
            {summary?.average_percentage ?? 0}%
          </p>
          <span className="text-xs text-muted-foreground mt-1 block">
            Best: {summary?.best_percentage ?? 0}%
          </span>
        </div>

        <div className="p-5 rounded-xl bg-card border border-border shadow-sm">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-medium uppercase tracking-wider">Mastered Items</span>
            <Brain className="w-4 h-4 text-indigo-500" />
          </div>
          <p className="text-3xl font-bold text-foreground mt-3">
            {summary?.mastery_counts.mastered ?? 0}
          </p>
          <span className="text-xs text-muted-foreground mt-1 block">
            {summary?.mastery_counts.needs_revision ?? 0} need revision
          </span>
        </div>
      </div>

      {/* Main Grid: Assessments & Revision/Weak Topics */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Available Assessments */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-semibold text-foreground">Available Assessments</h3>
            <Link to="/assessments" className="text-xs font-medium text-primary hover:underline flex items-center">
              View all ({quizzes.length}) <ArrowRight className="w-3.5 h-3.5 ml-1" />
            </Link>
          </div>

          <div className="space-y-3">
            {quizzes.length === 0 ? (
              <div className="p-8 text-center rounded-xl bg-card border border-dashed border-border">
                <FileCheck2 className="w-10 h-10 mx-auto text-muted-foreground mb-3" />
                <h4 className="text-sm font-semibold text-foreground">No assessments yet</h4>
                <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
                  Create your first quiz by importing questions from a document or generating them using AI.
                </p>
                <button
                  onClick={() => navigate('/create-assessment')}
                  className="mt-4 px-4 py-2 rounded-lg text-xs font-semibold bg-primary text-primary-foreground hover:bg-primary-hover transition-colors"
                >
                  Create Assessment
                </button>
              </div>
            ) : (
              quizzes.slice(0, 4).map((quiz) => (
                <div
                  key={quiz.id}
                  className="p-4 rounded-xl bg-card border border-border hover:border-primary/50 transition-all shadow-sm flex items-center justify-between gap-4"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-semibold uppercase ${
                        quiz.mode === 'exam'
                          ? 'bg-rose-500/10 text-rose-500 border border-rose-500/20'
                          : quiz.mode === 'revision'
                          ? 'bg-amber-500/10 text-amber-500 border border-amber-500/20'
                          : 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20'
                      }`}>
                        {quiz.mode}
                      </span>
                      <h4 className="text-sm font-semibold text-foreground truncate">
                        {quiz.title}
                      </h4>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground mt-2">
                      <span>{quiz.question_ids?.length ?? 0} questions</span>
                      <span>•</span>
                      <span>
                        {quiz.timing_mode === 'untimed'
                          ? 'Untimed'
                          : quiz.duration_minutes
                          ? `${quiz.duration_minutes} mins`
                          : `${quiz.per_question_seconds}s / q`}
                      </span>
                    </div>
                  </div>

                  <button
                    onClick={() => navigate(`/assessments/${quiz.id}/instructions`)}
                    className="px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-primary text-primary-foreground hover:bg-primary-hover transition-colors shadow-sm whitespace-nowrap"
                  >
                    Start Quiz
                  </button>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Sidebar: Weak Topics & Spaced Revision */}
        <div className="space-y-6">
          {/* Weak Topics */}
          <div className="p-5 rounded-xl bg-card border border-border shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-500" />
                Focus Topics
              </h3>
              <Link to="/revision" className="text-xs font-medium text-primary hover:underline">
                Revision
              </Link>
            </div>

            {summary?.weak_topics && summary.weak_topics.length > 0 ? (
              <div className="space-y-3">
                {summary.weak_topics.map((t) => (
                  <div key={t.topic} className="space-y-1.5">
                    <div className="flex justify-between text-xs">
                      <span className="font-medium text-foreground truncate">{t.topic}</span>
                      <span className="text-amber-500 font-semibold">{t.accuracy}%</span>
                    </div>
                    <div className="w-full h-1.5 rounded-full bg-muted overflow-hidden">
                      <div
                        className="h-full bg-amber-500 rounded-full"
                        style={{ width: `${t.accuracy}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-6 text-xs text-muted-foreground">
                <CheckCircle2 className="w-6 h-6 mx-auto text-emerald-500 mb-2" />
                No weak topics flagged. Great work!
              </div>
            )}
          </div>

          {/* Quick AI Generator Teaser */}
          <div className="p-5 rounded-xl bg-gradient-to-br from-indigo-500/10 via-purple-500/5 to-transparent border border-indigo-500/20 shadow-sm space-y-3">
            <div className="flex items-center space-x-2 text-indigo-500">
              <Sparkles className="w-4 h-4" />
              <h3 className="text-sm font-semibold text-foreground">AI Generator</h3>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Create tailored assessment sets from any topic or grounded in your textbook notes using Gemini.
            </p>
            {aiConfigured ? (
              <Link
                to="/create-assessment?tab=ai"
                className="inline-flex items-center space-x-1.5 text-xs font-semibold text-primary hover:underline pt-1"
              >
                <span>Generate Questions</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            ) : (
              <button
                type="button"
                onClick={() => setShowGeminiModal(true)}
                className="inline-flex items-center space-x-1.5 text-xs font-semibold text-primary hover:underline pt-1"
              >
                <span>Generate Questions</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Interactive Gemini Key Modal */}
      <GeminiKeyModal
        isOpen={showGeminiModal}
        onClose={() => setShowGeminiModal(false)}
        onSuccess={handleKeySaved}
      />
    </div>
  );
};
