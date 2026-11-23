import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { AlertTriangle, Check } from 'lucide-react';
import { AuthButton, AuthField, AuthHeading, AuthLayout, AuthMessage, BackToLogin } from '../../components/common/Auth';
import { AuthError, authService } from '../../auth/service';
import type { ResetRequest } from '../../auth/service';
import { useAuth } from '../../auth/AuthContext';
import { PASSWORD_HELP, validateAuthForm } from '../../auth/validation';
import type { AuthFormKind, AuthFormValues } from '../../auth/validation';
import { AUTH_MOCK } from '../../mock/auth';
import { postLoginDestination } from '../../auth/navigation';

export function AuthFormPage({ kind }: { kind: AuthFormKind }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { setUser } = useAuth();
  const [params] = useSearchParams();
  const token = params.get('token') ?? '';
  const [values, setValues] = useState<AuthFormValues>({ email: '', password: '', confirm: '', name: '', phone: '', terms: false });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [tokenEmail, setTokenEmail] = useState('');
  const [checking, setChecking] = useState(kind === 'reset');
  const [request, setRequest] = useState<ResetRequest>();
  const [registered, setRegistered] = useState(false);
  const [resent, setResent] = useState(false);
  useEffect(() => {
    if (kind !== 'reset') return;
    let active = true;
    setChecking(true);
    setTokenEmail('');
    authService.inspectToken(token).then(record => { if (active) { setTokenEmail(record.email); setChecking(false); } }).catch(() => { if (active) navigate(`/reset/expired${token ? `?token=${encodeURIComponent(token)}` : ''}`, { replace: true }); });
    return () => { active = false; };
  }, [kind, token, navigate]);
  const change = (field: keyof AuthFormValues, value: string | boolean) => { setValues(previous => ({ ...previous, [field]: value })); setErrors(previous => ({ ...previous, [field]: '', form: '' })); };
  const showError = (error: unknown) => {
    if (error instanceof AuthError && error.field === 'token') { navigate('/reset/expired', { replace: true }); return; }
    setErrors({ [error instanceof AuthError && error.field ? error.field : 'form']: error instanceof Error ? error.message : 'Không thể kết nối. Vui lòng thử lại.' });
  };
  const sendReset = async () => { setRequest(await authService.requestReset(values.email)); };
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (loading || checking) return;
    const next = validateAuthForm(kind, { ...values, terms: true }); setErrors(next);
    if (Object.keys(next).length) return;
    setLoading(true);
    try {
      if (kind === 'login') { const user = await authService.login(values.email, values.password); setUser(user); navigate(postLoginDestination(user.vaiTro, (location.state as { from?: unknown } | null)?.from), { replace: true }); }
      else if (kind === 'forgot') await sendReset();
      else if (kind === 'reset') { await authService.resetPassword(token, values.password); navigate('/reset/success', { replace: true }); }
      else { await authService.register({ name: values.name, email: values.email, phone: values.phone, password: values.password }); setRegistered(true); setValues(previous => ({ ...previous, password: '', confirm: '' })); }
    } catch (error) { showError(error); } finally { setLoading(false); }
  };
  const field = (key: 'email' | 'password' | 'confirm' | 'name' | 'phone', label: string, type = 'text', autoComplete?: string, hint?: string) => <AuthField id={key} name={key} label={label} type={type} autoComplete={autoComplete} required={kind === 'register'} value={values[key]} error={errors[key]} hint={hint} placeholder={key === 'email' || key === 'name' || key === 'phone' ? AUTH_MOCK.placeholders[key] : undefined} onChange={event => change(key, event.target.value)} disabled={loading || checking} />;
  const title = kind === 'login' ? 'Đăng nhập hệ thống' : kind === 'forgot' ? 'Quên mật khẩu?' : kind === 'reset' ? 'Đặt lại mật khẩu' : 'Tạo tài khoản';
  const description = kind === 'login' ? 'Nhập thông tin tài khoản để tiếp tục' : kind === 'forgot' ? 'Nhập email đã đăng ký, chúng tôi sẽ gửi liên kết đặt lại mật khẩu cho bạn.' : kind === 'reset' ? `Nhập mật khẩu mới cho tài khoản ${tokenEmail}` : 'Đăng ký để theo dõi đơn hàng và nhận cảnh báo nhiệt độ trực tiếp.';
  return <AuthLayout register={kind === 'register'} back={kind === 'forgot' || kind === 'register'}>
    {checking ? <p role="status" className="auth-center">Đang kiểm tra liên kết…</p> : registered ? <><AuthHeading title="Đăng ký thành công">Bạn có thể đăng nhập bằng tài khoản vừa tạo.</AuthHeading><Link className="auth-button" to="/login">Đăng nhập ngay</Link></> : request ? <><div className="auth-state-icon"><Check size={28} /></div><AuthHeading title="Kiểm tra email của bạn">Chúng tôi đã gửi liên kết đặt lại mật khẩu đến <strong>{values.email.trim()}</strong>. Liên kết có hiệu lực trong {request.expiresInMinutes} phút.</AuthHeading><AuthMessage>{errors.email || errors.form}</AuthMessage><AuthMessage success>{resent && 'Đã gửi lại email.'}</AuthMessage><AuthButton type="button" className="auth-secondary" loading={loading} onClick={async () => { if (loading) return; setLoading(true); setErrors({}); try { await sendReset(); setResent(true); } catch (error) { showError(error); } finally { setLoading(false); } }}>Gửi lại email</AuthButton><div className="auth-center"><BackToLogin /></div>{import.meta.env.VITE_DEMO === 'true' && request.previewUrl && <Link className="auth-demo" to={request.previewUrl}>Mô phỏng mở liên kết email</Link>}</> : <>
    <AuthHeading title={title}>{description}</AuthHeading>
    <form className="auth-form" noValidate onSubmit={submit} aria-label={title}>
      <AuthMessage>{errors.form}</AuthMessage>
      {kind === 'register' && field('name', 'Họ và tên', 'text', 'name')}
      {kind !== 'reset' && field('email', kind === 'login' ? 'Email hoặc tên đăng nhập' : 'Email', 'email', 'username')}
      {kind === 'register' && field('phone', 'Số điện thoại', 'tel', 'tel')}
      {kind !== 'forgot' && field('password', kind === 'reset' ? 'Mật khẩu mới' : 'Mật khẩu', 'password', kind === 'login' ? 'current-password' : 'new-password', kind === 'login' ? undefined : PASSWORD_HELP)}
      {kind === 'login' && <div className="auth-right"><Link to="/forgot-password">Quên mật khẩu?</Link></div>}
      {(kind === 'reset' || kind === 'register') && field('confirm', kind === 'reset' ? 'Xác nhận mật khẩu mới' : 'Xác nhận mật khẩu', 'password', 'new-password')}
      <AuthButton type="submit" loading={loading} >{kind === 'login' ? 'Đăng nhập' : kind === 'forgot' ? 'Gửi liên kết đặt lại' : kind === 'reset' ? 'Đặt lại mật khẩu' : 'Đăng ký'}</AuthButton>
    </form>
    {kind === 'login' ? <p className="auth-center">Chưa có tài khoản? <Link to="/register">Đăng ký ngay</Link></p> : kind === 'register' ? <p className="auth-center">Đã có tài khoản? <Link to="/login">Đăng nhập</Link></p> : <div className="auth-center"><BackToLogin /></div>}
    {kind === 'login' && import.meta.env.VITE_DEMO === 'true' && <div className="auth-demo">{AUTH_MOCK.users.map(user => <button key={user.id} type="button" onClick={() => { setValues(previous => ({ ...previous, email: user.email, password: AUTH_MOCK.password })); setErrors({}); }}>Điền tài khoản {user.nhanHienThi}</button>)}</div>}
    </>}
  </AuthLayout>;
}
export function ResetSuccessPage() { return <AuthLayout><div className="auth-state-icon"><Check size={30} /></div><AuthHeading title="Đặt lại mật khẩu thành công">Bạn có thể đăng nhập bằng mật khẩu mới ngay bây giờ.</AuthHeading><Link className="auth-button" to="/login">Đăng nhập ngay</Link></AuthLayout>; }
export function ResetExpiredPage() {
  const [params] = useSearchParams();
  const token = params.get('token') ?? '';
  const [state, setState] = useState<'checking' | 'missing' | 'expired'>(token ? 'checking' : 'missing');
  const navigate = useNavigate();
  useEffect(() => { let active = true; if (!token) { setState('missing'); return; } setState('checking'); authService.inspectToken(token).then(() => { if (active) navigate(`/reset?token=${encodeURIComponent(token)}`, { replace: true }); }).catch(() => { if (active) setState('expired'); }); return () => { active = false; }; }, [token, navigate]);
  return <AuthLayout>{state === 'checking' ? <p role="status">Đang kiểm tra liên kết…</p> : <><div className="auth-state-icon warning"><AlertTriangle size={30} /></div><AuthHeading title="Liên kết đã hết hạn">{state === 'missing' ? 'Không tìm thấy mã đặt lại mật khẩu trong liên kết. Vui lòng yêu cầu gửi lại.' : 'Liên kết đặt lại mật khẩu này không còn hiệu lực. Vui lòng yêu cầu gửi lại.'}</AuthHeading><Link className="auth-button" to="/forgot-password">Gửi lại yêu cầu</Link><div className="auth-center"><BackToLogin /></div></>}</AuthLayout>;
}


