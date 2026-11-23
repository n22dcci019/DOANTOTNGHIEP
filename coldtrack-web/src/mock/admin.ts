import { MOCK_CANH_BAO, MOCK_LICH_SU, MOCK_LO_HANG, MOCK_NHAT_KY, MOCK_USERS, MOCK_XE, THOI_GIAN_MOCK_HIEN_TAI } from './data';
import type { AdminData, Telemetry } from '../services/adminTypes';
export const ADMIN_MOCK_OPTIONS = { latencyMs: 180, pageSize: 7 };
export function createAdminMockData(): AdminData {
  const shipments = structuredClone(MOCK_LO_HANG);
  const requests = [0, 1].map((index) => ({ ...structuredClone(shipments.find(item => item.trangThai === 'Chờ xuất phát')!), ma: `CT-2026-${String(401 + index).padStart(4, '0')}`, trangThai: 'Chờ điều phối duyệt' as const, khoiLuongKg: 1800 + index * 1000, ghiChu: 'Giữ nhiệt độ ổn định trong toàn bộ quá trình vận chuyển.' }));
  const alerts = structuredClone(MOCK_CANH_BAO);
  alerts[2].maLo = shipments[3].ma;
  alerts[2].noiDung = `Cảm biến phụ vùng cửa khoang xe ${shipments[3].maXe} không phản hồi.`;
  alerts[4].maLo = shipments.find(item => item.trangThai === 'Hoàn thành')!.ma;
  alerts[1].tieuDe = 'Nhiệt độ vượt ngưỡng trên';
  alerts[1].noiDung = 'Nhiệt độ tăng lên -17,8 °C, vượt biên trên của dải bảo quản.';
  const now = `${THOI_GIAN_MOCK_HIEN_TAI}+07:00`;
  const telemetry: Record<string, Telemetry[]> = {};
  for (const shipment of [...shipments, ...requests]) {
    const end = shipment.nhietDoHienTai ?? shipment.nhietDoKetThuc;
    telemetry[shipment.ma] = end == null ? [] : Array.from({ length: 13 }, (_, index) => ({
      time: new Date(new Date(now).getTime() - (12 - index) * 30 * 60 * 1000).toISOString(),
      temperature: +((shipment.daiNhietMin + shipment.daiNhietMax) / 2 + (end - (shipment.daiNhietMin + shipment.daiNhietMax) / 2) * index / 12).toFixed(2),
      humidity: 58.2, battery: 94, connection: 'Đã kết nối', location: shipment.diemGiao,
    }));
  }
  // Incoming requests are separate from the 49 tracked shipments.
  const vehicles = structuredClone(MOCK_XE);
  const drivers = [{ id: 'driver-free-01', name: 'Lê Quốc Huy', phone: '0908 123 456', available: true }, { id: 'driver-free-02', name: 'Võ Hoàng Nam', phone: '0912 876 543', available: true }, { id: 'driver-busy-01', userId: MOCK_USERS.taiXe.id, name: MOCK_USERS.taiXe.ten, phone: MOCK_USERS.taiXe.soDienThoai!, available: false }];
  const history = structuredClone(MOCK_LICH_SU).map(trip => ({ ...trip, rangeMin: -20, rangeMax: -18 }));
  for (const trip of history) telemetry[trip.ma] = Array.from({ length: 13 }, (_, index) => ({ time: new Date(`${trip.ngayChay}T${String(8 + Math.floor(index / 2)).padStart(2, '0')}:${index % 2 ? '30' : '00'}:00+07:00`).toISOString(), temperature: index === 12 ? trip.nhietDoKetThuc : -19.4 + Math.sin(index) * .4, humidity: 58.2, battery: 94, connection: 'Đã kết nối', location: trip.tuyenDuong }));
  return { shipments, requests, vehicles, drivers, alerts, history, logs: structuredClone(MOCK_NHAT_KY), telemetry, now, pageSize: ADMIN_MOCK_OPTIONS.pageSize,
    settings: { profile: structuredClone(MOCK_USERS.admin), notifications: { email: true, sms: false, temperature: true }, temperature: { min: -25, max: -15, defaultMin: -20, defaultMax: -18, nearMargin: 1, criticalMargin: 2 }, thresholdDesignId: 'b26b14e8674048c1895691f76a76f4cc' },
    mapPoints: [{ id: 'hcm', x: 42, y: 47, label: 'TP.HCM' }, { id: 'bd', x: 49, y: 24, label: 'Bình Dương' }, { id: 'dn', x: 73, y: 39, label: 'Đồng Nai' }, { id: 'ct', x: 22, y: 76, label: 'Cần Thơ' }, { id: 'vt', x: 78, y: 81, label: 'Vũng Tàu' }],
  };
}




