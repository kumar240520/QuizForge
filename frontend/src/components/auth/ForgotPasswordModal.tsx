import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { X, KeyRound, Lock, Mail, AlertCircle, CheckCircle2, ShieldCheck, ArrowRight } from 'lucide-react';
import { authService } from '../../services/auth';

interface ForgotPasswordModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultEmailOrUsername?: string;
}

export const ForgotPasswordModal: React.FC<ForgotPasswordModalProps> = ({
  isOpen,
  onClose,
  defaultEmailOrUsername = ''
}) => {
  const navigate = useNavigate();
  const [emailOrUsername, setEmailOrUsername] = useState(defaultEmailOrUsername);
  const [adminTotpCode, setAdminTotpCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Sync if prop changes
  React.useEffect(() => {
    if (defaultEmailOrUsername) {
      setEmailOrUsername(defaultEmailOrUsername);
    }
  }, [defaultEmailOrUsername]);

  if (!isOpen) return null;

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const cleanId = emailOrUsername.trim();
    const cleanOtp = adminTotpCode.trim();

    if (!cleanId) {
      setError('Please provide your Username or Registered Email.');
      return;
    }
    if (!cleanOtp || cleanOtp.length !== 6) {
      setError('Please enter the exact 6-digit Admin Authorization Code.');
      return;
    }
    if (newPassword.length < 6) {
      setError('New password must be at least 6 characters long.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('Passwords do not match. Please re-enter to confirm.');
      return;
    }

    setLoading(true);
    try {
      await authService.forgotPasswordReset({
        email_or_username: cleanId,
        admin_totp_code: cleanOtp,
        new_password: newPassword
      });
      setSuccess(true);
      setTimeout(() => {
        onClose();
        navigate('/');
      }, 1500);
    } catch (err: any) {
      setError(err.message || 'Password reset failed. Please verify the Admin OTP and try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-fadeIn">
      <div 
        className="w-full max-w-md bg-card border border-border rounded-3xl shadow-2xl p-6 sm:p-7 relative space-y-5 text-foreground"
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
          <div className="w-10 h-10 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary shrink-0">
            <KeyRound className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-foreground">Reset Password</h3>
            <p className="text-xs text-muted-foreground">Admin 2FA Authorization Gatekeeper</p>
          </div>
        </div>

        {/* Instructions banner */}
        <div className="p-3 rounded-2xl bg-primary/5 border border-primary/20 text-xs text-muted-foreground leading-relaxed flex items-start gap-2.5">
          <ShieldCheck className="w-4 h-4 text-primary shrink-0 mt-0.5" />
          <span>
            To reset your password, contact the <strong>System Administrator</strong> to obtain the live 6-digit Google Authenticator OTP code.
          </span>
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
            <span className="font-bold text-sm">Password Reset Successful!</span>
            <span className="text-xs text-muted-foreground">
              Logging you into QuizForge automatically...
            </span>
          </div>
        ) : (
          <form onSubmit={handleReset} className="space-y-3.5 text-xs">
            {/* Username or Email */}
            <div className="space-y-1">
              <label className="font-semibold text-foreground">Username or Email</label>
              <div className="relative">
                <Mail className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input
                  type="text"
                  required
                  value={emailOrUsername}
                  onChange={e => setEmailOrUsername(e.target.value)}
                  placeholder="admin or user@domain.com"
                  className="w-full pl-9 pr-4 py-2 sm:py-2.5 rounded-xl bg-background border border-input text-foreground text-xs focus:ring-2 focus:ring-primary/40"
                />
              </div>
            </div>

            {/* Admin 2FA Code */}
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <label className="font-bold text-foreground flex items-center gap-1.5">
                  <KeyRound className="w-3.5 h-3.5 text-primary" />
                  <span>Admin 2FA Authorization Code</span>
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
                className="w-full px-4 py-2 sm:py-2.5 rounded-xl bg-background border border-input text-foreground text-center font-mono font-bold text-sm tracking-widest focus:ring-2 focus:ring-primary/40"
              />
            </div>

            {/* New Password */}
            <div className="space-y-1">
              <label className="font-semibold text-foreground">New Password</label>
              <div className="relative">
                <Lock className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input
                  type="password"
                  required
                  minLength={6}
                  value={newPassword}
                  onChange={e => setNewPassword(e.target.value)}
                  placeholder="Min. 6 characters"
                  className="w-full pl-9 pr-4 py-2 sm:py-2.5 rounded-xl bg-background border border-input text-foreground text-xs focus:ring-2 focus:ring-primary/40"
                />
              </div>
            </div>

            {/* Confirm Password */}
            <div className="space-y-1">
              <label className="font-semibold text-foreground">Confirm New Password</label>
              <div className="relative">
                <Lock className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input
                  type="password"
                  required
                  minLength={6}
                  value={confirmPassword}
                  onChange={e => setConfirmPassword(e.target.value)}
                  placeholder="Re-enter new password"
                  className="w-full pl-9 pr-4 py-2 sm:py-2.5 rounded-xl bg-background border border-input text-foreground text-xs focus:ring-2 focus:ring-primary/40"
                />
              </div>
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
                disabled={loading}
                className="flex-1 py-2.5 px-4 rounded-xl text-xs font-bold bg-primary hover:bg-primary-hover disabled:opacity-50 text-primary-foreground shadow-sm shadow-primary/20 transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                {loading ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Resetting...</span>
                  </>
                ) : (
                  <>
                    <span>Confirm Reset</span>
                    <ArrowRight className="w-4 h-4" />
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
