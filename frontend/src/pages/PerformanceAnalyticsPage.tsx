import React, { useEffect, useState } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, LineChart, Line, CartesianGrid
} from 'recharts';
import {
  TrendingUp,
  BarChart3,
  Award,
  Layers,
  Clock,
  CheckCircle2
} from 'lucide-react';
import { api } from '../services/api';
import { PerformanceAnalytics } from '../types';

export const PerformanceAnalyticsPage: React.FC = () => {
  const [data, setData] = useState<PerformanceAnalytics | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.getPerformanceAnalytics()
      .then(setData)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const hasData = data && data.total_attempts > 0;

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-fadeIn pb-16">
      <div>
        <h2 className="text-2xl font-bold tracking-tight text-foreground">
          Performance Analytics
        </h2>
        <p className="text-sm text-muted-foreground mt-0.5">
          Longitudinal progress trends, topic strengths, and cognitive accuracy distributions.
        </p>
      </div>

      {!hasData ? (
        <div className="p-12 text-center rounded-2xl bg-card border border-dashed border-border space-y-3">
          <BarChart3 className="w-12 h-12 mx-auto text-muted-foreground" />
          <h3 className="text-sm font-semibold text-foreground">No Performance History Yet</h3>
          <p className="text-xs text-muted-foreground max-w-sm mx-auto">
            Take assessments to generate empirical trend lines, topic distributions, and question type accuracy metrics.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Trend Line Chart */}
          <div className="p-6 md:p-8 rounded-2xl bg-card border border-border shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-foreground">Score Progress Over Time</h3>
                <p className="text-xs text-muted-foreground">Percentage scored across sequential assessment attempts</p>
              </div>
              <TrendingUp className="w-5 h-5 text-emerald-500" />
            </div>

            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={data?.trends} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                  <YAxis domain={[0, 100]} unit="%" tick={{ fontSize: 11 }} />
                  <Tooltip
                    formatter={(val: any) => [`${val}%`, 'Score']}
                    labelFormatter={(_, arr) => arr[0]?.payload?.quiz_title || ''}
                  />
                  <Line
                    type="monotone"
                    dataKey="percentage"
                    stroke="#6366f1"
                    strokeWidth={3}
                    dot={{ r: 4, fill: '#6366f1' }}
                    activeDot={{ r: 6 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Topic and Difficulty Charts */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Topic Accuracy */}
            <div className="p-6 rounded-2xl bg-card border border-border shadow-sm space-y-4">
              <h3 className="text-sm font-bold text-foreground">Accuracy by Subject/Topic</h3>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data?.topic_accuracy} layout="vertical" margin={{ left: 10 }}>
                    <XAxis type="number" domain={[0, 100]} unit="%" />
                    <YAxis dataKey="topic" type="category" width={110} tick={{ fontSize: 11 }} />
                    <Tooltip formatter={(v: any) => [`${v}%`, 'Accuracy']} />
                    <Bar dataKey="accuracy" fill="#10b981" radius={[0, 6, 6, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Question Type Accuracy */}
            <div className="p-6 rounded-2xl bg-card border border-border shadow-sm space-y-4">
              <h3 className="text-sm font-bold text-foreground">Accuracy by Question Type</h3>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data?.type_accuracy} layout="vertical" margin={{ left: 10 }}>
                    <XAxis type="number" domain={[0, 100]} unit="%" />
                    <YAxis dataKey="type" type="category" width={110} tick={{ fontSize: 11 }} />
                    <Tooltip formatter={(v: any) => [`${v}%`, 'Accuracy']} />
                    <Bar dataKey="accuracy" fill="#8b5cf6" radius={[0, 6, 6, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
