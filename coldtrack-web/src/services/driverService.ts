import { adminService } from './adminService';
import { driverMockConfig, DRIVER_HISTORY_OWNERS } from '../mock/driver';
import { DriverError } from './driverTypes';
import type { DriverService, DriverSource, DriverTrip } from './driverTypes';
import type { DemoState } from './adminTypes';
import type { LoHang, NguoiDung } from '../mock/types';
function ownTripView(trip: LoHang): DriverTrip { const result = { ...trip }; delete (result as Partial<LoHang>).khachHangId; return result; }
export function createDriverService(actor: NguoiDung, source: DriverSource = adminService, options = { demo: import.meta.env.VITE_DEMO === 'true' }): DriverService {
  let scenario: DemoState = 'data';
  const guard = () => { if (actor.vaiTro !== 'tai-xe') throw new DriverError('Không có quyền truy cập dữ liệu tài xế.'); if (scenario === 'error') throw new DriverError('Không thể tải dữ liệu. Vui lòng thử lại.'); };
  return {
    async setTemperature(id, target) { guard(); await source.setDriverTemperature(actor, id, target); },
    async load() {
      guard(); const [snapshot, state] = await Promise.all([source.load(), source.getDriverState(actor)]);
      const current = snapshot.shipments.find(item => item.maTaiXe === actor.id && item.trangThai === 'Đang vận chuyển'); const empty = scenario === 'empty';
      return { current: empty || !current ? null : ownTripView(current), runtime: empty || !current ? null : state.runtimes[current.ma] ?? null, alerts: empty || !current ? [] : snapshot.alerts.filter(item => item.maLo === current.ma), points: empty || !current ? [] : snapshot.telemetry[current.ma] ?? [], history: empty ? [] : snapshot.history.filter(item => (item.driverId ?? DRIVER_HISTORY_OWNERS[item.ma]) === actor.id), settings: empty ? null : state.settings, config: empty || !snapshot.settings ? null : driverMockConfig(snapshot.settings.temperature, snapshot.pageSize), adjustments: empty || !current ? [] : state.adjustments.filter(item => item.tripId === current.ma), acknowledgements: empty || !current ? [] : state.acknowledgements.filter(item => snapshot.alerts.some(alert => alert.maLo === current.ma && alert.id === item.alertId)), now: snapshot.now };
    },
    async requestAdjustment(id, input) { guard(); await source.requestDriverAdjustment(actor, id, input); },
    async reportIncident(id, input) { guard(); await source.reportDriverIncident(actor, id, input); },
    async acknowledgeAlert(id, alertId, note) { guard(); await source.acknowledgeDriverAlert(actor, id, alertId, note); },
    async finishTrip(id, reason) { guard(); await source.finishDriverTrip(actor, id, reason); },
    async saveProfile(profile) { guard(); const state = await source.getDriverState(actor); await source.saveDriverSettings(actor, { ...state.settings, profile }); },
    async saveNotifications(notifications) { guard(); const state = await source.getDriverState(actor); await source.saveDriverSettings(actor, { ...state.settings, notifications }); },
    async setConnection(id, connected) { guard(); if (!options.demo) throw new DriverError('Công cụ giả lập chỉ có trong chế độ demo.'); await source.setDriverConnection(actor, id, connected); },
    setDemoState(state) { if (options.demo) { scenario = state; source.setDemoState?.('data'); } },
  };
}
