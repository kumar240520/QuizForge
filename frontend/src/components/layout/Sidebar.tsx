import React from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  FileCheck2,
  PlusCircle,
  Database,
  UploadCloud,
  RotateCcw,
  BarChart3,
  History,
  Bot,
  Palette,
  HardDrive,
  Sliders,
  ChevronLeft,
  ChevronRight,
  BrainCircuit,
  Sparkles,
  Users
} from 'lucide-react';
import { authService } from '../../services/auth';

interface SidebarProps {
  collapsed: boolean;
  onToggleCollapse: () => void;
  mobileOpen: boolean;
  onCloseMobile: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  collapsed,
  onToggleCollapse,
  mobileOpen,
  onCloseMobile
}) => {
  const isAdmin = authService.isAdmin();

  const navSections = [
    {
      title: 'Workspace',
      items: [
        { name: 'Dashboard', path: '/', icon: LayoutDashboard },
        { name: 'Assessments', path: '/assessments', icon: FileCheck2 },
        { name: 'Create Assessment', path: '/builder', icon: PlusCircle },
        { name: 'AI Question Generator', path: '/create-assessment?tab=ai', icon: Sparkles },
        { name: 'Import Questions', path: '/imports', icon: UploadCloud },
      ]
    },
    {
      title: 'Learning',
      items: [
        { name: 'Revision Center', path: '/revision', icon: RotateCcw },
        { name: 'Analytics', path: '/analytics', icon: BarChart3 },
        { name: 'Attempt History', path: '/history', icon: History },
      ]
    },
    {
      title: 'Settings',
      items: [
        { name: 'AI Provider', path: '/settings/ai', icon: Bot },
        { name: 'Appearance', path: '/settings/appearance', icon: Palette },
        { name: 'Data Management', path: '/settings/data', icon: HardDrive },
        { name: 'Preferences', path: '/settings/preferences', icon: Sliders },
      ]
    },
    ...(isAdmin ? [
      {
        title: 'Administration',
        items: [
          { name: 'User Directory', path: '/admin/users', icon: Users },
        ]
      }
    ] : [])
  ];

  const sidebarContent = (
    <div className="flex flex-col h-full bg-card border-r border-border select-none">
      {/* Brand Header */}
      <div className="flex items-center justify-between h-16 px-4 border-b border-border">
        <div className="flex items-center space-x-3 overflow-hidden">
          <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-primary text-primary-foreground shadow-sm flex-shrink-0">
            <BrainCircuit className="w-5 h-5" />
          </div>
          {!collapsed && (
            <div className="flex flex-col">
              <span className="font-bold text-base tracking-tight text-foreground leading-none">
                Quiz<span className="text-primary">Forge</span>
              </span>
              <span className="text-[10px] text-muted-foreground uppercase tracking-widest font-semibold mt-1">
                AI Assessment
              </span>
            </div>
          )}
        </div>
        <button
          onClick={onToggleCollapse}
          className="hidden md:flex p-1.5 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
        </button>
      </div>

      {/* Nav List */}
      <div className="flex-1 overflow-y-auto py-4 px-3 space-y-6">
        {navSections.map((section) => (
          <div key={section.title} className="space-y-1">
            {!collapsed && (
              <h3 className="px-3 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                {section.title}
              </h3>
            )}
            {section.items.map((item) => {
              const Icon = item.icon;
              return (
                <NavLink
                  key={item.path}
                  to={item.path}
                  onClick={onCloseMobile}
                  className={({ isActive }) => `
                    flex items-center ${collapsed ? 'justify-center px-2' : 'px-3'} py-2 rounded-lg text-sm font-medium transition-colors
                    ${
                      isActive
                        ? 'bg-primary text-primary-foreground shadow-sm'
                        : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                    }
                  `}
                  title={collapsed ? item.name : undefined}
                >
                  <Icon className={`w-4 h-4 flex-shrink-0 ${collapsed ? '' : 'mr-3'}`} />
                  {!collapsed && <span className="truncate">{item.name}</span>}
                </NavLink>
              );
            })}
          </div>
        ))}
      </div>

      {/* Footer Info */}
      {!collapsed && (
        <div className="p-4 border-t border-border text-xs text-muted-foreground">
          <div className="flex items-center justify-between">
            <span>QuizForge Core</span>
            <span className="px-1.5 py-0.5 rounded bg-muted text-[10px] font-mono">v1.0.0</span>
          </div>
        </div>
      )}
    </div>
  );

  return (
    <>
      {/* Desktop sidebar */}
      <aside
        className={`hidden md:block flex-shrink-0 transition-all duration-200 z-20 ${
          collapsed ? 'w-16' : 'w-64'
        }`}
      >
        <div className={`fixed top-0 bottom-0 ${collapsed ? 'w-16' : 'w-64'} transition-all duration-200`}>
          {sidebarContent}
        </div>
      </aside>

      {/* Mobile drawer backdrop */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 md:hidden"
          onClick={onCloseMobile}
        />
      )}

      {/* Mobile drawer */}
      <div
        className={`fixed inset-y-0 left-0 z-50 w-64 bg-card transform transition-transform duration-200 ease-in-out md:hidden ${
          mobileOpen ? 'translate-x-0' : '-translate-x-0 -translate-x-full'
        }`}
      >
        {sidebarContent}
      </div>
    </>
  );
};
