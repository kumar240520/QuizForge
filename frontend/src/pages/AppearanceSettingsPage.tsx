import React from 'react';
import {
  Sun,
  Moon,
  Laptop,
  CheckCircle2,
  Palette
} from 'lucide-react';
import { useTheme } from '../context/ThemeContext';

export const AppearanceSettingsPage: React.FC = () => {
  const { theme, setTheme, isDark } = useTheme();

  return (
    <div className="max-w-3xl mx-auto space-y-6 animate-fadeIn pb-16">
      <div>
        <h2 className="text-2xl font-bold tracking-tight text-foreground">
          Appearance & Themes
        </h2>
        <p className="text-sm text-muted-foreground mt-0.5">
          Customize the visual presentation of QuizForge across all dashboards and assessment screens.
        </p>
      </div>

      <div className="p-6 md:p-8 rounded-2xl bg-card border border-border shadow-sm space-y-6">
        <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
          <Palette className="w-4 h-4 text-primary" />
          Color Theme
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {/* Light Theme */}
          <div
            onClick={() => setTheme('light')}
            className={`p-5 rounded-2xl border cursor-pointer transition-all ${
              theme === 'light'
                ? 'border-primary ring-2 ring-primary/20 bg-primary/5 shadow-sm'
                : 'border-border bg-background hover:border-primary/40'
            }`}
          >
            <div className="w-9 h-9 rounded-xl bg-amber-500/10 text-amber-500 flex items-center justify-center mb-3">
              <Sun className="w-5 h-5" />
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm font-bold text-foreground">Light Theme</span>
              {theme === 'light' && <CheckCircle2 className="w-4 h-4 text-primary" />}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Crisp light slate background with high-contrast text for bright environments.
            </p>
          </div>

          {/* Dark Theme */}
          <div
            onClick={() => setTheme('dark')}
            className={`p-5 rounded-2xl border cursor-pointer transition-all ${
              theme === 'dark'
                ? 'border-primary ring-2 ring-primary/20 bg-primary/5 shadow-sm'
                : 'border-border bg-background hover:border-primary/40'
            }`}
          >
            <div className="w-9 h-9 rounded-xl bg-indigo-500/10 text-indigo-400 flex items-center justify-center mb-3">
              <Moon className="w-5 h-5" />
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm font-bold text-foreground">Dark Theme</span>
              {theme === 'dark' && <CheckCircle2 className="w-4 h-4 text-primary" />}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Deep navy-slate interface optimized for focused, reduced-strain study sessions.
            </p>
          </div>

          {/* System Theme */}
          <div
            onClick={() => setTheme('system')}
            className={`p-5 rounded-2xl border cursor-pointer transition-all ${
              theme === 'system'
                ? 'border-primary ring-2 ring-primary/20 bg-primary/5 shadow-sm'
                : 'border-border bg-background hover:border-primary/40'
            }`}
          >
            <div className="w-9 h-9 rounded-xl bg-muted text-muted-foreground flex items-center justify-center mb-3">
              <Laptop className="w-5 h-5" />
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm font-bold text-foreground">System Default</span>
              {theme === 'system' && <CheckCircle2 className="w-4 h-4 text-primary" />}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Automatically adapts with your operating system preference.
            </p>
          </div>
        </div>

        <div className="pt-4 border-t border-border text-xs text-muted-foreground">
          Current active rendering: <strong>{isDark ? 'Dark Mode' : 'Light Mode'}</strong>
        </div>
      </div>
    </div>
  );
};
