import React, { useEffect, useState } from 'react';
import {
  Sliders,
  Save,
  CheckCircle2
} from 'lucide-react';
import { api } from '../services/api';
import { AppPreferences } from '../types';

export const ApplicationPreferencesPage: React.FC = () => {
  const [prefs, setPrefs] = useState<AppPreferences>({
    default_timing_mode: 'total_duration',
    default_quiz_duration_mins: 30,
    default_question_seconds: 60,
    default_positive_marks: 1.0,
    default_negative_marks: 0.25,
    confirm_on_leave: true
  });
  
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    api.getPreferences()
      .then(setPrefs)
      .catch(console.error);
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.updatePreferences(prefs);
      setMessage('Preferences saved successfully.');
      setTimeout(() => setMessage(null), 3000);
    } catch (err: any) {
      alert(err.message || 'Failed to save preferences.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6 animate-fadeIn pb-16">
      <div>
        <h2 className="text-2xl font-bold tracking-tight text-foreground">
          Application Preferences
        </h2>
        <p className="text-sm text-muted-foreground mt-0.5">
          Configure default assessment parameters, timer standards, and behavioral safeguards.
        </p>
      </div>

      {message && (
        <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-xs flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
          <span>{message}</span>
        </div>
      )}

      <form onSubmit={handleSave} className="p-6 md:p-8 rounded-2xl bg-card border border-border shadow-sm space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-foreground">Default Timing Mode</label>
            <select
              value={prefs.default_timing_mode}
              onChange={e => setPrefs({ ...prefs, default_timing_mode: e.target.value })}
              className="w-full px-3 py-2 rounded-xl bg-background border border-input text-foreground text-xs"
            >
              <option value="total_duration">Mode A: Total Session Duration</option>
              <option value="per_question">Mode B: Per-Question Countdown</option>
              <option value="both">Mode C: Both Timers</option>
              <option value="untimed">Mode D: Untimed</option>
            </select>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-foreground">Default Session Duration (Mins)</label>
            <input
              type="number"
              min={1}
              value={prefs.default_quiz_duration_mins}
              onChange={e => setPrefs({ ...prefs, default_quiz_duration_mins: parseInt(e.target.value) || 1 })}
              className="w-full px-3 py-2 rounded-xl bg-background border border-input text-foreground text-xs"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-foreground">Default Question Timer (s)</label>
            <input
              type="number"
              min={5}
              value={prefs.default_question_seconds}
              onChange={e => setPrefs({ ...prefs, default_question_seconds: parseInt(e.target.value) || 5 })}
              className="w-full px-3 py-2 rounded-xl bg-background border border-input text-foreground text-xs"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-foreground">Default Positive Marks</label>
            <input
              type="number"
              step="0.25"
              min="0.25"
              value={prefs.default_positive_marks}
              onChange={e => setPrefs({ ...prefs, default_positive_marks: parseFloat(e.target.value) || 1.0 })}
              className="w-full px-3 py-2 rounded-xl bg-background border border-input text-foreground text-xs"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-foreground">Default Negative Marks</label>
            <input
              type="number"
              step="0.25"
              min="0"
              value={prefs.default_negative_marks}
              onChange={e => setPrefs({ ...prefs, default_negative_marks: parseFloat(e.target.value) || 0.0 })}
              className="w-full px-3 py-2 rounded-xl bg-background border border-input text-foreground text-xs"
            />
          </div>
        </div>

        <div className="pt-2">
          <label className="flex items-center space-x-2 text-xs font-semibold text-foreground cursor-pointer">
            <input
              type="checkbox"
              checked={prefs.confirm_on_leave}
              onChange={e => setPrefs({ ...prefs, confirm_on_leave: e.target.checked })}
              className="rounded border-input text-primary focus:ring-primary"
            />
            <span>Confirm before exiting in-progress assessments</span>
          </label>
        </div>

        <div className="pt-4 border-t border-border flex justify-end">
          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center space-x-2 px-5 py-2.5 rounded-xl text-xs font-semibold bg-primary hover:bg-primary-hover disabled:opacity-50 text-primary-foreground shadow-sm transition-all"
          >
            <Save className="w-3.5 h-3.5" />
            <span>{saving ? 'Saving...' : 'Save Preferences'}</span>
          </button>
        </div>
      </form>
    </div>
  );
};
