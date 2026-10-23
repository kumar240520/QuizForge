import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  Shield,
  Lock,
  Mail,
  User as UserIcon,
  ArrowRight,
  AlertCircle,
  KeyRound,
  Sparkles,
  ExternalLink,
  Eye,
  EyeOff,
  ChevronDown,
  ChevronUp,
  ClipboardPaste,
  HelpCircle,
  CheckCircle2,
  ShieldCheck
} from 'lucide-react';
import { authService } from '../services/auth';
import { api } from '../services/api';

export const RegisterPage: React.FC = () => {
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [fullName, setFullName] = useState('');
  const [password, setPassword] = useState('');
  const [adminTotpCode, setAdminTotpCode] = useState('');
  
  // Gemini API Key Onboarding state
  const [geminiApiKey, setGeminiApiKey] = useState('');
  const [showApiKey, setShowApiKey] = useState(false);
  const [showInstructions, setShowInstructions] = useState(false);
  const [testingKey, setTestingKey] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handlePasteClipboard = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text && text.trim()) {
        setGeminiApiKey(text.trim());
        setTestResult(null);
      }
    } catch {
      // Browser clipboard permission denied or not supported
    }
  };

  const handleTestKey = async () => {
    if (!geminiApiKey.trim()) {
      setTestResult({ success: false, message: 'Please paste or enter your Gemini API key first.' });
      return;
    }
    setTestingKey(true);
    setTestResult(null);
    try {
      const res = await api.testAIConnection({
        api_key: geminiApiKey.trim(),
        model_name: 'gemini-2.5-flash'
      });
      setTestResult(res);
    } catch (err: any) {
      setTestResult({
        success: false,
        message: err.message || 'Connection test failed. Check your network or verify the key.'
      });
    } finally {
      setTestingKey(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !email.trim() || !password || !adminTotpCode.trim()) {
      setError('All fields including the 6-digit Admin Authorization Code are required.');
      return;
    }
    if (adminTotpCode.trim().length !== 6) {
      setError('Admin Authorization Code must be exactly 6 digits.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      await authService.signup({
        username: username.trim(),
        email: email.trim(),
        password,
        full_name: fullName.trim() || undefined,
        admin_totp_code: adminTotpCode.trim(),
        gemini_api_key: geminiApiKey.trim() || undefined
      });
      navigate('/');
    } catch (err: any) {
      setError(err.message || 'Registration failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center p-3 sm:p-6 bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-100">
      <div className="max-w-md w-full space-y-5 animate-fadeIn py-4">
        {/* App Logo & Title */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-primary text-white shadow-lg shadow-primary/30 mb-1">
            <Shield className="w-6 h-6 sm:w-7 sm:h-7" />
          </div>
          <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight text-foreground">
            Activate QuizForge Account
          </h1>
          <p className="text-xs text-muted-foreground max-w-xs mx-auto leading-relaxed">
            Invite-only registration gated by the System Administrator
          </p>
        </div>

        {/* Card */}
        <div className="p-5 sm:p-7 rounded-3xl bg-card border border-border shadow-sm space-y-4">
          <div className="border-b border-border pb-3">
            <h2 className="text-base font-bold text-foreground">Sign Up</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Create your profile. You only need the admin authorization code once during sign up.
            </p>
          </div>

          {error && (
            <div className="p-3 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-3.5 text-xs">
            {/* Username */}
            <div className="space-y-1">
              <label className="font-semibold text-foreground">Username</label>
              <div className="relative">
                <UserIcon className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input
                  type="text"
                  required
                  value={username}
                  onChange={e => setUsername(e.target.value)}
                  placeholder="e.g. alex2026"
                  className="w-full pl-9 pr-4 py-2 sm:py-2.5 rounded-xl bg-background border border-input text-foreground text-sm sm:text-xs focus:ring-2 focus:ring-primary/40"
                />
              </div>
            </div>

            {/* Email */}
            <div className="space-y-1">
              <label className="font-semibold text-foreground">Email Address</label>
              <div className="relative">
                <Mail className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="alex@domain.com"
                  className="w-full pl-9 pr-4 py-2 sm:py-2.5 rounded-xl bg-background border border-input text-foreground text-sm sm:text-xs focus:ring-2 focus:ring-primary/40"
                />
              </div>
            </div>

            {/* Full Name */}
            <div className="space-y-1">
              <label className="font-semibold text-foreground">Full Name (Optional)</label>
              <div className="relative">
                <UserIcon className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input
                  type="text"
                  value={fullName}
                  onChange={e => setFullName(e.target.value)}
                  placeholder="Alex Morgan"
                  className="w-full pl-9 pr-4 py-2 sm:py-2.5 rounded-xl bg-background border border-input text-foreground text-sm sm:text-xs focus:ring-2 focus:ring-primary/40"
                />
              </div>
            </div>

            {/* Password */}
            <div className="space-y-1">
              <label className="font-semibold text-foreground">Password</label>
              <div className="relative">
                <Lock className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input
                  type="password"
                  required
                  minLength={6}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="Create a strong password"
                  className="w-full pl-9 pr-4 py-2 sm:py-2.5 rounded-xl bg-background border border-input text-foreground text-sm sm:text-xs focus:ring-2 focus:ring-primary/40"
                />
              </div>
            </div>

            {/* Admin Authorization Code */}
            <div className="space-y-1.5 pt-1">
              <div className="flex items-center justify-between">
                <label className="font-bold text-foreground flex items-center gap-1.5">
                  <KeyRound className="w-3.5 h-3.5 text-primary" />
                  <span>Admin Authorization Code</span>
                </label>
                <span className="text-[10px] text-muted-foreground font-mono">6 Digits</span>
              </div>
              <input
                type="text"
                required
                maxLength={6}
                value={adminTotpCode}
                onChange={e => setAdminTotpCode(e.target.value.replace(/\D/g, ''))}
                placeholder="123456"
                className="w-full px-4 py-2.5 rounded-xl bg-background border border-input text-foreground text-center font-mono font-bold text-base sm:text-sm tracking-widest focus:ring-2 focus:ring-primary/40"
              />
              <p className="text-[11px] text-muted-foreground leading-normal">
                Ask the system administrator for the current 6-digit code from their Google Authenticator to activate your account.
              </p>
            </div>

            {/* Gemini API Key Onboarding Section */}
            <div className="pt-2 border-t border-border space-y-2">
              <div className="flex items-center justify-between">
                <label className="font-bold text-foreground flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-indigo-500" />
                  <span>Gemini AI API Key</span>
                  <span className="px-1.5 py-0.2 rounded text-[9px] font-bold uppercase tracking-wider bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20">
                    Optional
                  </span>
                </label>
                <button
                  type="button"
                  onClick={handlePasteClipboard}
                  className="text-[11px] text-primary hover:underline font-semibold inline-flex items-center gap-1 cursor-pointer"
                >
                  <ClipboardPaste className="w-3 h-3" /> Paste
                </button>
              </div>

              <div className="relative">
                <input
                  type={showApiKey ? 'text' : 'password'}
                  value={geminiApiKey}
                  onChange={e => {
                    setGeminiApiKey(e.target.value);
                    setTestResult(null);
                  }}
                  placeholder="AIzaSy... (leave empty to configure later)"
                  className="w-full pl-3 pr-10 py-2 sm:py-2.5 rounded-xl bg-background border border-input text-foreground font-mono text-xs focus:ring-2 focus:ring-primary/40"
                />
                <button
                  type="button"
                  onClick={() => setShowApiKey(!showApiKey)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showApiKey ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                </button>
              </div>

              {/* Test key button if key is entered */}
              {geminiApiKey.trim() && (
                <div className="flex items-center justify-between pt-0.5">
                  <button
                    type="button"
                    onClick={handleTestKey}
                    disabled={testingKey}
                    className="text-[11px] font-semibold text-primary hover:underline cursor-pointer flex items-center gap-1"
                  >
                    {testingKey ? 'Testing connection...' : '✓ Test Key Connection'}
                  </button>
                </div>
              )}

              {/* Test Result Message */}
              {testResult && (
                <div
                  className={`p-2 rounded-xl text-[11px] flex items-center gap-2 ${
                    testResult.success
                      ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
                      : 'bg-destructive/10 text-destructive border border-destructive/20'
                  }`}
                >
                  {testResult.success ? (
                    <CheckCircle2 className="w-3.5 h-3.5 shrink-0 text-emerald-500" />
                  ) : (
                    <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                  )}
                  <span>{testResult.message}</span>
                </div>
              )}

              {/* Collapsible How-To Guide */}
              <div className="rounded-xl border border-border bg-muted/20 overflow-hidden mt-1">
                <button
                  type="button"
                  onClick={() => setShowInstructions(!showInstructions)}
                  className="w-full px-3 py-2 flex items-center justify-between text-[11px] font-semibold text-foreground hover:bg-muted/40 transition-colors"
                >
                  <span className="flex items-center gap-1.5">
                    <HelpCircle className="w-3.5 h-3.5 text-primary" />
                    How to get your free Gemini Key (30 seconds)
                  </span>
                  {showInstructions ? (
                    <ChevronUp className="w-3.5 h-3.5 text-muted-foreground" />
                  ) : (
                    <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
                  )}
                </button>

                {showInstructions && (
                  <div className="p-3 space-y-2 text-[11px] border-t border-border bg-background">
                    <ol className="space-y-1.5 text-muted-foreground">
                      <li className="flex items-start gap-2">
                        <span className="flex items-center justify-center w-4 h-4 rounded-full bg-primary/10 text-primary font-bold text-[10px] shrink-0 mt-0.5">
                          1
                        </span>
                        <div>
                          <span>Visit </span>
                          <a
                            href="https://aistudio.google.com/app/apikey"
                            target="_blank"
                            rel="noreferrer"
                            className="text-primary font-semibold hover:underline inline-flex items-center gap-0.5"
                          >
                            Google AI Studio <ExternalLink className="w-2.5 h-2.5" />
                          </a>
                          <span> and sign in.</span>
                        </div>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="flex items-center justify-center w-4 h-4 rounded-full bg-primary/10 text-primary font-bold text-[10px] shrink-0 mt-0.5">
                          2
                        </span>
                        <span>Click the blue <strong>"Create API key"</strong> button.</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="flex items-center justify-center w-4 h-4 rounded-full bg-primary/10 text-primary font-bold text-[10px] shrink-0 mt-0.5">
                          3
                        </span>
                        <span>Copy the key and paste it above.</span>
                      </li>
                    </ol>
                    <div className="p-2 rounded-lg bg-primary/5 border border-primary/15 text-[10px] text-muted-foreground flex items-center gap-1.5">
                      <ShieldCheck className="w-3.5 h-3.5 text-primary shrink-0" />
                      <span>Saved strictly on your local machine and never shared externally.</span>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 px-4 rounded-xl text-xs font-bold bg-primary hover:bg-primary-hover disabled:opacity-50 text-primary-foreground shadow-sm shadow-primary/20 transition-all flex items-center justify-center gap-2 cursor-pointer mt-3"
            >
              {loading ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Verifying & Creating Account...</span>
                </>
              ) : (
                <>
                  <span>Create Account & Sign In</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          <div className="pt-3 border-t border-border text-center text-xs text-muted-foreground">
            <span>Already have an account? </span>
            <Link to="/login" className="font-semibold text-primary hover:underline">
              Sign In
            </Link>
          </div>
        </div>

        {/* Security badge */}
        <div className="flex items-center justify-center gap-2 text-[11px] text-muted-foreground">
          <KeyRound className="w-3.5 h-3.5 text-primary" />
          <span>Invite-only system protected by Google Authenticator</span>
        </div>
      </div>
    </div>
  );
};
