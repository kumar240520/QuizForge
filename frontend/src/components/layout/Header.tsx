import React, { useState, useEffect } from 'react';
import { useLocation, Link, useNavigate } from 'react-router-dom';
import {
  Menu,
  Sun,
  Moon,
  Laptop,
  Plus,
  Bot,
  CheckCircle2,
  AlertCircle,
  LogOut,
  User as UserIcon,
  ShieldCheck
} from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';
import { api } from '../../services/api';
import { authService } from '../../services/auth';
import { User } from '../../types';

interface HeaderProps {
  onOpenMobile: () => void;
}

export const Header: React.FC<HeaderProps> = ({ onOpenMobile }) => {
  const { theme, setTheme } = useTheme();
  const location = useLocation();
  const navigate = useNavigate();
  const [isAiConfigured, setIsAiConfigured] = useState<boolean | null>(null);
  const [currentUser, setCurrentUser] = useState<User | null>(authService.getUser());

  useEffect(() => {
    if (authService.isAuthenticated()) {
      authService.getMe().then(setCurrentUser).catch(() => {});
    }
  }, [location.pathname]);

  useEffect(() => {
    api.getAISettings()
      .then(res => setIsAiConfigured(res.is_key_configured))
      .catch(() => setIsAiConfigured(false));
  }, [location.pathname]);

  const cycleTheme = () => {
    if (theme === 'light') setTheme('dark');
    else if (theme === 'dark') setTheme('system');
    else setTheme('light');
  };

  const getBreadcrumbTitle = () => {
    const path = location.pathname;
    if (path === '/') return 'Dashboard';
    if (path.startsWith('/assessments')) return 'Assessments';
    if (path.startsWith('/create-assessment')) return 'Create Assessment Wizard';
    if (path.startsWith('/questions')) return 'Question Bank';
    if (path.startsWith('/imports')) return 'Document & Text Imports';
    if (path.startsWith('/revision')) return 'Revision Center';
    if (path.startsWith('/analytics')) return 'Performance Analytics';
    if (path.startsWith('/history')) return 'Attempt History';
    if (path.startsWith('/results')) return 'Assessment Results';
    if (path.startsWith('/settings/ai')) return 'AI Provider Configuration';
    if (path.startsWith('/settings/appearance')) return 'Appearance';
    if (path.startsWith('/settings/data')) return 'Data Management';
    if (path.startsWith('/settings/preferences')) return 'Application Preferences';
    return 'QuizForge';
  };

  return (
    <header className="sticky top-0 z-10 flex items-center justify-between h-16 px-4 md:px-8 bg-card/80 backdrop-blur border-b border-border">
      <div className="flex items-center space-x-3">
        <button
          onClick={onOpenMobile}
          className="md:hidden p-2 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground"
          aria-label="Open navigation menu"
        >
          <Menu className="w-5 h-5" />
        </button>

        <div className="flex flex-col">
          <h1 className="text-base font-semibold text-foreground tracking-tight">
            {getBreadcrumbTitle()}
          </h1>
        </div>
      </div>

      <div className="flex items-center space-x-3">
        {/* AI Key Status Indicator */}
        <Link
          to="/settings/ai"
          className="hidden sm:flex items-center space-x-1.5 px-2.5 py-1.5 rounded-full text-xs font-medium bg-muted hover:bg-accent transition-colors text-muted-foreground hover:text-foreground"
          title={isAiConfigured ? 'Gemini AI configured and ready' : 'Gemini AI key not set (click to configure)'}
        >
          <Bot className="w-3.5 h-3.5" />
          <span>Gemini</span>
          {isAiConfigured === true ? (
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
          ) : (
            <span className="w-2 h-2 rounded-full bg-amber-500" />
          )}
        </Link>

        {/* Theme Switcher Button */}
        <button
          onClick={cycleTheme}
          className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors relative"
          title={`Theme: ${theme.toUpperCase()} (Click to toggle)`}
          aria-label="Toggle visual theme"
        >
          {theme === 'light' && <Sun className="w-4 h-4 text-amber-500" />}
          {theme === 'dark' && <Moon className="w-4 h-4 text-indigo-400" />}
          {theme === 'system' && <Laptop className="w-4 h-4 text-muted-foreground" />}
        </button>

        {/* Primary CTA */}
        <button
          onClick={() => navigate('/create-assessment')}
          className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-primary hover:bg-primary-hover text-primary-foreground shadow-sm transition-colors"
        >
          <Plus className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">New Assessment</span>
        </button>

        {/* User Profile & Auth Controls */}
        {currentUser ? (
          <div className="flex items-center pl-2 ml-1 border-l border-border space-x-2">
            <div className="hidden md:flex flex-col items-end text-right">
              <span className="text-xs font-bold text-foreground leading-tight">
                {currentUser.full_name || currentUser.username}
              </span>
              <span className="inline-flex items-center gap-1 text-[10px] font-medium text-muted-foreground">
                {currentUser.role === 'admin' ? (
                  <span className="text-indigo-500 font-semibold flex items-center gap-0.5">
                    <ShieldCheck className="w-3 h-3" /> Admin
                  </span>
                ) : (
                  <span className="text-emerald-500 font-medium">Candidate</span>
                )}
              </span>
            </div>

            <div
              className="w-8 h-8 rounded-full bg-primary/10 border border-primary/20 text-primary flex items-center justify-center font-bold text-xs uppercase"
              title={`${currentUser.username} (${currentUser.role})`}
            >
              {currentUser.username.slice(0, 2)}
            </div>

            <button
              onClick={() => authService.logout()}
              className="p-2 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
              title="Sign Out"
              aria-label="Sign Out"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <Link
            to="/login"
            className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-muted hover:bg-muted/80 text-foreground transition-colors"
          >
            <span>Sign In</span>
          </Link>
        )}
      </div>
    </header>
  );
};
