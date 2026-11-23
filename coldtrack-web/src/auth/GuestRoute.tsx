import type { ReactNode } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from './AuthContext';
import { postLoginDestination } from './navigation';
export function GuestRoute({ children }: { children?: ReactNode }) { const { currentUser, isAuthenticated } = useAuth(); const location = useLocation(); if (isAuthenticated) return <Navigate to={postLoginDestination(currentUser.vaiTro, (location.state as { from?: unknown } | null)?.from)} replace />; return children ?? <Outlet />; }
