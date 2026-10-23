import React, { useState, useEffect } from 'react';
import {
  Sparkles,
  Key,
  ExternalLink,
  Eye,
  EyeOff,
  CheckCircle2,
  AlertCircle,
  Radio,
  Save,
  X,
  ClipboardPaste,
  ShieldCheck,
  ChevronDown,
  ChevronUp,
  HelpCircle
} from 'lucide-react';
import { api } from '../services/api';
import { authService } from '../services/auth';

interface GeminiKeyModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (apiKey: string) => void;
  title?: string;
  description?: string;
}

export const GeminiKeyModal: React.FC<GeminiKeyModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  title = "Set Up Your Google Gemini AI Key",
  description = "Use your personal Gemini API key to formulate intelligent assessment questions. It's completely free with no credit card needed."
}) => {
  const [apiKey, setApiKey] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [selectedModel, setSelectedModel] = useState('gemini-2.5-flash');
  const [showInstructions, setShowInstructions] = useState(true);

  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setTestResult(null);
      setSaveError(null);
      // Preload current key from localStorage or settings
      const localKey = localStorage.getItem('quizforge_user_gemini_key');
      if (localKey) {
        setApiKey(localKey);
      } else {
        api.getAISettings().then(res => {
          if (res.model_name) setSelectedModel(res.model_name);
        }).catch(() => {});
      }
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handlePasteClipboard = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text && text.trim()) {
        setApiKey(text.trim());
        setTestResult(null);
      }
    } catch {
      // Browser clipboard permission denied or not supported
    }
  };

  const handleTestKey = async () => {
    if (!apiKey.trim()) {
      setTestResult({ success: false, message: 'Please enter or paste your Gemini API key first.' });
      return;
    }
    setTesting(true);
    setTestResult(null);
    setSaveError(null);
    try {
      const res = await api.testAIConnection({
        api_key: apiKey.trim(),
        model_name: selectedModel
      });
      setTestResult(res);
    } catch (err: any) {
      setTestResult({
        success: false,
        message: err.message || 'Connection test failed. Check your network or verify the API key.'
      });
    } finally {
      setTesting(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!apiKey.trim()) {
      setSaveError('Please enter a valid Gemini API key.');
      return;
    }

    setSaving(true);
    setSaveError(null);
    try {
      const cleanedKey = apiKey.trim();
      // 1. Save to backend settings and user profile
      await api.updateAISettings({
        api_key: cleanedKey,
        model_name: selectedModel
      });

      // 2. Cache in localStorage for immediate client-side requests
      localStorage.setItem('quizforge_user_gemini_key', cleanedKey);

      // 3. Update authService user state if present
      const currentUser = authService.getUser();
      if (currentUser) {
        currentUser.is_gemini_configured = true;
        currentUser.masked_gemini_key = `${cleanedKey.slice(0, 6)}...${cleanedKey.slice(-4)}`;
        authService.setUser(currentUser);
      }

      if (onSuccess) {
        onSuccess(cleanedKey);
      }
      onClose();
    } catch (err: any) {
      setSaveError(err.message || 'Failed to save Gemini key. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm animate-fadeIn">
      <div
        className="w-full max-w-lg bg-card border border-border rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-scaleUp"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-5 sm:p-6 border-b border-border flex items-start justify-between bg-muted/20">
          <div className="flex items-start space-x-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 text-white flex items-center justify-center flex-shrink-0 shadow-md shadow-indigo-500/20">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base sm:text-lg font-bold text-foreground">
                  {title}
                </h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                  Free Tier
                </span>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {description}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            title="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="p-5 sm:p-6 space-y-5 overflow-y-auto flex-1">
          {/* Step-by-Step Instructions Collapsible Guide */}
          <div className="rounded-xl border border-border bg-background overflow-hidden">
            <button
              type="button"
              onClick={() => setShowInstructions(!showInstructions)}
              className="w-full px-4 py-3 flex items-center justify-between text-xs font-semibold text-foreground bg-muted/30 hover:bg-muted/50 transition-colors"
            >
              <span className="flex items-center gap-2">
                <HelpCircle className="w-4 h-4 text-primary" />
                How to get your free Gemini API Key (30 seconds)
              </span>
              {showInstructions ? (
                <ChevronUp className="w-4 h-4 text-muted-foreground" />
              ) : (
                <ChevronDown className="w-4 h-4 text-muted-foreground" />
              )}
            </button>

            {showInstructions && (
              <div className="p-4 space-y-3 text-xs border-t border-border">
                <ol className="space-y-2.5 text-muted-foreground">
                  <li className="flex items-start gap-2.5">
                    <span className="flex items-center justify-center w-5 h-5 rounded-full bg-primary/10 text-primary font-bold text-[11px] flex-shrink-0 mt-0.5">
                      1
                    </span>
                    <div>
                      <span>Visit </span>
                      <a
                        href="https://aistudio.google.com/app/apikey"
                        target="_blank"
                        rel="noreferrer"
                        className="text-primary font-semibold hover:underline inline-flex items-center gap-1"
                      >
                        Google AI Studio <ExternalLink className="w-3 h-3" />
                      </a>
                      <span> and sign in with your Google account.</span>
                    </div>
                  </li>

                  <li className="flex items-start gap-2.5">
                    <span className="flex items-center justify-center w-5 h-5 rounded-full bg-primary/10 text-primary font-bold text-[11px] flex-shrink-0 mt-0.5">
                      2
                    </span>
                    <span>Click the blue <strong>"Create API key"</strong> button.</span>
                  </li>

                  <li className="flex items-start gap-2.5">
                    <span className="flex items-center justify-center w-5 h-5 rounded-full bg-primary/10 text-primary font-bold text-[11px] flex-shrink-0 mt-0.5">
                      3
                    </span>
                    <span>Copy the key (starts with <code className="bg-muted px-1.5 py-0.5 rounded text-[11px] font-mono text-foreground">AIzaSy...</code>) and paste it below.</span>
                  </li>
                </ol>

                <div className="p-2.5 rounded-lg bg-primary/5 border border-primary/15 text-[11px] text-muted-foreground flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-primary flex-shrink-0" />
                  <span>Your key stays private and is only used to generate questions for your account.</span>
                </div>
              </div>
            )}
          </div>

          {/* Form */}
          <form onSubmit={handleSave} className="space-y-4">
            {/* API Key Input */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground flex items-center justify-between">
                <span>Gemini API Key *</span>
                <button
                  type="button"
                  onClick={handlePasteClipboard}
                  className="text-xs text-primary hover:underline font-medium inline-flex items-center gap-1"
                >
                  <ClipboardPaste className="w-3 h-3" /> Paste from clipboard
                </button>
              </label>

              <div className="relative">
                <Key className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input
                  type={showKey ? 'text' : 'password'}
                  value={apiKey}
                  onChange={(e) => {
                    setApiKey(e.target.value);
                    setTestResult(null);
                    setSaveError(null);
                  }}
                  placeholder="AIzaSy..."
                  autoFocus
                  required
                  className="w-full pl-9 pr-10 py-2.5 rounded-xl bg-background border border-input text-foreground text-xs font-mono focus:ring-2 focus:ring-primary/40 focus:outline-none shadow-sm"
                />
                <button
                  type="button"
                  onClick={() => setShowKey(!showKey)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-0.5"
                  title={showKey ? 'Hide key' : 'Show key'}
                >
                  {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Model Selection */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground">
                Target Model
              </label>
              <select
                value={selectedModel}
                onChange={(e) => setSelectedModel(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-background border border-input text-foreground text-xs focus:ring-2 focus:ring-primary/40 focus:outline-none"
              >
                <option value="gemini-2.5-flash">gemini-2.5-flash (Fast & Recommended)</option>
                <option value="gemini-3.5-flash-lite">gemini-3.5-flash-lite (Ultra Lightweight)</option>
                <option value="gemini-3.5-flash">gemini-3.5-flash (Balanced)</option>
                <option value="gemini-3.8-flash">gemini-3.8-flash (High Accuracy)</option>
              </select>
            </div>

            {/* Live Test Status Message */}
            {testResult && (
              <div
                className={`p-3.5 rounded-xl text-xs flex items-center gap-2.5 ${
                  testResult.success
                    ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400'
                    : 'bg-destructive/10 border border-destructive/20 text-destructive'
                }`}
              >
                {testResult.success ? (
                  <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
                ) : (
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                )}
                <span>{testResult.message}</span>
              </div>
            )}

            {saveError && (
              <div className="p-3.5 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>{saveError}</span>
              </div>
            )}

            {/* Modal Buttons */}
            <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-3">
              <button
                type="button"
                onClick={handleTestKey}
                disabled={testing || !apiKey.trim()}
                className="w-full sm:w-auto inline-flex items-center justify-center space-x-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-secondary hover:bg-muted text-secondary-foreground border border-border disabled:opacity-50 transition-colors"
              >
                <Radio className={`w-3.5 h-3.5 ${testing ? 'animate-pulse text-primary' : ''}`} />
                <span>{testing ? 'Testing Key...' : 'Test Connection'}</span>
              </button>

              <div className="flex items-center gap-2 w-full sm:w-auto">
                <button
                  type="button"
                  onClick={onClose}
                  className="w-1/2 sm:w-auto px-4 py-2 rounded-xl text-xs font-semibold text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving || !apiKey.trim()}
                  className="w-1/2 sm:w-auto inline-flex items-center justify-center space-x-2 px-5 py-2 rounded-xl text-xs font-semibold bg-primary hover:bg-primary-hover disabled:opacity-50 text-primary-foreground shadow-sm transition-all shadow-primary/20"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>{saving ? 'Saving...' : 'Save & Continue'}</span>
                </button>
              </div>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};
