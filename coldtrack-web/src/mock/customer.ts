import { MOCK_LICH_SU, MOCK_USERS } from './data';
import type { CustomerConfig, CustomerSettings } from '../services/customerTypes';
import type { TemperatureConfig } from '../services/adminTypes';
import type { NguoiDung } from './types';
export function customerMockConfig(temperature: TemperatureConfig, pageSize: number): CustomerConfig {
  return {
    temperature: { ...temperature }, pageSize, maxWeightKg: 5000, maxNotesLength: 500, timeZoneOffset: '+07:00',
    products: [
      { id: 'frozen-food', label: 'Thực phẩm đông lạnh', target: (temperature.defaultMin + temperature.defaultMax) / 2, tolerance: (temperature.defaultMax - temperature.defaultMin) / 2 },
      { id: 'beef', label: 'Thịt bò đông lạnh', target: -19, tolerance: 1 },
      { id: 'seafood', label: 'Thủy hải sản đông lạnh', target: -20, tolerance: 2 },
      { id: 'ice-cream', label: 'Kem', target: -22, tolerance: 2 },
      { id: 'vegetables', label: 'Rau củ đông lạnh', target: -18, tolerance: 1 },
    ],
    locations: [
      { id: 'hcm', label: 'Kho lạnh Tân Tạo, Bình Tân, TP.HCM' }, { id: 'bd', label: 'Kho lạnh KCN Sóng Thần 1, Dĩ An, Bình Dương' },
      { id: 'ct', label: 'Trung tâm phân phối Mega, Cần Thơ' }, { id: 'dn', label: 'Siêu thị Mega Mall, Biên Hòa, Đồng Nai' }, { id: 'cl', label: 'Hub Kho lạnh Cát Lái, TP.HCM' },
    ],
    packaging: ['Thùng xốp bảo ôn tiêu chuẩn', 'Pallet quấn màng co cách nhiệt', 'Thùng nhựa chuyên dụng có nắp đậy'],
  };
}
// Existing historical fixtures have company names only. This explicit owner index
// prevents a new account with the same company name from inheriting their history.
export const CUSTOMER_HISTORY_OWNERS = Object.fromEntries(MOCK_LICH_SU.map(trip => [trip.ma, MOCK_USERS.khachHang.id]));
export function initialCustomerSettings(actor: NguoiDung): CustomerSettings { return { profile: structuredClone(actor), notifications: { email: true, sms: false, temperature: true } }; }
