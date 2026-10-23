import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  History,
  FileCheck2,
  ArrowRight,
  Clock,
  Award,
  CheckCircle2,
  XCircle
} from 'lucide-react';
import { api } from '../services/api';
import { QuizResultListItem } from '../types';

export const AttemptHistoryPage: React.FC = () => {
  const [results, setResults] = useState<QuizResultListItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.getResults()
      .then(setResults)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const formatSeconds = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}m ${s}s`;
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 animate-fadeIn pb-16">
      <div>
        <h2 className="text-2xl font-bold tracking-tight text-foreground">
          Attempt History
        </h2>
        <p className="text-sm text-muted-foreground mt-0.5">
          Chronological record of all completed assessment sessions and evaluations.
        </p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center min-h-[300px]">
          <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      ) : results.length === 0 ? (
        <div className="p-12 text-center rounded-2xl bg-card border border-dashed border-border space-y-3">
          <History className="w-10 h-10 mx-auto text-muted-foreground" />
          <h3 className="text-sm font-semibold text-foreground">No attempts on record</h3>
          <p className="text-xs text-muted-foreground max-w-sm mx-auto">
            Take your first assessment to begin tracking score progressions and evaluation records.
          </p>
          <Link
            to="/assessments"
            className="inline-block mt-3 px-4 py-2 rounded-xl text-xs font-semibold bg-primary text-primary-foreground hover:bg-primary-hover"
          >
            Browse Assessments
          </Link>
        </div>
      ) : (
        <div className="p-2 rounded-2xl bg-card border border-border shadow-sm overflow-hidden">
          <table className="w-full text-left text-xs">
            <thead className="bg-muted/50 text-muted-foreground uppercase text-[10px] tracking-wider border-b border-border">
              <tr>
                <th className="p-4 font-semibold">Assessment Title</th>
                <th className="p-4 font-semibold">Date Completed</th>
                <th className="p-4 font-semibold">Score</th>
                <th className="p-4 font-semibold">Percentage</th>
                <th className="p-4 font-semibold">Time Spent</th>
                <th className="p-4 font-semibold text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {results.map((r) => (
                <tr key={r.id} className="hover:bg-muted/30 transition-colors">
                  <td className="p-4 font-semibold text-foreground">
                    {r.quiz_title}
                  </td>
                  <td className="p-4 text-muted-foreground">
                    {new Date(r.completed_at).toLocaleDateString()} at {new Date(r.completed_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </td>
                  <td className="p-4 font-mono font-medium text-foreground">
                    {r.score} / {r.max_score}
                  </td>
                  <td className="p-4">
                    <span className={`px-2 py-0.5 rounded text-[11px] font-bold font-mono ${
                      r.percentage >= 70
                        ? 'bg-emerald-500/10 text-emerald-500'
                        : r.percentage >= 50
                        ? 'bg-amber-500/10 text-amber-500'
                        : 'bg-rose-500/10 text-rose-500'
                    }`}>
                      {r.percentage}%
                    </span>
                  </td>
                  <td className="p-4 text-muted-foreground font-mono">
                    {formatSeconds(r.time_taken_seconds)}
                  </td>
                  <td className="p-4 text-right">
                    <Link
                      to={`/results/${r.id}`}
                      className="inline-flex items-center space-x-1 text-xs font-semibold text-primary hover:underline"
                    >
                      <span>Report</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
