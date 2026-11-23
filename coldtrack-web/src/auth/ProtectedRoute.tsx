import React from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import type { VaiTro } from '../mock/types';
import { useAuth } from './AuthContext';
import { ForbiddenPage } from './ForbiddenPage';

interface ProtectedRouteProps {
  allowedRoles?: VaiTro[];
  children?: React.ReactNode;
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({
  allowedRoles,
  children,
}) => {
  const { currentUser, isAuthenticated } = useAuth();
  const location = useLocation();

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location.pathname + location.search + location.hash }} replace />;
  }

  if (allowedRoles && !allowedRoles.includes(currentUser.vaiTro)) {
    return <ForbiddenPage />;
  }

  return children ? <>{children}</> : <Outlet />;
};

