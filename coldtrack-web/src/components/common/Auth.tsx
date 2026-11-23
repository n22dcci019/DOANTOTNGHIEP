import { useState } from 'react';
import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Eye, EyeOff, Snowflake } from 'lucide-react';
import { AUTH_MOCK } from '../../mock/auth';
import './auth.css';

export function AuthLogo() {
  return <div className="auth-logo"><span className="auth-logo-icon"><Snowflake size={24} /></span><span><strong>Cold<span>Track</span></strong><small>LOGISTICS INTELLIGENCE</small></span></div>;
}
export function BackToLogin() { return <Link className="auth-back" to="/login"><ArrowLeft size={16} />Quay lại đăng nhập</Link>; }
export function AuthLayout({ children, register = false, back = false }: { children: ReactNode; register?: boolean; back?: boolean }) {
  return <main className="auth-shell"><aside className="auth-brand"><AuthLogo /><div className="auth-pitch"><div className="auth-live"><span />Hệ thống giám sát chuỗi cung ứng lạnh 24/7</div><h1>Giám sát chuỗi lạnh thời gian thực</h1><p>Nền tảng IoT giám sát nhiệt độ, hành trình và tình trạng phương tiện chuyên dụng cho vận tải thực phẩm đông lạnh.</p><div className="auth-metrics">{AUTH_MOCK.telemetry.map(item => <div key={item.label}><small>{item.label}</small><strong>{item.value}</strong>{item.status && <span>{item.status}</span>}</div>)}</div></div><footer>© {new Date().getFullYear()} ColdTrack. Mọi quyền được bảo lưu.<span>Hệ thống vận hành chuỗi thực phẩm đông lạnh</span></footer></aside><section className={`auth-panel ${register ? 'auth-register' : ''}`}><div className="auth-card">{back && <BackToLogin />}<AuthLogo />{children}<div className="auth-support">Cần hỗ trợ? <a href={`mailto:${AUTH_MOCK.supportEmail}`}>Liên hệ quản trị viên hệ thống</a></div><div className="auth-footnote">Bảo vệ phiên đăng nhập an toàn <span>•</span> Chuỗi lạnh thời gian thực</div></div></section></main>;
}
export function AuthHeading({ title, children }: { title: string; children?: ReactNode }) { return <header className="auth-heading"><h2>{title}</h2>{children && <p>{children}</p>}</header>; }
export function AuthMessage({ children, success = false }: { children?: ReactNode; success?: boolean }) { return children ? <p role={success ? 'status' : 'alert'} className={success ? 'auth-notice' : 'auth-error'}>{children}</p> : null; }
export function AuthField({ label, error, hint, ...props }: InputHTMLAttributes<HTMLInputElement> & { label: string; error?: string; hint?: string }) {
  const [visible, setVisible] = useState(false);
  const password = props.type === 'password';
  return <div className="auth-field"><label htmlFor={props.id}>{label}{props.required && <span className="auth-required"> *</span>}</label><div className="auth-input-wrap"><input {...props} type={password && visible ? 'text' : props.type} aria-invalid={!!error} aria-describedby={error ? `${props.id}-error` : hint ? `${props.id}-hint` : undefined} />{password && <button type="button" aria-label={`${visible ? 'Ẩn' : 'Hiện'} ${label.toLowerCase()}`} aria-pressed={visible} onClick={() => setVisible(!visible)}>{visible ? <EyeOff size={18} /> : <Eye size={18} />}</button>}</div>{error ? <p id={`${props.id}-error`} className="auth-error" role="alert">{error}</p> : hint && <p id={`${props.id}-hint`} className="auth-hint">{hint}</p>}</div>;
}
export function AuthButton({ children, loading, ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { loading?: boolean }) { return <button {...props} className={`auth-button ${props.className ?? ''}`} disabled={loading || props.disabled} aria-busy={loading}>{loading ? 'Đang xử lý…' : children}{!loading && props.type === 'submit' && <ArrowRight size={16} />}</button>; }


