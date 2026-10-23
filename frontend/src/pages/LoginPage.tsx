import React, { useState } from 'react';
import { useNavigate, Link, useSearchParams } from 'react-router-dom';
import { Shield, Lock, Mail, ArrowRight, AlertCircle, KeyRound, Smartphone } from 'lucide-react';
import { authService } from '../services/auth';
import { ForgotPasswordModal } from '../components/auth/ForgotPasswordModal';

export const LoginPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const sessionReason = searchParams.get('reason');

  const [emailOrUsername, setEmailOrUsername] = useState('');
  const [password, setPassword] = useState('');
  const [isForgotModalOpen, setIsForgotModalOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!emailOrUsername.trim() || !password) {
      setError('Please provide your username/email and password.');
      return;
    }
    setLoading(true);
    setError(null);

    try {
      await authService.login({
        email_or_username: emailOrUsername.trim(),
        password
      });
      navigate('/');
    } catch (err: any) {
      setError(err.message || 'Login failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center p-4 bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-100">
      <div className="max-w-md w-full space-y-6 animate-fadeIn">
        {/* App Logo & Title */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-primary text-white shadow-lg shadow-primary/30 mb-1">
            <Shield className="w-7 h-7" />
          </div>
          <h1 className="text-2xl font-extrabold tracking-tight text-foreground">
            QuizForge
          </h1>
          <p className="text-xs text-muted-foreground max-w-xs mx-auto">
            Authorized Local & Proctored Assessment Engine
          </p>
        </div>

        {/* Card */}
        <div className="p-7 rounded-3xl bg-card border border-border shadow-sm space-y-5">
          <div className="border-b border-border pb-3">
            <h2 className="text-base font-bold text-foreground">Sign In</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Enter your credentials to access your assessments & question banks.
            </p>
          </div>

          {sessionReason === 'session_superseded' && !error && (
            <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-800 dark:text-amber-300 text-xs flex items-start gap-3">
              <Smartphone className="w-4 h-4 shrink-0 text-amber-500 mt-0.5" />
              <div className="space-y-0.5">
                <p className="font-semibold text-foreground">Single Device Policy Enforced</p>
                <p className="text-[11px] text-muted-foreground">
                  Your account was logged into on another device. Your previous session here has been automatically terminated. Sign in again to switch back to this device.
                </p>
              </div>
            </div>
          )}

          {sessionReason === 'session_expired' && !error && (
            <div className="p-3.5 rounded-2xl bg-blue-500/10 border border-blue-500/30 text-blue-800 dark:text-blue-300 text-xs flex items-start gap-3">
              <AlertCircle className="w-4 h-4 shrink-0 text-blue-500 mt-0.5" />
              <div className="space-y-0.5">
                <p className="font-semibold text-foreground">Session Expired</p>
                <p className="text-[11px] text-muted-foreground">
                  Your session has ended. Please log in again to continue.
                </p>
              </div>
            </div>
          )}

          {error && (
            <div className="p-3 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4 text-xs">
            <div className="space-y-1.5">
              <label className="font-semibold text-foreground">Username or Email</label>
              <div className="relative">
                <Mail className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input
                  type="text"
                  required
                  value={emailOrUsername}
                  onChange={e => setEmailOrUsername(e.target.value)}
                  placeholder="admin or user@domain.com"
                  className="w-full pl-9 pr-4 py-2.5 rounded-xl bg-background border border-input text-foreground text-xs focus:ring-2 focus:ring-primary/40"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="font-semibold text-foreground">Password</label>
                <button
                  type="button"
                  onClick={() => setIsForgotModalOpen(true)}
                  className="text-[11px] font-semibold text-primary hover:underline cursor-pointer transition-colors"
                >
                  Forgot password?
                </button>
              </div>
              <div className="relative">
                <Lock className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input
                  type="password"
                  required
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-9 pr-4 py-2.5 rounded-xl bg-background border border-input text-foreground text-xs focus:ring-2 focus:ring-primary/40"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 px-4 rounded-xl text-xs font-bold bg-primary hover:bg-primary-hover disabled:opacity-50 text-primary-foreground shadow-sm shadow-primary/20 transition-all flex items-center justify-center gap-2 cursor-pointer mt-2"
            >
              {loading ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Signing In...</span>
                </>
              ) : (
                <>
                  <span>Sign In to QuizForge</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          <div className="pt-3 border-t border-border text-center text-xs text-muted-foreground">
            <span>New user or need device activation? </span>
            <Link to="/register" className="font-semibold text-primary hover:underline">
              Register with Admin Key
            </Link>
          </div>
        </div>

        {/* Security badge */}
        <div className="flex items-center justify-center gap-2 text-[11px] text-muted-foreground">
          <KeyRound className="w-3.5 h-3.5 text-primary" />
          <span>Protected by Google Authenticator 2FA Gatekeeper</span>
        </div>
      </div>

      {/* Forgot Password Modal */}
      <ForgotPasswordModal
        isOpen={isForgotModalOpen}
        onClose={() => setIsForgotModalOpen(false)}
        defaultEmailOrUsername={emailOrUsername}
      />
    </div>
  );
};

