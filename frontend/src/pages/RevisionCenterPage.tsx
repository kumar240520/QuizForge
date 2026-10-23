import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  RotateCcw,
  Brain,
  Sparkles,
  Calendar,
  AlertTriangle,
  Award,
  ArrowRight,
  CheckCircle2,
  Clock,
  Play
} from 'lucide-react';
import { api } from '../services/api';
import { RevisionItem } from '../types';

export const RevisionCenterPage: React.FC = () => {
  const navigate = useNavigate();
  const [items, setItems] = useState<RevisionItem[]>([]);
  const [filterState, setFilterState] = useState<string>('all');
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    setLoading(true);
    api.getRevisionItems({
      mastery_state: filterState !== 'all' ? filterState : undefined
    })
      .then(setItems)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [filterState]);

  const dueItems = items.filter(i => i.is_due);
  const needsRevisionCount = items.filter(i => i.mastery_state === 'needs_revision').length;
  const learningCount = items.filter(i => i.mastery_state === 'learning').length;
  const masteredCount = items.filter(i => i.mastery_state === 'mastered').length;

  const handleStartRevisionQuiz = async (filterBy: string = 'mistakes') => {
    setGenerating(true);
    try {
      const quiz = await api.createRevisionQuiz({
        title: filterBy === 'due_for_revision' ? 'Spaced Repetition Review' : 'Mistakes Revision Quiz',
        filter_by: filterBy,
        question_count: 10,
        timing_mode: 'untimed'
      });
      navigate(`/assessments/${quiz.id}/instructions`);
    } catch (err: any) {
      alert(err.message || 'Failed to generate revision quiz.');
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-fadeIn pb-16">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-8 rounded-3xl bg-gradient-to-r from-amber-500/15 via-amber-500/5 to-transparent border border-amber-500/20 shadow-sm">
        <div>
          <span className="text-xs font-semibold uppercase tracking-wider text-amber-500 flex items-center gap-1.5">
            <Brain className="w-4 h-4" />
            Spaced Learning Engine
          </span>
          <h2 className="text-2xl font-bold tracking-tight text-foreground mt-1">
            Revision Center
          </h2>
          <p className="text-xs text-muted-foreground mt-1 max-w-lg leading-relaxed">
            QuizForge calculates memory retention intervals using SM-2 spaced repetition algorithms, prioritizing concepts that need reinforcement.
          </p>
        </div>

        <button
          onClick={() => handleStartRevisionQuiz('mistakes')}
          disabled={generating || items.length === 0}
          className="inline-flex items-center space-x-2 px-5 py-2.5 rounded-xl text-xs font-semibold bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-white shadow-sm transition-all"
        >
          {generating ? (
            <span>Generating Quiz...</span>
          ) : (
            <>
              <Play className="w-3.5 h-3.5 fill-white" />
              <span>Practice Mistakes</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </>
          )}
        </button>
      </div>

      {/* Mastery KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div
          onClick={() => setFilterState('needs_revision')}
          className={`p-5 rounded-2xl border cursor-pointer transition-all ${
            filterState === 'needs_revision'
              ? 'border-rose-500 bg-rose-500/10'
              : 'border-border bg-card hover:border-rose-500/40'
          }`}
        >
          <span className="text-xs font-medium uppercase text-rose-500">Needs Revision</span>
          <div className="mt-2 text-3xl font-black text-rose-500">{needsRevisionCount}</div>
          <span className="text-[11px] text-muted-foreground mt-1 block">Repeated errors</span>
        </div>

        <div
          onClick={() => setFilterState('learning')}
          className={`p-5 rounded-2xl border cursor-pointer transition-all ${
            filterState === 'learning'
              ? 'border-indigo-500 bg-indigo-500/10'
              : 'border-border bg-card hover:border-indigo-500/40'
          }`}
        >
          <span className="text-xs font-medium uppercase text-indigo-500">Learning</span>
          <div className="mt-2 text-3xl font-black text-foreground">{learningCount}</div>
          <span className="text-[11px] text-muted-foreground mt-1 block">Streaks under 3</span>
        </div>

        <div
          onClick={() => setFilterState('mastered')}
          className={`p-5 rounded-2xl border cursor-pointer transition-all ${
            filterState === 'mastered'
              ? 'border-emerald-500 bg-emerald-500/10'
              : 'border-border bg-card hover:border-emerald-500/40'
          }`}
        >
          <span className="text-xs font-medium uppercase text-emerald-500">Mastered</span>
          <div className="mt-2 text-3xl font-black text-emerald-500">{masteredCount}</div>
          <span className="text-[11px] text-muted-foreground mt-1 block">&gt; 80% accuracy</span>
        </div>

        <div
          onClick={() => setFilterState('all')}
          className={`p-5 rounded-2xl border cursor-pointer transition-all ${
            filterState === 'all'
              ? 'border-primary bg-primary/10'
              : 'border-border bg-card hover:border-primary/40'
          }`}
        >
          <span className="text-xs font-medium uppercase text-primary">Due For Review</span>
          <div className="mt-2 text-3xl font-black text-foreground">{dueItems.length}</div>
          <span className="text-[11px] text-muted-foreground mt-1 block">Ready today</span>
        </div>
      </div>

      {/* Revision Queue List */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-semibold text-foreground">
            Spaced Repetition Queue ({items.length} items)
          </h3>
          {filterState !== 'all' && (
            <button
              onClick={() => setFilterState('all')}
              className="text-xs font-medium text-primary hover:underline"
            >
              Show all items
            </button>
          )}
        </div>

        {loading ? (
          <div className="flex items-center justify-center min-h-[250px]">
            <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : items.length === 0 ? (
          <div className="p-12 text-center rounded-2xl bg-card border border-dashed border-border space-y-3">
            <CheckCircle2 className="w-10 h-10 mx-auto text-emerald-500" />
            <h4 className="text-sm font-semibold text-foreground">No questions due for revision</h4>
            <p className="text-xs text-muted-foreground max-w-sm mx-auto">
              Complete more assessments to build up your spaced learning queue and track concept mastery.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {items.map((item) => (
              <div
                key={item.id}
                className="p-5 rounded-2xl bg-card border border-border hover:border-primary/40 transition-all flex items-start justify-between gap-4"
              >
                <div className="space-y-1.5 flex-1">
                  <div className="flex items-center gap-2">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-semibold uppercase ${
                      item.mastery_state === 'mastered'
                        ? 'bg-emerald-500/10 text-emerald-500'
                        : item.mastery_state === 'needs_revision'
                        ? 'bg-rose-500/10 text-rose-500'
                        : 'bg-indigo-500/10 text-indigo-500'
                    }`}>
                      {item.mastery_state.replace('_', ' ')}
                    </span>
                    <span className="text-[10px] uppercase font-bold text-muted-foreground">
                      {item.question_type.replace(/_/g, ' ')}
                    </span>
                    {item.topic_name && (
                      <span className="text-xs text-muted-foreground font-medium">
                        • {item.topic_name}
                      </span>
                    )}
                  </div>

                  <p className="text-sm font-medium text-foreground leading-snug">
                    {item.question_text}
                  </p>

                  <div className="flex items-center gap-4 text-xs text-muted-foreground pt-1">
                    <span>Attempts: {item.total_attempts}</span>
                    <span>•</span>
                    <span>Accuracy: {item.accuracy_percentage}%</span>
                    <span>•</span>
                    <span>Streak: {item.streak}</span>
                    <span>•</span>
                    <span className={item.is_due ? 'text-amber-500 font-semibold' : ''}>
                      {item.is_due ? 'Due today' : `Next review: ${new Date(item.next_review_due).toLocaleDateString()}`}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
