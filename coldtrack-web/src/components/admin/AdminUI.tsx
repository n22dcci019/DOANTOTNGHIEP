import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, Package, Search } from 'lucide-react';
import { useAdmin } from '../../services/AdminContext';
import { Table } from '../common/Table';
import type { Column } from '../common/Table';
import { numberVi, temperatureVi } from '../../services/adminTypes';
import type { AdminData, Telemetry, TemperatureConfig } from '../../services/adminTypes';
import { AuthButton, AuthMessage } from '../common/Auth';
import { Badge } from '../common/Badge';
export { AuthButton as ActionButton, AuthMessage as Message } from '../common/Auth';
export function StatePanel({ type, message, retry }: { type: 'loading' | 'empty' | 'error'; message?: string; retry?: () => void }) {
  return <div className={`admin-state ${type}`} role={type === 'error' ? 'alert' : 'status'}>{type === 'error' ? <AlertTriangle size={28} /> : <Package size={28} />}<h2>{type === 'loading' ? 'Đang tải dữ liệu…' : type === 'error' ? 'Không thể tải dữ liệu' : 'Không tìm thấy dữ liệu'}</h2><p>{message ?? (type === 'empty' ? 'Chưa có bản ghi phù hợp. Hãy thử thay đổi bộ lọc.' : '')}</p>{retry && <button className="admin-secondary" onClick={retry}>Thử lại</button>}</div>;
}
export function DataGate({ children }: { children: (data: AdminData) => ReactNode }) { const { data, loading, error, refresh } = useAdmin(); if (error) return <StatePanel type="error" message={error} retry={() => void refresh()} />; if (!data) return <StatePanel type={loading ? 'loading' : 'empty'} />; return <div aria-busy={loading}>{children(data)}</div>; }
export function PageHeading({ title, subtitle, actions }: { title: string; subtitle: string; actions?: ReactNode }) { return <div className="admin-page-heading"><div><h1>{title}</h1><p>{subtitle}</p></div>{actions && <div className="admin-actions">{actions}</div>}</div>; }
export function Panel({ title, children, actions, className = '' }: { title?: string; children: ReactNode; actions?: ReactNode; className?: string }) { return <section className={`admin-panel ${className}`}>{title && <header><h2>{title}</h2>{actions}</header>}<div className="admin-panel-body">{children}</div></section>; }
export function Status({ label }: { label: string }) { return <Badge label={label} />; }
export function SearchBox({ value, onChange, placeholder = 'Tìm theo mã lô hàng, sản phẩm, tuyến đường…' }: { value: string; onChange: (value: string) => void; placeholder?: string }) { return <label className="admin-search"><Search size={16} /><span className="sr-only">Tìm kiếm</span><input value={value} onChange={event => onChange(event.target.value)} placeholder={placeholder} /></label>; }
export function SelectFilter({ label, value, onChange, options }: { label: string; value: string; onChange: (value: string) => void; options: string[] }) { return <label className="admin-filter"><span className="sr-only">{label}</span><select aria-label={label} value={value} onChange={event => onChange(event.target.value)}><option value="">{label}: Tất cả</option>{options.map(option => <option key={option}>{option}</option>)}</select></label>; }
export function Filters({ children, reset }: { children: ReactNode; reset?: () => void }) { return <div className="admin-filters">{children}{reset && <button className="admin-secondary" onClick={reset}>Xóa bộ lọc</button>}</div>; }
export function Tabs({ value, onChange, items }: { value: string; onChange: (value: string) => void; items: { value: string; label: string; count?: number }[] }) { return <div className="admin-tabs" role="tablist" aria-label="Bộ lọc trạng thái">{items.map(item => <button role="tab" aria-selected={value === item.value} key={item.value} onClick={() => onChange(item.value)}>{item.label}{item.count != null && <span>{numberVi(item.count)}</span>}</button>)}</div>; }
export function DataTable<T>({ columns, data, rowKey, pageSize, title, filterKey = '' }: { columns: Column<T>[]; data: T[]; rowKey: (item: T) => string; pageSize: number; title: string; filterKey?: string }) {
  const [page, setPage] = useState(1);
  useEffect(() => { setPage(1); }, [filterKey]);
  const pages = Math.max(1, Math.ceil(data.length / pageSize)); const current = Math.min(page, pages); const start = (current - 1) * pageSize;
  return <section className="admin-data-table" aria-label={title}><div className="admin-table-title"><h2>{title}</h2><span>{numberVi(data.length)}</span></div><Table columns={columns} data={data.slice(start, start + pageSize)} keyExtractor={rowKey} emptyIcon={<Package size={24} />} /><div className="admin-pagination"><span>{data.length ? `Hiển thị ${numberVi(start + 1)}–${numberVi(Math.min(start + pageSize, data.length))} trên ${numberVi(data.length)} bản ghi` : 'Không có bản ghi'}</span><div><button className="admin-secondary" disabled={current === 1} onClick={() => setPage(current - 1)}>Trước</button><span>Trang {numberVi(current)} / {numberVi(pages)}</span><button className="admin-secondary" disabled={current === pages} onClick={() => setPage(current + 1)}>Sau</button></div></div></section>;
}
export function KeyValues({ items }: { items: [string, ReactNode][] }) { return <dl className="admin-keyvalues">{items.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value ?? '—'}</dd></div>)}</dl>; }
export function Chart({ points, min, max }: { points: Telemetry[]; min: number; max: number }) {
  if (!points.length) return <StatePanel type="empty" message="Chưa có dữ liệu cảm biến cho lô hàng này." />;
  const low = Math.min(min, ...points.map(point => point.temperature)) - 1, high = Math.max(max, ...points.map(point => point.temperature)) + 1;
  const y = (value: number) => 150 - (value - low) / (high - low) * 130;
  return <div className="admin-chart"><svg viewBox="0 0 560 190" role="img" aria-label={`Biểu đồ nhiệt độ, dải yêu cầu ${temperatureVi(min)} đến ${temperatureVi(max)}`}><rect x="46" y={y(max)} width="504" height={y(min) - y(max)} fill="#dcfce7" />{[min, max].map(value => <g key={value}><line x1="46" x2="550" y1={y(value)} y2={y(value)} stroke="#86efac" strokeDasharray="4 4" /><text x="2" y={y(value) + 4} fontSize="11" fill="#64748b">{numberVi(value, 1)}°</text></g>)}<polyline points={points.map((point, index) => `${46 + index / Math.max(1, points.length - 1) * 504},${y(point.temperature)}`).join(' ')} fill="none" stroke="#2563eb" strokeWidth="2.5" />{points.filter((_, index) => index % 3 === 0).map(point => <text key={point.time} x={46 + points.indexOf(point) / Math.max(1, points.length - 1) * 490} y="180" fontSize="11" textAnchor="middle" fill="#64748b">{new Intl.DateTimeFormat('vi-VN', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date(point.time))}</text>)}</svg><p className="admin-muted">Vùng xanh: dải nhiệt yêu cầu · Đường xanh: nhiệt độ đo được</p></div>;
}
export function ErrorNotice({ error }: { error: unknown }) { return <AuthMessage>{error instanceof Error ? error.message : error ? String(error) : ''}</AuthMessage>; }
export function BackLink({ to, children = 'Quay lại danh sách' }: { to: string; children?: ReactNode }) { return <Link className="admin-back" to={to}>← {children}</Link>; }
export function SaveButton({ loading }: { loading: boolean }) { return <AuthButton type="submit" loading={loading}>Lưu thay đổi</AuthButton>; }
export function ThermalScale({ config }: { config: TemperatureConfig }) { return <div className="admin-thermal"><div style={{ background: `linear-gradient(90deg,#fca5a5,#fde68a,#bbf7d0,#bbf7d0,#fde68a,#fca5a5)` }} /><div><span>{temperatureVi(config.min)}</span><strong>{temperatureVi(config.defaultMin)} → {temperatureVi(config.defaultMax)}</strong><span>{temperatureVi(config.max)}</span></div><p>Tiến sát ngưỡng: {temperatureVi(config.nearMargin)} · Nghiêm trọng: từ {temperatureVi(config.criticalMargin)}</p></div>; }
