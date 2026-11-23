import { NotFoundPage } from './auth/NotFoundPage';
import React from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './auth/AuthContext';
import { ProtectedRoute } from './auth/ProtectedRoute';
import { ForbiddenPage } from './auth/ForbiddenPage';
import { AppLayout } from './components/layout/AppLayout';
import { LoginPage } from './pages/auth/LoginPage';
import { ForgotPasswordPage } from './pages/auth/ForgotPasswordPage';
import { ResetExpiredPage } from './pages/auth/ResetExpiredPage';
import { ResetPasswordPage } from './pages/auth/ResetPasswordPage';
import { ResetSuccessPage } from './pages/auth/ResetSuccessPage';
import { RegisterPage } from './pages/auth/RegisterPage';
import { AdminProvider } from './services/AdminContext';
import { OverviewPage, ShipmentsPage } from './pages/admin/ShipmentPages';
import { ApprovalPage } from './pages/admin/ApprovalPage';
import { AlertsPage } from './pages/admin/AlertsPage';
import { VehiclesPage } from './pages/admin/VehiclesPage';
import { HistoryPage, LogsPage } from './pages/admin/HistoryPages';
import { SettingsPage } from './pages/admin/SettingsPage';
import { CustomerProvider } from './services/CustomerContext';
import { CustomerShipmentsPage } from './pages/customer/CustomerShipmentsPage';
import { CreateShipmentPage } from './pages/customer/CreateShipmentPage';
import { CustomerHistoryPage } from './pages/customer/CustomerHistoryPage';
import { CustomerSettingsPage } from './pages/customer/CustomerSettingsPage';
import { DriverProvider } from './services/DriverContext';
import { DriverCurrentPage } from './pages/driver/DriverCurrentPage';
import { DriverHistoryPage } from './pages/driver/DriverHistoryPage';
import { DriverAlertsPage } from './pages/driver/DriverAlertsPage';
import { DriverSettingsPage } from './pages/driver/DriverSettingsPage';
import { LandingPage } from './pages/landing/LandingPage';
import { GuestRoute } from './auth/GuestRoute';
import { DriversPage } from './pages/admin/DriversPage';

// Component chuyển hướng trang chủ dựa trên vai trò
const HomeRedirect: React.FC = () => {
  const { currentUser, isAuthenticated } = useAuth();
  if (!isAuthenticated) return <Navigate to="/login" replace />;

  switch (currentUser.vaiTro) {
    case 'dieu-phoi':
      return <Navigate to="/admin" replace />;
    case 'khach-hang':
      return <Navigate to="/kh/lo-hang" replace />;
    case 'tai-xe':
      return <Navigate to="/tx/chuyen" replace />;
    default:
      return <Navigate to="/login" replace />;
  }
};

function OverviewAlias() { const location = useLocation(); return <Navigate to={'/admin' + location.search + location.hash} replace />; }

export const App: React.FC = () => {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          {/* Trang chủ chuyển hướng thông minh */}
          <Route path="/" element={<LandingPage />} />
          <Route path="/app" element={<ProtectedRoute><HomeRedirect /></ProtectedRoute>} />
          <Route path="/tong-quan" element={<ProtectedRoute allowedRoles={['dieu-phoi']}><OverviewAlias /></ProtectedRoute>} />

          {/* Các route xác thực */}
          <Route element={<GuestRoute />}>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/forgot-password" element={<ForgotPasswordPage />} />
          </Route>
          <Route path="/reset/expired" element={<ResetExpiredPage />} />
          <Route path="/reset" element={<ResetPasswordPage />} />
          <Route path="/reset/success" element={<ResetSuccessPage />} />
          <Route element={<GuestRoute />}>
          <Route path="/register" element={<RegisterPage />} />
          </Route>


          {/* Điều phối: một service và layout chung cho toàn bộ B2 */}
          <Route path="/admin" element={<ProtectedRoute allowedRoles={['dieu-phoi']}><AdminProvider><AppLayout /></AdminProvider></ProtectedRoute>}>
            <Route index element={<OverviewPage />} />
            <Route path="lo-hang" element={<ShipmentsPage />} />
            <Route path="lo-hang/:ma" element={<ShipmentsPage detail />} />
            <Route path="lo-hang/:ma/duyet" element={<ApprovalPage />} />
            <Route path="xe" element={<VehiclesPage />} />
            <Route path="xe/:id" element={<VehiclesPage detail />} />
            <Route path="tai-xe" element={<DriversPage />} />
            <Route path="canh-bao" element={<AlertsPage />} />
            <Route path="canh-bao/:id" element={<AlertsPage detail />} />
            <Route path="lich-su" element={<HistoryPage />} />
            <Route path="lich-su/:ma" element={<HistoryPage detail />} />
            <Route path="nhat-ky" element={<LogsPage />} />
            <Route path="cai-dat" element={<SettingsPage />} />
          </Route>
          {/* Khách hàng: dùng chung AppLayout, service chỉ trả dữ liệu của chủ tài khoản */}
          <Route path="/kh" element={<ProtectedRoute allowedRoles={['khach-hang']}><CustomerProvider><AppLayout /></CustomerProvider></ProtectedRoute>}>
            <Route index element={<Navigate to="/kh/lo-hang" replace />} />
            <Route path="lo-hang" element={<CustomerShipmentsPage />} />
            <Route path="tao-lo-hang" element={<CreateShipmentPage />} />
            <Route path="tao-lo-hang/xem-lai" element={<CreateShipmentPage preview />} />
            <Route path="lo-hang/:ma/da-gui" element={<Navigate to="/kh/lo-hang" replace />} />
            <Route path="lich-su" element={<CustomerHistoryPage />} />
            <Route path="cai-dat" element={<CustomerSettingsPage />} />
          </Route>
          {/* Tài xế: cùng AppLayout, dữ liệu giới hạn theo phân công */}
          <Route path="/tx" element={<ProtectedRoute allowedRoles={['tai-xe']}><DriverProvider><AppLayout /></DriverProvider></ProtectedRoute>}>
            <Route index element={<Navigate to="/tx/chuyen" replace />} />
            <Route path="chuyen" element={<DriverCurrentPage />} />
            <Route path="lich-su" element={<DriverHistoryPage />} />
            <Route path="canh-bao" element={<DriverAlertsPage />} />
            <Route path="cai-dat" element={<DriverSettingsPage />} />
          </Route>
          {/* Trang 403 Forbidden */}
          <Route path="/403" element={<ForbiddenPage />} />

          {/* Trang 404 Not Found */}
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
};

export default App;





