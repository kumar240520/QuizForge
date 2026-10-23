import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { authService } from '../../services/auth';

interface AuthGuardProps {
  children: React.ReactNode;
  requireAdmin?: boolean;
}

export const AuthGuard: React.FC<AuthGuardProps> = ({ children, requireAdmin = false }) => {
  const location = useLocation();
  const isAuth = authService.isAuthenticated();

  if (!isAuth) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (requireAdmin && !authService.isAdmin()) {
    return (
      <div className="p-8 text-center max-w-md mx-auto my-12 rounded-2xl bg-card border border-destructive/20 text-destructive">
        <h3 className="text-base font-bold">Access Restricted</h3>
        <p className="text-xs text-muted-foreground mt-1">
          This section requires Administrator privileges.
        </p>
      </div>
    );
  }

  return <>{children}</>;
};
