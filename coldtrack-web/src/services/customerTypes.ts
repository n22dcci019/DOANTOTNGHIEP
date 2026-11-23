import type { LoHang, NguoiDung } from '../mock/types';
import type { AdminData, HistoryTrip, TemperatureConfig, DemoState } from './adminTypes';
export interface ProductPreset { id: string; label: string; target: number; tolerance: number }
export interface CustomerConfig { products: ProductPreset[]; locations: { id: string; label: string }[]; packaging: string[]; temperature: TemperatureConfig; maxWeightKg: number; maxNotesLength: number; timeZoneOffset: string; pageSize: number }
export interface ShipmentForm { pickup: string; delivery: string; product: string; weight: string; packaging: string; target: string; tolerance: string; date: string; time: string; notes: string }
export type CustomerShipment = Pick<LoHang, 'ma' | 'tenHang' | 'soThung' | 'khoiLuongKg' | 'diemLay' | 'diemGiao' | 'thoiGianKhoiHanh' | 'thoiGianDuKienGiao' | 'thoiGianHoanThanh' | 'trangThai' | 'daiNhietMin' | 'daiNhietMax' | 'nhietDoHienTai' | 'nhietDoKetThuc' | 'ghiChu' | 'lyDoTuChoi' | 'quyCachDongGoi' | 'nhietDoMucTieu' | 'dungSai'>;
export type CustomerTrip = Pick<HistoryTrip, 'ma' | 'ngayChay' | 'tenHang' | 'tuyenDuong' | 'daiNhiet' | 'ketQua' | 'nhietDoKetThuc' | 'trangThaiDatChuan' | 'soLanCanhBao' | 'rangeMin' | 'rangeMax'>;
export interface CustomerSettings { profile: NguoiDung; notifications: { email: boolean; sms: boolean; temperature: boolean } }
export interface CustomerData { shipments: CustomerShipment[]; history: CustomerTrip[]; settings: CustomerSettings | null; config: CustomerConfig | null; draft: ShipmentForm | null; now: string }
export interface CustomerRepository {
  createCustomerRequest(actor: NguoiDung, input: ShipmentForm): Promise<LoHang>;
  getCustomerSettings(actor: NguoiDung): Promise<CustomerSettings>;
  saveCustomerSettings(actor: NguoiDung, settings: CustomerSettings): Promise<void>;
  getCustomerDraft(actor: NguoiDung): Promise<ShipmentForm | null>;
  saveCustomerDraft(actor: NguoiDung, draft: ShipmentForm): Promise<void>;
}
export interface CustomerService {
  load(): Promise<CustomerData>;
  createShipment(input: ShipmentForm): Promise<CustomerShipment>;
  saveDraft(input: ShipmentForm): Promise<void>;
  saveProfile(profile: NguoiDung): Promise<void>;
  saveNotifications(notifications: CustomerSettings['notifications']): Promise<void>;
  setDemoState?(state: DemoState): void;
}
export type CustomerSource = { load: () => Promise<AdminData>; setDemoState?: (state: DemoState) => void } & CustomerRepository;
export class CustomerError extends Error { fields: Record<string, string>; constructor(message: string, fields: Record<string, string> = {}) { super(message); this.fields = fields; } }
export const emptyShipmentForm = (): ShipmentForm => ({ pickup: '', delivery: '', product: '', weight: '', packaging: '', target: '', tolerance: '', date: '', time: '', notes: '' });


