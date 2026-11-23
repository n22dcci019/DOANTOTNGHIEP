import type { CanhBao, ChuyenLichSu, LoHang, NguoiDung, NhatKyHoatDong, Xe } from '../mock/types';
export interface TemperatureConfig { min: number; max: number; defaultMin: number; defaultMax: number; nearMargin: number; criticalMargin: number }
export interface Driver { id: string; userId?: string; name: string; phone: string; available: boolean }
export interface Telemetry { time: string; temperature: number; humidity: number; battery: number; connection: string; location: string }
export interface Settings { profile: NguoiDung; notifications: { email: boolean; sms: boolean; temperature: boolean }; temperature: TemperatureConfig; thresholdDesignId?: string }
export interface MapPoint { id: string; x: number; y: number; label: string }
export interface HistoryTrip extends ChuyenLichSu { rangeMin: number; rangeMax: number; driverId?: string; customerId?: string }
export interface AdminData {
  shipments: LoHang[]; requests: LoHang[]; vehicles: Xe[]; drivers: Driver[]; alerts: CanhBao[];
  history: HistoryTrip[]; logs: NhatKyHoatDong[]; telemetry: Record<string, Telemetry[]>;
  settings: Settings | null; now: string; pageSize: number; mapPoints: MapPoint[];
}
export interface Assignment { vehicleId: string; driverId: string; min: number; max: number }
export type DemoState = 'data' | 'empty' | 'error';
export interface AdminService {
  updateTripRange(id: string, min: number, max: number, reason: string): Promise<void>;
  finishManagedTrip(id: string, reason: string): Promise<void>;
  reportManagedIncident(id: string, type: string, description: string): Promise<void>;
  load(signal?: AbortSignal): Promise<AdminData>;
  approve(id: string, input: Assignment): Promise<void>;
  reject(id: string, reason: string): Promise<void>;
  resolveAlert(id: string, note: string): Promise<void>;
  saveProfile(profile: NguoiDung): Promise<void>;
  saveNotifications(notifications: Settings['notifications']): Promise<void>;
  saveThresholds(config: TemperatureConfig, reason: string): Promise<void>;
  setDemoState?(state: DemoState): void;
}
export class AdminError extends Error { field?: string; constructor(message: string, field?: string) { super(message); this.field = field; } }
export const numberVi = (value: number, digits = 0) => new Intl.NumberFormat('vi-VN', { maximumFractionDigits: digits }).format(value);
export const temperatureVi = (value?: number) => value == null ? '—' : `${numberVi(value, 1)} °C`;
export const rangeVi = (min: number, max: number) => `${temperatureVi(min)} → ${temperatureVi(max)}`;
export function dateVi(value: string) { if (/^\d{2}\/\d{2}\/\d{4}/.test(value)) return value; const date = new Date(value); return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat('vi-VN', { dateStyle: 'short', ...(value.includes('T') ? { timeStyle: 'short' as const } : {}), timeZone: 'Asia/Ho_Chi_Minh' }).format(date); }
export function dateKey(value: string) { const match = value.match(/^(\d{2})\/(\d{2})\/(\d{4})/); return match ? `${match[3]}-${match[2]}-${match[1]}` : value.slice(0, 10); }
export function validateThresholds(config: TemperatureConfig): string {
  if (Object.values(config).some(value => !Number.isFinite(value))) return 'Vui lòng nhập đầy đủ thông số nhiệt độ hợp lệ.';
  if (config.defaultMin < config.min || config.defaultMax > config.max || config.defaultMin >= config.defaultMax) return 'Nhiệt độ tối thiểu phải nhỏ hơn tối đa và nằm trong giới hạn hệ thống.';
  if (config.nearMargin <= 0 || config.criticalMargin <= config.nearMargin) return 'Ngưỡng nghiêm trọng phải lớn hơn ngưỡng tiến sát; các ngưỡng phải lớn hơn 0.';
  return '';
}
export function vehicleIssue(vehicle: Xe, shipment: LoHang, min = shipment.daiNhietMin, max = shipment.daiNhietMax) {
  if (vehicle.trangThai !== 'Rảnh') return 'Xe không rảnh';
  if (vehicle.taiTrongKg < shipment.khoiLuongKg) return 'Không đủ tải trọng';
  if (vehicle.nhietDoMinHoTro > min || vehicle.nhietDoMaxHoTro < max) return 'Không đáp ứng dải nhiệt';
  return '';
}



