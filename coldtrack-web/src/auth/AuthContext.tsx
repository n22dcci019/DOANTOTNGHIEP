import { createContext, useContext, useState } from 'react';
import type { ReactNode } from 'react';
import type { NguoiDung, VaiTro } from '../mock/types';
import { MOCK_USERS } from '../mock/data';
interface AuthContextType {
  currentUser: NguoiDung;
  setRole: (role: VaiTro) => void;
  setUser: (user: NguoiDung) => void;
  isAuthenticated: boolean;
  logout: () => void;
  loginAs: (userKey: 'admin' | 'khachHang' | 'taiXe') => void;
}
const AuthContext = createContext<AuthContextType | undefined>(undefined);
export function AuthProvider({ children }: { children: ReactNode }) {
  const [currentUser, setCurrentUser] = useState<NguoiDung>(MOCK_USERS.admin);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const setUser = (user: NguoiDung) => { setCurrentUser(user); setIsAuthenticated(true); };
  const setRole = (role: VaiTro) => {
    if (import.meta.env.VITE_DEMO !== 'true') return;
    const user = Object.values(MOCK_USERS).find(item => item.vaiTro === role);
    if (user) setUser(user);
  };
  const loginAs = (key: 'admin' | 'khachHang' | 'taiXe') => { if (import.meta.env.VITE_DEMO === 'true') setUser(MOCK_USERS[key]); };
  const logout = () => { setIsAuthenticated(false); setCurrentUser(MOCK_USERS.admin); };
  return <AuthContext.Provider value={{ currentUser, setRole, setUser, isAuthenticated, logout, loginAs }}>{children}</AuthContext.Provider>;
}
export function useAuth(): AuthContextType { const context = useContext(AuthContext); if (!context) throw new Error('useAuth must be used within an AuthProvider'); return context; }
