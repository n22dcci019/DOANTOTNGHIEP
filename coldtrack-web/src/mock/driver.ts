import { MOCK_LICH_SU, MOCK_USERS } from './data';
import type { LoHang, NguoiDung } from './types';
import type { DriverConfig, DriverRuntime, DriverSettings } from '../services/driverTypes';
import type { TemperatureConfig } from '../services/adminTypes';
export const DRIVER_HISTORY_OWNERS = { [MOCK_LICH_SU[0].ma]: MOCK_USERS.taiXe.id };
export const DRIVER_RESOURCE_IDS: Record<string, string> = { [MOCK_USERS.taiXe.id]: 'driver-busy-01' };
export const DRIVER_MOCK = { queuedRecordsOffline: 7, completedTemperature: -19.2 };
export function driverMockConfig(temperature: TemperatureConfig, pageSize: number): DriverConfig { return { temperature: { ...temperature }, pageSize, maxNotesLength: 500, incidentTypes: [{ id: 'refrigeration', label: 'Hệ thống làm lạnh', level: 'Nghiêm trọng' }, { id: 'door', label: 'Cửa thùng xe', level: 'Cảnh báo' }, { id: 'vehicle', label: 'Sự cố phương tiện', level: 'Cảnh báo' }, { id: 'other', label: 'Sự cố khác', level: 'Thông tin' }] }; }
export function initialDriverSettings(actor: NguoiDung): DriverSettings { return { profile: structuredClone(actor), notifications: { email: true, sms: false, temperature: true } }; }
export function driverRuntime(trip: LoHang, location?: string): DriverRuntime { return { refrigeratorConnected: false, door: 'Đã đóng', location: location ?? trip.diemLay, seal: `NP-${trip.ma}-OK`, connected: true, pendingRecords: 0, packaging: trip.quyCachDongGoi ?? 'Thùng xốp bảo ôn tiêu chuẩn' }; }
