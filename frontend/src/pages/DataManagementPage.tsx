import React, { useState } from 'react';
import {
  HardDrive,
  Download,
  Trash2,
  AlertTriangle,
  CheckCircle2,
  AlertOctagon,
  Flame
} from 'lucide-react';
import { api } from '../services/api';
import { PurgeStorageModal } from '../components/modals/PurgeStorageModal';

export const DataManagementPage: React.FC = () => {
  const [downloading, setDownloading] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [isPurgeModalOpen, setIsPurgeModalOpen] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const handleExportBackup = async () => {
    setDownloading(true);
    try {
      const data = await api.getBackup();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `quizforge_backup_${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      setMessage('Backup JSON downloaded successfully.');
      setTimeout(() => setMessage(null), 4000);
    } catch (err: any) {
      alert(err.message || 'Failed to generate backup.');
    } finally {
      setDownloading(false);
    }
  };

  const handleResetHistory = async () => {
    if (window.confirm('Are you sure you want to reset your assessment attempt history and spaced revision states? Your question banks and assessments will be preserved.')) {
      setResetting(true);
      try {
        await api.resetHistory();
        setMessage('Assessment attempts and revision records have been successfully reset.');
        setTimeout(() => setMessage(null), 4000);
      } catch (err: any) {
        alert(err.message || 'Failed to reset history.');
      } finally {
        setResetting(false);
      }
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6 animate-fadeIn pb-16">
      <div>
        <h2 className="text-2xl font-bold tracking-tight text-foreground">
          Data Management
        </h2>
        <p className="text-sm text-muted-foreground mt-0.5">
          Manage local question banks, export portable JSON backups, and reset attempt metrics.
        </p>
      </div>

      {message && (
        <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-xs flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
          <span>{message}</span>
        </div>
      )}

      {/* Main Data Actions */}
      <div className="p-6 md:p-8 rounded-2xl bg-card border border-border shadow-sm space-y-6">
        {/* Backup export */}
        <div className="flex items-center justify-between pb-6 border-b border-border">
          <div className="space-y-1">
            <h3 className="text-sm font-bold text-foreground">Complete System Backup</h3>
            <p className="text-xs text-muted-foreground max-w-md">
              Download all question banks, subjects, topics, and configured assessments as a JSON file.
            </p>
          </div>

          <button
            onClick={handleExportBackup}
            disabled={downloading}
            className="inline-flex items-center space-x-1.5 px-4 py-2 rounded-xl text-xs font-semibold bg-primary hover:bg-primary-hover disabled:opacity-50 text-primary-foreground shadow-sm transition-all cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            <span>{downloading ? 'Exporting...' : 'Export JSON Backup'}</span>
          </button>
        </div>

        {/* Reset attempt history */}
        <div className="flex items-center justify-between pt-2">
          <div className="space-y-1">
            <h3 className="text-sm font-bold text-foreground text-amber-500 dark:text-amber-400 flex items-center gap-1.5">
              <AlertTriangle className="w-4 h-4" />
              Reset Attempt History
            </h3>
            <p className="text-xs text-muted-foreground max-w-md">
              Clears completed quiz results, performance trends, and revision mastery metrics without touching your curated question sets.
            </p>
          </div>

          <button
            onClick={handleResetHistory}
            disabled={resetting}
            className="inline-flex items-center space-x-1.5 px-4 py-2 rounded-xl text-xs font-semibold bg-amber-500/10 hover:bg-amber-500/20 text-amber-600 dark:text-amber-400 border border-amber-500/20 transition-all cursor-pointer"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>{resetting ? 'Resetting...' : 'Reset History'}</span>
          </button>
        </div>
      </div>

      {/* Danger Zone: Delete Full Storage */}
      <div className="p-6 md:p-8 rounded-2xl bg-destructive/5 border border-destructive/25 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <h3 className="text-sm font-bold text-destructive flex items-center gap-1.5">
              <AlertOctagon className="w-4 h-4" />
              Danger Zone: Delete Full Storage
            </h3>
            <p className="text-xs text-muted-foreground max-w-lg leading-relaxed">
              Permanently delete all question banks, assessments, questions, test attempts, candidate profiles, and local database records. Requires confirmation.
            </p>
          </div>

          <button
            onClick={() => setIsPurgeModalOpen(true)}
            className="inline-flex items-center space-x-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-destructive hover:bg-destructive/90 text-destructive-foreground shadow-sm shadow-destructive/20 transition-all cursor-pointer shrink-0"
          >
            <Flame className="w-3.5 h-3.5" />
            <span>Delete Full Storage</span>
          </button>
        </div>
      </div>

      {/* Confirmation Modal */}
      <PurgeStorageModal
        isOpen={isPurgeModalOpen}
        onClose={() => setIsPurgeModalOpen(false)}
      />
    </div>
  );
};
