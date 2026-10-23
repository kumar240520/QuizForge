import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, Trash2, X, AlertCircle, CheckCircle2 } from 'lucide-react';
import { api } from '../../services/api';

interface PurgeStorageModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const PurgeStorageModal: React.FC<PurgeStorageModalProps> = ({ isOpen, onClose }) => {
  const navigate = useNavigate();
  const [confirmationInput, setConfirmationInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  if (!isOpen) return null;

  const isConfirmed = confirmationInput.trim() === 'DELETE STORAGE';

  const handlePurge = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isConfirmed) return;

    setLoading(true);
    setError(null);

    try {
      await api.purgeFullStorage('DELETE STORAGE');
      setSuccess(true);

      // Wipe local browser caches and session
      setTimeout(() => {
        localStorage.clear();
        sessionStorage.clear();
        onClose();
        navigate('/register');
      }, 1800);
    } catch (err: any) {
      setError(err.message || 'Failed to purge database storage. Please try again.');
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fadeIn">
      <div
        className="w-full max-w-md bg-card border border-destructive/30 rounded-3xl shadow-2xl p-6 sm:p-7 relative space-y-5 text-foreground animate-scaleUp"
        onClick={e => e.stopPropagation()}
      >
        {/* Close Button */}
        <button
          onClick={onClose}
          disabled={loading}
          className="absolute right-4 top-4 p-2 rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted/80 transition-colors"
          title="Close"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Modal Header */}
        <div className="flex items-center gap-3 border-b border-border pb-4">
          <div className="w-10 h-10 rounded-2xl bg-destructive/10 border border-destructive/20 flex items-center justify-center text-destructive shrink-0">
            <AlertTriangle className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-destructive">Delete Full Storage</h3>
            <p className="text-xs text-muted-foreground">Irreversible System & Database Reset</p>
          </div>
        </div>

        {/* Severe Warning Banner */}
        <div className="p-3.5 rounded-2xl bg-destructive/10 border border-destructive/25 text-xs text-destructive leading-relaxed space-y-1.5">
          <p className="font-bold flex items-center gap-1.5">
            <AlertCircle className="w-4 h-4 shrink-0" />
            Warning: This action is permanent and cannot be undone!
          </p>
          <p className="text-muted-foreground text-[11px] leading-relaxed">
            All stored data will be wiped from your local SQLite database:
          </p>
          <ul className="list-disc list-inside text-[11px] text-muted-foreground space-y-0.5 pl-1">
            <li>All Question Banks, Subjects, and Topics</li>
            <li>All Assessments and Quizzes</li>
            <li>All Test Attempts, Session Logs, and Candidate Results</li>
            <li>All User Profiles and Saved Settings</li>
          </ul>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="p-3 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Success Alert */}
        {success ? (
          <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-xs flex flex-col items-center justify-center gap-2 text-center py-6">
            <CheckCircle2 className="w-8 h-8 text-emerald-500 animate-bounce" />
            <span className="font-bold text-sm">Storage Purged Successfully!</span>
            <span className="text-xs text-muted-foreground">
              Local database wiped clean. Redirecting to fresh registration setup...
            </span>
          </div>
        ) : (
          <form onSubmit={handlePurge} className="space-y-4 text-xs">
            <div className="space-y-1.5">
              <label className="font-semibold text-foreground">
                To confirm, type <span className="font-mono font-bold text-destructive bg-destructive/10 px-1.5 py-0.5 rounded">DELETE STORAGE</span> below:
              </label>
              <input
                type="text"
                required
                value={confirmationInput}
                onChange={e => setConfirmationInput(e.target.value)}
                placeholder="DELETE STORAGE"
                className="w-full px-4 py-2.5 rounded-xl bg-background border border-input text-foreground font-mono font-bold text-sm text-center tracking-wider focus:ring-2 focus:ring-destructive/40"
              />
            </div>

            {/* Action Buttons */}
            <div className="flex items-center gap-2 pt-2">
              <button
                type="button"
                onClick={onClose}
                disabled={loading}
                className="flex-1 py-2.5 px-4 rounded-xl text-xs font-semibold bg-muted hover:bg-muted/80 text-foreground transition-all cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={!isConfirmed || loading}
                className="flex-1 py-2.5 px-4 rounded-xl text-xs font-bold bg-destructive hover:bg-destructive/90 disabled:opacity-40 text-destructive-foreground shadow-sm shadow-destructive/20 transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                {loading ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Wiping Database...</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="w-4 h-4" />
                    <span>Delete Full Storage</span>
                  </>
                )}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
