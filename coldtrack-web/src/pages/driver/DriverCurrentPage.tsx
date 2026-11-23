import { useState } from 'react';
import { AuthField } from '../../components/common/Auth';
import { ActionButton, ErrorNotice, KeyValues, Message, PageHeading, Panel, StatePanel, Status } from '../../components/admin/AdminUI';
import { useDriver } from '../../services/DriverContext';
import type { DriverData } from '../../services/driverTypes';
import { dateVi, numberVi, rangeVi, temperatureVi } from '../../services/adminTypes';
import { trangThaiNhietDo } from '../../rules/nhietDo';
import { DriverGate } from './DriverGate';

function CurrentTrip({ data }: { data: DriverData }) {
  const { service, refresh } = useDriver();
  const [target, setTarget] = useState(''); const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(); const [validation, setValidation] = useState(''); const [notice, setNotice] = useState('');
  const trip = data.current;
  if (!trip) return <><PageHeading title="Chuyến hiện tại" subtitle="Thông số cảm biến của chuyến được phân công." /><StatePanel type="empty" message="Bạn chưa có chuyến đang vận chuyển được phân công." /></>;
  const point = data.points.at(-1);
  const canControl = !!data.runtime?.connected && !!data.runtime?.refrigeratorConnected;
  const status = trip.nhietDoHienTai == null ? 'Chưa có dữ liệu' : trangThaiNhietDo(trip.nhietDoHienTai, trip.daiNhietMin, trip.daiNhietMax);
  return <><PageHeading title={`Giám sát chuyến xe ${trip.ma}`} subtitle="Xem cảm biến và điều chỉnh nhiệt độ trong dải được Điều phối phân công." />
    <Message success>{notice}</Message>
    <div className="driver-current-grid"><Panel title="Thông số cảm biến"><div className="driver-temperature" role="img" aria-label={`Nhiệt độ hiện tại ${temperatureVi(trip.nhietDoHienTai)}`}><strong>{temperatureVi(trip.nhietDoHienTai)}</strong><Status label={status} /></div>
      <KeyValues items={[[ 'Dải yêu cầu', rangeVi(trip.daiNhietMin, trip.daiNhietMax) ], [ 'Trạng thái cửa', data.runtime?.door ], [ 'Độ ẩm', point ? `${numberVi(point.humidity, 1)}%` : 'Chưa có dữ liệu' ], [ 'Pin cảm biến', point ? `${numberVi(point.battery)}%` : 'Chưa có dữ liệu' ], [ 'Vị trí hiện tại', data.runtime?.location ], [ 'Kết nối cảm biến', data.runtime?.connected ? 'Đã kết nối' : 'Mất kết nối' ], [ 'Cập nhật cảm biến', point ? dateVi(point.time) : 'Chưa có dữ liệu' ]]} />
    </Panel><Panel title="Điều chỉnh nhiệt độ"><p className="admin-muted">Dải cho phép: {rangeVi(trip.daiNhietMin, trip.daiNhietMax)}. Việc thay đổi dải giám sát và hoàn thành chuyến do Điều phối thực hiện.</p>
      <KeyValues items={[[ 'Điều khiển máy lạnh', canControl ? 'Đã kết nối' : 'Chưa kết nối' ], [ 'Nhiệt độ đặt', temperatureVi(data.runtime?.refrigeratorTarget) ]]} />
      {!canControl && <p role="status" className="admin-muted">Chưa có kết nối điều khiển máy lạnh. Hãy điều chỉnh thủ công trên thiết bị theo dải yêu cầu; kết nối cảm biến không đồng nghĩa với kết nối máy lạnh.</p>}
      <form className="admin-form" noValidate onSubmit={async event => {
        event.preventDefault(); if (busy || !canControl) return;
        const value = Number(target);
        if (!target.trim() || !Number.isFinite(value) || value < trip.daiNhietMin || value > trip.daiNhietMax) { setValidation('Nhập nhiệt độ nằm trong dải yêu cầu.'); return; }
        setValidation(''); setError(undefined); setBusy(true);
        try { await service.setTemperature(trip.ma, value); await refresh(); setNotice('Đã lưu nhiệt độ đặt trong mô phỏng. Chưa gửi lệnh đến máy lạnh thực tế.'); }
        catch (failure) { setError(failure); } finally { setBusy(false); }
      }}><AuthField id="refrigerator-target" label="Nhiệt độ đặt (°C)" type="number" step="any" min={trip.daiNhietMin} max={trip.daiNhietMax} value={target} error={validation} disabled={!canControl || busy} onChange={event => setTarget(event.target.value)} /><ErrorNotice error={error} /><ActionButton type="submit" disabled={!canControl} loading={busy}>Đặt nhiệt độ trên app</ActionButton></form>
    </Panel></div>
  </>;
}
export function DriverCurrentPage() { return <DriverGate>{data => <CurrentTrip key={data.current?.ma ?? 'empty'} data={data} />}</DriverGate>; }
