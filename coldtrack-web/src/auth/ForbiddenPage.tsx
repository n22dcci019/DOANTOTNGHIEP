import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ShieldAlert, ArrowLeft, Home } from 'lucide-react';
import { useAuth } from './AuthContext';

export const ForbiddenPage: React.FC = () => {
  const navigate = useNavigate();
  const { currentUser } = useAuth();

  const getDefaultRoute = () => {
    switch (currentUser.vaiTro) {
      case 'dieu-phoi':
        return '/admin';
      case 'khach-hang':
        return '/kh/lo-hang';
      case 'tai-xe':
        return '/tx/chuyen';
      default:
        return '/login';
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-xl border border-slate-200/80 p-8 text-center animate-in fade-in zoom-in-95 duration-200">
        <div className="w-16 h-16 bg-red-50 text-red-600 rounded-2xl mx-auto flex items-center justify-center mb-5 border border-red-100 shadow-inner">
          <ShieldAlert className="w-8 h-8" />
        </div>

        <span className="inline-block px-3 py-1 rounded-full text-xs font-semibold bg-red-100 text-red-700 tracking-wide uppercase mb-3">
          Mã lỗi: 403
        </span>

        <h1 className="text-2xl font-bold text-slate-900 mb-2">
          Không có quyền truy cập
        </h1>

        <p className="text-slate-600 text-sm mb-6 leading-relaxed">
          Tài khoản của bạn ({currentUser.nhanHienThi}) không có quyền truy cập vào đường dẫn này theo quy định bảo mật hệ thống.
        </p>

        <div className="bg-slate-50 rounded-xl p-3.5 mb-6 text-left border border-slate-100">
          <div className="text-xs text-slate-500 font-medium">Người dùng hiện tại:</div>
          <div className="text-sm font-semibold text-slate-800">{currentUser.ten}</div>
          <div className="text-xs text-slate-500 mt-1">Vai trò: <span className="font-semibold text-slate-700">{currentUser.nhanHienThi}</span></div>
        </div>

        <div className="flex flex-col sm:flex-row gap-3">
          <button
            onClick={() => navigate(-1)}
            className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-slate-300 text-slate-700 hover:bg-slate-100 text-sm font-medium transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            Quay lại
          </button>
          <button
            onClick={() => navigate(getDefaultRoute())}
            className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium shadow-sm transition-colors cursor-pointer"
          >
            <Home className="w-4 h-4" />
            Về trang chủ
          </button>
        </div>
      </div>
    </div>
  );
};
