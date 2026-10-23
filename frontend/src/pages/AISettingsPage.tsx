import React, { useEffect, useState } from 'react';
import {
  Bot,
  Key,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  Save,
  Radio,
  ExternalLink,
  Eye,
  EyeOff,
  ClipboardPaste,
  Trash2,
  HelpCircle,
  Sparkles
} from 'lucide-react';
import { api } from '../services/api';
import { authService } from '../services/auth';
import { AISettings } from '../types';

export const AISettingsPage: React.FC = () => {
  const [settings, setSettings] = useState<AISettings | null>(null);
  const [apiKeyInput, setApiKeyInput] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [selectedModel, setSelectedModel] = useState('gemini-2.5-flash');
  
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.getAISettings()
      .then(res => {
        setSettings(res);
        setSelectedModel(res.model_name || 'gemini-2.5-flash');
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const handlePasteClipboard = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text && text.trim()) {
        setApiKeyInput(text.trim());
      }
    } catch {
      // ignore
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSaveSuccess(false);
    try {
      const cleaned = apiKeyInput.trim();
      await api.updateAISettings({
        api_key: cleaned ? cleaned : undefined,
        model_name: selectedModel
      });

      if (cleaned) {
        localStorage.setItem('quizforge_user_gemini_key', cleaned);
        const currentUser = authService.getUser();
        if (currentUser) {
          currentUser.is_gemini_configured = true;
          currentUser.masked_gemini_key = `${cleaned.slice(0, 6)}...${cleaned.slice(-4)}`;
          authService.setUser(currentUser);
        }
      }

      const updated = await api.getAISettings();
      setSettings(updated);
      setApiKeyInput('');
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 4000);
    } catch (err: any) {
      alert(err.message || 'Failed to update AI settings.');
    } finally {
      setSaving(false);
    }
  };

  const handleRemoveKey = async () => {
    if (!window.confirm('Are you sure you want to remove your Gemini API key? AI question generation will be disabled until a new key is added.')) {
      return;
    }
    setSaving(true);
    try {
      await api.updateAISettings({
        api_key: '',
        model_name: selectedModel
      });
      localStorage.removeItem('quizforge_user_gemini_key');
      const currentUser = authService.getUser();
      if (currentUser) {
        currentUser.is_gemini_configured = false;
        currentUser.masked_gemini_key = null;
        authService.setUser(currentUser);
      }
      const updated = await api.getAISettings();
      setSettings(updated);
      setApiKeyInput('');
      setTestResult(null);
    } catch (err: any) {
      alert(err.message || 'Failed to remove API key.');
    } finally {
      setSaving(false);
    }
  };

  const handleTestConnection = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const res = await api.testAIConnection({
        api_key: apiKeyInput ? apiKeyInput : undefined,
        model_name: selectedModel
      });
      setTestResult(res);
    } catch (err: any) {
      setTestResult({ success: false, message: err.message || 'Connection test failed.' });
    } finally {
      setTesting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[300px]">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6 animate-fadeIn pb-16">
      <div>
        <h2 className="text-2xl font-bold tracking-tight text-foreground">
          AI Provider Configuration
        </h2>
        <p className="text-sm text-muted-foreground mt-0.5">
          Configure Google Gemini API credentials for AI question generation and source-grounded extraction.
        </p>
      </div>

      <div className="p-6 md:p-8 rounded-2xl bg-card border border-border shadow-sm space-y-6">
        {/* Security Notice */}
        <div className="p-4 rounded-xl bg-primary/5 border border-primary/20 text-xs text-muted-foreground flex items-start gap-3 leading-relaxed">
          <ShieldCheck className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
          <div>
            <strong className="text-foreground block">Private Credential Isolation</strong>
            All Gemini API calls and question formulations execute through authenticated backend channels. Each user account can configure their own personal key, allowing full access even if the repository is cloned without an environment file.
          </div>
        </div>

        {/* Current Status */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-xl bg-background border border-border">
          <div className="flex items-center space-x-3">
            <div className={`w-3 h-3 rounded-full ${settings?.is_key_configured ? 'bg-emerald-500' : 'bg-amber-500'}`} />
            <div>
              <span className="text-xs font-bold text-foreground block">
                {settings?.is_key_configured ? 'Gemini API Key Configured' : 'API Key Not Configured'}
              </span>
              <span className="text-[11px] text-muted-foreground">
                {settings?.masked_key ? `Active key: ${settings.masked_key}` : 'Set an API key to enable AI generation'}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 self-end sm:self-auto">
            {settings?.is_key_configured && (
              <button
                type="button"
                onClick={handleRemoveKey}
                disabled={saving}
                className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-destructive hover:bg-destructive/10 transition-colors"
                title="Remove current key"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Remove</span>
              </button>
            )}

            <button
              type="button"
              onClick={handleTestConnection}
              disabled={testing}
              className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-secondary hover:bg-muted text-secondary-foreground border border-border transition-colors"
            >
              <Radio className={`w-3.5 h-3.5 ${testing ? 'animate-pulse text-primary' : ''}`} />
              <span>{testing ? 'Testing...' : 'Test Connection'}</span>
            </button>
          </div>
        </div>

        {/* Step-by-Step Instructions */}
        <div className="p-4 rounded-xl border border-border bg-muted/20 space-y-2.5 text-xs">
          <div className="font-semibold text-foreground flex items-center gap-2">
            <HelpCircle className="w-4 h-4 text-primary" />
            <span>How to get a free Google Gemini API Key</span>
          </div>
          <ol className="list-decimal list-inside space-y-1.5 text-muted-foreground">
            <li>
              Go to{' '}
              <a
                href="https://aistudio.google.com/app/apikey"
                target="_blank"
                rel="noreferrer"
                className="text-primary font-semibold hover:underline inline-flex items-center gap-1"
              >
                Google AI Studio <ExternalLink className="w-3 h-3" />
              </a>{' '}
              and sign in with your Google account.
            </li>
            <li>Click <strong>"Create API key"</strong>.</li>
            <li>Copy the API key and paste it below.</li>
          </ol>
        </div>

        {/* Test Result Message */}
        {testResult && (
          <div className={`p-4 rounded-xl text-xs flex items-center gap-2.5 ${
            testResult.success
              ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400'
              : 'bg-destructive/10 border border-destructive/20 text-destructive'
          }`}>
            {testResult.success ? <CheckCircle2 className="w-4 h-4 flex-shrink-0" /> : <AlertCircle className="w-4 h-4 flex-shrink-0" />}
            <span>{testResult.message}</span>
          </div>
        )}

        {saveSuccess && (
          <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-xs flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
            <span>AI settings saved successfully!</span>
          </div>
        )}

        {/* Configuration Form */}
        <form onSubmit={handleSave} className="space-y-4 pt-2">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-foreground flex items-center justify-between">
              <span>Google Gemini API Key</span>
              <button
                type="button"
                onClick={handlePasteClipboard}
                className="text-primary hover:underline font-normal inline-flex items-center gap-1 text-xs"
              >
                <ClipboardPaste className="w-3 h-3" /> Paste from clipboard
              </button>
            </label>
            <div className="relative">
              <Key className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                type={showKey ? 'text' : 'password'}
                value={apiKeyInput}
                onChange={e => setApiKeyInput(e.target.value)}
                placeholder={settings?.is_key_configured ? '•••••••••••••••••••••••••••••• (enter new key to update)' : 'AIzaSy...'}
                className="w-full pl-9 pr-10 py-2.5 rounded-xl bg-background border border-input text-foreground text-xs font-mono focus:ring-2 focus:ring-primary/40 focus:outline-none"
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

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-foreground">Target Gemini Model</label>
            <select
              value={selectedModel}
              onChange={e => setSelectedModel(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl bg-background border border-input text-foreground text-xs focus:ring-2 focus:ring-primary/40 focus:outline-none"
            >
              <option value="gemini-2.5-flash">gemini-2.5-flash (Fast & Recommended)</option>
              <option value="gemini-3.5-flash-lite">gemini-3.5-flash-lite (Ultra Lightweight)</option>
              <option value="gemini-3.5-flash">gemini-3.5-flash (Balanced)</option>
              <option value="gemini-3.8-flash">gemini-3.8-flash (High Accuracy)</option>
            </select>
          </div>

          <div className="pt-4 flex justify-end">
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center space-x-2 px-5 py-2.5 rounded-xl text-xs font-semibold bg-primary hover:bg-primary-hover disabled:opacity-50 text-primary-foreground shadow-sm transition-all"
            >
              <Save className="w-3.5 h-3.5" />
              <span>{saving ? 'Saving...' : 'Save AI Configuration'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
