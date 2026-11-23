import type { CanhBao, LoHang, NguoiDung } from '../mock/types';
import type { AdminData, DemoState, HistoryTrip, TemperatureConfig, Telemetry } from './adminTypes';
export interface DriverConfig { temperature: TemperatureConfig; pageSize: number; maxNotesLength: number; incidentTypes: { id: string; label: string; level: CanhBao['mucDo'] }[] }
export interface DriverSettings { profile: NguoiDung; notifications: { email: boolean; sms: boolean; temperature: boolean } }
export interface DriverRuntime { refrigeratorConnected?: boolean; refrigeratorTarget?: number; door: 'Đã đóng' | 'Đang mở' | 'Không xác định'; location: string; seal: string; connected: boolean; pendingRecords: number; packaging: string }
export interface AdjustmentRequest { id: string; tripId: string; min: number; max: number; reason: string; createdAt: string; status: 'Chờ điều phối duyệt' }
export interface AlertAcknowledgement { alertId: string; driverId: string; note: string; time: string }
export interface DriverPrivateState { settings: DriverSettings; runtimes: Record<string, DriverRuntime>; adjustments: AdjustmentRequest[]; acknowledgements: AlertAcknowledgement[] }
export type DriverTrip = Omit<LoHang, 'khachHangId'>;
export interface DriverData { current: DriverTrip | null; runtime: DriverRuntime | null; alerts: CanhBao[]; points: Telemetry[]; history: HistoryTrip[]; adjustments: AdjustmentRequest[]; acknowledgements: AlertAcknowledgement[]; settings: DriverSettings | null; config: DriverConfig | null; now: string }
export interface IncidentInput { type: string; description: string }
export interface AdjustmentInput { min: string; max: string; reason: string }
export interface DriverRepository {
  setDriverTemperature(actor: NguoiDung, tripId: string, target: number): Promise<void>;
  getDriverState(actor: NguoiDung): Promise<DriverPrivateState>;
  requestDriverAdjustment(actor: NguoiDung, tripId: string, input: AdjustmentInput): Promise<void>;
  reportDriverIncident(actor: NguoiDung, tripId: string, input: IncidentInput): Promise<void>;
  acknowledgeDriverAlert(actor: NguoiDung, tripId: string, alertId: string, note: string): Promise<void>;
  finishDriverTrip(actor: NguoiDung, tripId: string, reason: string): Promise<void>;
  saveDriverSettings(actor: NguoiDung, settings: DriverSettings): Promise<void>;
  setDriverConnection(actor: NguoiDung, tripId: string, connected: boolean): Promise<void>;
}
export type DriverSource = { load: () => Promise<AdminData>; setDemoState?: (state: DemoState) => void } & DriverRepository;
export interface DriverService {
  setTemperature(tripId: string, target: number): Promise<void>;
  load(): Promise<DriverData>;
  requestAdjustment(tripId: string, input: AdjustmentInput): Promise<void>;
  reportIncident(tripId: string, input: IncidentInput): Promise<void>;
  acknowledgeAlert(tripId: string, alertId: string, note: string): Promise<void>;
  finishTrip(tripId: string, reason: string): Promise<void>;
  saveProfile(profile: NguoiDung): Promise<void>;
  saveNotifications(notifications: DriverSettings['notifications']): Promise<void>;
  setConnection(tripId: string, connected: boolean): Promise<void>;
  setDemoState?(state: DemoState): void;
}
export class DriverError extends Error { fields: Record<string, string>; constructor(message: string, fields: Record<string, string> = {}) { super(message); this.fields = fields; } }
