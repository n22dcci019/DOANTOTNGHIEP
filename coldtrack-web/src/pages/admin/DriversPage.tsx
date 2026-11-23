import { useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, CheckCircle2 } from 'lucide-react';
import { AuthField } from '../../components/common/Auth';
import { Modal } from '../../components/common/Modal';
import { DataGate, DataTable, ErrorNotice, KeyValues, Message, PageHeading, Panel, SearchBox, StatePanel, Status, ActionButton } from '../../components/admin/AdminUI';
import { useAdmin } from '../../services/AdminContext';
import { dateVi, rangeVi, temperatureVi, validateThresholds } from '../../services/adminTypes';
import type { AdminData } from '../../services/adminTypes';
import { driverMockConfig } from '../../mock/driver';
import { validateDriverIncident } from '../../services/driverValidation';
import { datChuan } from '../../rules/nhietDo';

function DriverManagement({ data }: { data: AdminData }) {
  const { service, refresh } = useAdmin();
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState('');
  const [min, setMin] = useState(''); const [max, setMax] = useState(''); const [reason, setReason] = useState('');
  const [modal, setModal] = useState<'finish' | 'incident' | null>(null);
  const [type, setType] = useState(''); const [description, setDescription] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false); const [error, setError] = useState<unknown>(); const [notice, setNotice] = useState('');
  const rows = data.drivers.filter(driver => `${driver.name} ${driver.phone}`.toLowerCase().includes(query.toLowerCase()));
  const driver = data.drivers.find(item => item.id === selected);
  const trip = driver && data.shipments.find(item => item.maTaiXe === (driver.userId ?? driver.id) && item.trangThai === 'Đang vận chuyển');
  const point = trip ? data.telemetry[trip.ma]?.at(-1) : undefined;
  const config = data.settings && driverMockConfig(data.settings.temperature, data.pageSize);
  const result = trip?.nhietDoHienTai == null || !trip ? null : datChuan(trip.nhietDoHienTai, trip.daiNhietMin, trip.daiNhietMax);
  const run = async (action: () => Promise<void>, message: string) => {
    if (busy) return; setBusy(true); setError(undefined);
    try { await action(); await refresh(); setNotice(message); setModal(null); setReason(''); setErrors({}); }
    catch (failure) { setError(failure); } finally { setBusy(false); }
  };
  const openModal = (value: 'finish' | 'incident') => { setModal(value); setReason(''); setType(''); setDescription(''); setErrors({}); setError(undefined); };
  return <><PageHeading title="Quản lý tài xế" subtitle="Theo dõi chuyến được phân công, kiểm tra cảm biến và xử lý vận hành." />
    <Message success>{notice}</Message><SearchBox value={query} onChange={setQuery} placeholder="Tìm tên hoặc số điện thoại tài xế…" />
    <DataTable title="Danh sách tài xế" data={rows} rowKey={item => item.id} pageSize={data.pageSize} filterKey={query} columns={[
      { key: 'name', header: 'Tài xế' }, { key: 'phone', header: 'Điện thoại', render: item => <a href={`tel:${item.phone}`}>{item.phone}</a> },
      { key: 'available', header: 'Trạng thái', render: item => <Status label={item.available ? 'Rảnh' : 'Đang hoạt động'} /> },
      { key: 'action', header: 'Chuyến hiện tại', render: item => <button className="admin-secondary" aria-pressed={selected === item.id} onClick={() => {
        setSelected(item.id); setErrors({}); setError(undefined); setNotice(''); setReason('');
        const current = data.shipments.find(record => record.maTaiXe === (item.userId ?? item.id) && record.trangThai === 'Đang vận chuyển');
        setMin(String(current?.daiNhietMin ?? '')); setMax(String(current?.daiNhietMax ?? ''));
      }}>Xem chuyến · {item.name}</button> },
    ]} />
    {driver && <section aria-label={`Chuyến của ${driver.name}`} className="admin-stack" style={{ marginTop: 24 }}>
      <PageHeading title={`Chuyến hiện tại · ${driver.name}`} subtitle="Điều phối quản lý chuyến và ghi nhận thay đổi." actions={trip && <><button className="admin-secondary" onClick={() => openModal('incident')}><AlertTriangle size={16} />Báo sự cố</button><button className="admin-secondary" onClick={() => openModal('finish')}><CheckCircle2 size={16} />Hoàn thành chặng</button></>} />
      {!trip ? <StatePanel type="empty" message="Tài xế chưa có chuyến đang vận chuyển." /> : <>
        <Panel title={`Giám sát chuyến ${trip.ma}`}><KeyValues items={[[ 'Nhiệt độ hiện tại', temperatureVi(trip.nhietDoHienTai) ], [ 'Dải yêu cầu', rangeVi(trip.daiNhietMin, trip.daiNhietMax) ], [ 'Độ ẩm', point ? `${point.humidity}%` : 'Chưa có dữ liệu' ], [ 'Pin cảm biến', point ? `${point.battery}%` : 'Chưa có dữ liệu' ], [ 'Kết nối cảm biến', point?.connection ?? 'Chưa có dữ liệu' ], [ 'Hành trình', `${trip.diemLay} → ${trip.diemGiao}` ], [ 'Cập nhật', point ? dateVi(point.time) : 'Chưa có dữ liệu' ]]} /><Link to={`/admin/lo-hang/${trip.ma}`}>Xem chi tiết lô hàng</Link></Panel>
        <Panel title="Cấu hình dải nhiệt giám sát"><form className="admin-form" noValidate onSubmit={event => {
          event.preventDefault(); if (!data.settings) return;
          const issue = !min.trim() || !max.trim() ? 'Vui lòng nhập đầy đủ dải nhiệt.' : validateThresholds({ ...data.settings.temperature, defaultMin: Number(min), defaultMax: Number(max) });
          const next = { ...(issue ? { range: issue } : {}), ...(!reason.trim() ? { reason: 'Vui lòng nhập lý do thay đổi.' } : {}) }; setErrors(next);
          if (!Object.keys(next).length) void run(() => service.updateTripRange(trip.ma, Number(min), Number(max), reason), 'Đã cập nhật dải nhiệt giám sát.');
        }}><p className="admin-muted">Dải này dùng để đánh giá cảm biến; không gửi lệnh điều khiển máy lạnh.</p><div className="admin-form-grid"><AuthField id="managed-min" label="Tối thiểu (°C)" type="number" step="any" value={min} error={errors.range} disabled={busy} onChange={e => setMin(e.target.value)} /><AuthField id="managed-max" label="Tối đa (°C)" type="number" step="any" value={max} disabled={busy} onChange={e => setMax(e.target.value)} /></div><AuthField id="managed-reason" label="Lý do thay đổi" value={reason} error={errors.reason} disabled={busy} onChange={e => setReason(e.target.value)} /><ErrorNotice error={modal ? undefined : error} /><ActionButton type="submit" loading={busy}>Lưu dải nhiệt</ActionButton></form></Panel>
      </>}
    </section>}
    {modal && trip && <Modal isOpen title={modal === 'finish' ? 'Hoàn thành chặng?' : 'Báo sự cố'} subtitle={`${driver?.name} · ${trip.ma}`} onClose={() => { if (!busy) setModal(null); }}><form className="admin-form" noValidate onSubmit={event => {
      event.preventDefault();
      if (modal === 'finish') {
        if (!result) { setErrors({ reason: 'Chưa có nhiệt độ kết thúc để xác nhận.' }); return; }
        if (result.ketQua === 'Không đạt' && !reason.trim()) { setErrors({ reason: 'Vui lòng nhập lý do nhiệt độ kết thúc không đạt.' }); return; }
        void run(() => service.finishManagedTrip(trip.ma, reason), `Đã hoàn thành chặng ${trip.ma}.`);
      } else if (config) {
        const next = validateDriverIncident({ type, description }, config); setErrors(next);
        if (!Object.keys(next).length) void run(() => service.reportManagedIncident(trip.ma, type, description), 'Đã ghi nhận báo cáo sự cố.');
      }
    }}>
      {modal === 'finish' ? <><KeyValues items={[[ 'Điểm giao', trip.diemGiao ], [ 'Nhiệt độ kết thúc', temperatureVi(trip.nhietDoHienTai) ], [ 'Dải yêu cầu', rangeVi(trip.daiNhietMin, trip.daiNhietMax) ]]} />{result && <Status label={result.ketQua} />}<AuthField id="finish-reason" label={result?.ketQua === 'Không đạt' ? 'Lý do không đạt (bắt buộc)' : 'Ghi chú hoàn thành'} value={reason} error={errors.reason} disabled={busy} maxLength={500} onChange={e => setReason(e.target.value)} /></> : <><label><span>Loại sự cố</span><select value={type} disabled={busy} aria-invalid={!!errors.type} aria-describedby={errors.type ? 'managed-type-error' : undefined} onChange={e => setType(e.target.value)}><option value="">Chọn loại sự cố</option>{config?.incidentTypes.map(item => <option key={item.id} value={item.id}>{item.label}</option>)}</select></label>{errors.type && <p id="managed-type-error" className="auth-error" role="alert">{errors.type}</p>}<AuthField id="managed-description" label="Mô tả sự cố" value={description} error={errors.description} maxLength={config?.maxNotesLength} disabled={busy} onChange={e => setDescription(e.target.value)} /></>}
      <ErrorNotice error={error} /><div className="admin-form-footer"><button className="admin-secondary" type="button" disabled={busy} onClick={() => setModal(null)}>Hủy</button><ActionButton type="submit" loading={busy}>{modal === 'finish' ? 'Xác nhận hoàn thành' : 'Gửi báo cáo'}</ActionButton></div>
    </form></Modal>}
  </>;
}
export function DriversPage() { return <DataGate>{data => <DriverManagement data={data} />}</DataGate>; }
