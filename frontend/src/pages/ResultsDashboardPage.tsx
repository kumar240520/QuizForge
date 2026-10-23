import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  Award,
  CheckCircle2,
  XCircle,
  HelpCircle,
  Clock,
  RotateCcw,
  Download,
  ListFilter,
  FileCheck2,
  TrendingUp,
  ArrowRight,
  BrainCircuit,
  Printer
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, PieChart, Pie
} from 'recharts';
import { api } from '../services/api';
import { QuizResult } from '../types';

export const ResultsDashboardPage: React.FC = () => {
  const { resultId } = useParams<{ resultId: string }>();
  const navigate = useNavigate();

  const [result, setResult] = useState<QuizResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (resultId) {
      api.getResult(parseInt(resultId))
        .then(setResult)
        .catch(err => setError(err.message || 'Failed to load result.'))
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
      <div className="max-w-md mx-auto my-12 p-8 text-center rounded-2xl bg-card border border-destructive/20 text-destructive">
        <p>{error || 'Result not found.'}</p>
        <button
          onClick={() => navigate('/history')}
          className="mt-4 px-4 py-2 rounded-xl text-xs font-semibold bg-primary text-primary-foreground"
        >
          View Attempt History
        </button>
      </div>
    );
  }

  const formatSeconds = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}m ${s}s`;
  };

  const avgSeconds = result.total_questions > 0
    ? Math.round(result.time_taken_seconds / result.total_questions)
    : 0;

  // Pie chart data for answers
  const answerPieData = [
    { name: 'Correct', value: result.correct_count, color: '#10b981' },
    { name: 'Incorrect', value: result.incorrect_count, color: '#ef4444' },
    { name: 'Unanswered', value: result.unanswered_count, color: '#64748b' },
    { name: 'Partially Correct', value: result.partially_correct_count, color: '#f59e0b' }
  ].filter(d => d.value > 0);

  // Topic bar chart data
  const topicData = Object.entries(result.breakdown?.topics || {}).map(([topic, stats]: [string, any]) => ({
    topic,
    accuracy: stats.total > 0 ? Math.round((stats.correct / stats.total) * 100) : 0,
    total: stats.total
  }));

  const handleExportCsv = () => {
    window.open(`/api/v1/results/${result.id}/export-csv`, '_blank');
  };

  const handlePrint = () => {
    window.print();
  };

  const handleRetryAssessment = async () => {
    try {
      if (document.documentElement.requestFullscreen) {
        document.documentElement.requestFullscreen().catch(() => {});
      }
    } catch {
      // Ignore fullscreen API errors
    }
    const session = await api.startSession(result.quiz_id);
    navigate(`/session/${session.session_token}`);
  };

  const handleCreateRevisionQuiz = async () => {
    const quiz = await api.createRevisionQuiz({
      filter_by: 'mistakes',
      question_count: 10,
      title: `Revision • ${result.quiz_title || 'Assessment'}`
    });
    navigate(`/assessments/${quiz.id}/instructions`);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-fadeIn pb-16">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-8 rounded-3xl bg-gradient-to-br from-primary/15 via-primary/5 to-transparent border border-primary/20 shadow-sm">
        <div className="space-y-1">
          <span className="text-xs font-semibold uppercase tracking-wider text-primary">
            Official Performance Report
          </span>
          <h2 className="text-2xl md:text-3xl font-extrabold text-foreground tracking-tight">
            {result.quiz_title || 'Diagnostic Assessment'}
          </h2>
          <p className="text-xs text-muted-foreground">
            Completed on {new Date(result.completed_at).toLocaleDateString()} at {new Date(result.completed_at).toLocaleTimeString()}
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleExportCsv}
            className="inline-flex items-center space-x-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-secondary hover:bg-muted text-secondary-foreground border border-border transition-colors shadow-sm"
            title="Download CSV export"
          >
            <Download className="w-4 h-4" />
            <span>CSV</span>
          </button>
          <button
            onClick={handlePrint}
            className="inline-flex items-center space-x-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-secondary hover:bg-muted text-secondary-foreground border border-border transition-colors shadow-sm"
            title="Print or save PDF report"
          >
            <Printer className="w-4 h-4" />
            <span>Print Report</span>
          </button>
          <Link
            to={`/results/${result.id}/review`}
            className="inline-flex items-center space-x-1.5 px-4 py-2 rounded-xl text-xs font-semibold bg-primary hover:bg-primary-hover text-primary-foreground shadow-sm shadow-primary/20 transition-all"
          >
            <ListFilter className="w-4 h-4" />
            <span>Detailed Review</span>
          </Link>
        </div>
      </div>

      {/* Primary KPI Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {/* Score & Percentage */}
        <div className="p-5 rounded-2xl bg-card border border-border shadow-sm">
          <div className="flex items-center justify-between text-muted-foreground text-xs uppercase font-medium">
            <span>Score</span>
            <Award className="w-4 h-4 text-primary" />
          </div>
          <div className="mt-2 flex items-baseline gap-1">
            <span className="text-3xl font-black text-foreground">{result.score}</span>
            <span className="text-sm font-semibold text-muted-foreground">/ {result.max_score}</span>
          </div>
          <span className={`text-xs font-bold mt-1 block ${
            result.percentage >= 70 ? 'text-emerald-500' : result.percentage >= 50 ? 'text-amber-500' : 'text-rose-500'
          }`}>
            {result.percentage}% Overall
          </span>
        </div>

        {/* Correct Answers */}
        <div className="p-5 rounded-2xl bg-card border border-border shadow-sm">
          <div className="flex items-center justify-between text-muted-foreground text-xs uppercase font-medium">
            <span>Correct</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="mt-2">
            <span className="text-3xl font-black text-emerald-500">{result.correct_count}</span>
            <span className="text-sm font-semibold text-muted-foreground"> / {result.total_questions}</span>
          </div>
          <span className="text-xs text-muted-foreground mt-1 block">
            {result.incorrect_count} incorrect
          </span>
        </div>

        {/* Time Spent */}
        <div className="p-5 rounded-2xl bg-card border border-border shadow-sm">
          <div className="flex items-center justify-between text-muted-foreground text-xs uppercase font-medium">
            <span>Total Time</span>
            <Clock className="w-4 h-4 text-indigo-500" />
          </div>
          <div className="mt-2">
            <span className="text-2xl font-bold text-foreground">{formatSeconds(result.time_taken_seconds)}</span>
          </div>
          <span className="text-xs text-muted-foreground mt-1 block">
            Avg: {avgSeconds}s / question
          </span>
        </div>

        {/* Status */}
        <div className="p-5 rounded-2xl bg-card border border-border shadow-sm">
          <div className="flex items-center justify-between text-muted-foreground text-xs uppercase font-medium">
            <span>Accuracy</span>
            <TrendingUp className="w-4 h-4 text-amber-500" />
          </div>
          <div className="mt-2">
            <span className="text-3xl font-black text-foreground">
              {result.total_questions > 0 ? Math.round((result.correct_count / result.total_questions) * 100) : 0}%
            </span>
          </div>
          <span className="text-xs text-muted-foreground mt-1 block">
            {result.unanswered_count} skipped
          </span>
        </div>
      </div>

      {/* Visual Analytics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Breakdown by Question Outcome */}
        <div className="p-6 rounded-2xl bg-card border border-border shadow-sm space-y-4">
          <h3 className="text-sm font-bold text-foreground">Response Distribution</h3>
          <div className="h-64 flex items-center justify-center">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={answerPieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={55}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {answerPieData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="flex flex-wrap justify-center gap-4 text-xs">
            {answerPieData.map((d) => (
              <div key={d.name} className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-full" style={{ backgroundColor: d.color }} />
                <span className="text-muted-foreground">{d.name}: <strong>{d.value}</strong></span>
              </div>
            ))}
          </div>
        </div>

        {/* Topic Accuracy Breakdown */}
        <div className="p-6 rounded-2xl bg-card border border-border shadow-sm space-y-4">
          <h3 className="text-sm font-bold text-foreground">Accuracy by Topic</h3>
          {topicData.length > 0 ? (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={topicData} layout="vertical" margin={{ left: 20 }}>
                  <XAxis type="number" domain={[0, 100]} unit="%" />
                  <YAxis type="category" dataKey="topic" width={110} tick={{ fontSize: 11 }} />
                  <Tooltip formatter={(value: any) => [`${value}%`, 'Accuracy']} />
                  <Bar dataKey="accuracy" fill="#6366f1" radius={[0, 6, 6, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="h-64 flex items-center justify-center text-xs text-muted-foreground">
              Single topic assessment. All items evaluated together.
            </div>
          )}
        </div>
      </div>

      {/* Post-Assessment Follow-up Actions */}
      <div className="p-6 rounded-2xl bg-card border border-border shadow-sm space-y-4">
        <h3 className="text-sm font-bold text-foreground">Recommended Next Steps</h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <button
            onClick={handleRetryAssessment}
            className="p-4 rounded-xl border border-border hover:border-primary/50 text-left transition-all bg-background/50"
          >
            <RotateCcw className="w-4 h-4 text-primary mb-2" />
            <h4 className="text-xs font-bold text-foreground">Retry Assessment</h4>
            <p className="text-[11px] text-muted-foreground mt-1">
              Retake the complete assessment to improve your score.
            </p>
          </button>

          <button
            onClick={handleCreateRevisionQuiz}
            className="p-4 rounded-xl border border-border hover:border-primary/50 text-left transition-all bg-background/50"
          >
            <BrainCircuit className="w-4 h-4 text-amber-500 mb-2" />
            <h4 className="text-xs font-bold text-foreground">Targeted Revision Quiz</h4>
            <p className="text-[11px] text-muted-foreground mt-1">
              Generate a spaced practice quiz targeting your missed concepts.
            </p>
          </button>

          <Link
            to={`/results/${result.id}/review`}
            className="p-4 rounded-xl border border-border hover:border-primary/50 text-left transition-all bg-background/50 block"
          >
            <ListFilter className="w-4 h-4 text-emerald-500 mb-2" />
            <h4 className="text-xs font-bold text-foreground">Detailed Question Review</h4>
            <p className="text-[11px] text-muted-foreground mt-1">
              Inspect your answers side-by-side with explanations.
            </p>
          </Link>
        </div>
      </div>
    </div>
  );
};
