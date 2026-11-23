import { adminService } from './adminService';
import { customerMockConfig, CUSTOMER_HISTORY_OWNERS } from '../mock/customer';
import { CustomerError } from './customerTypes';
import type { CustomerService, CustomerSource, CustomerShipment, CustomerTrip } from './customerTypes';
import type { LoHang, NguoiDung } from '../mock/types';
import type { DemoState, HistoryTrip } from './adminTypes';
export function publicShipment(item: LoHang): CustomerShipment {
  return { ma: item.ma, tenHang: item.tenHang, soThung: item.soThung, khoiLuongKg: item.khoiLuongKg, diemLay: item.diemLay, diemGiao: item.diemGiao, thoiGianKhoiHanh: item.thoiGianKhoiHanh, thoiGianDuKienGiao: item.thoiGianDuKienGiao, thoiGianHoanThanh: item.thoiGianHoanThanh, trangThai: item.trangThai, daiNhietMin: item.daiNhietMin, daiNhietMax: item.daiNhietMax, nhietDoHienTai: item.nhietDoHienTai, nhietDoKetThuc: item.nhietDoKetThuc, ghiChu: item.ghiChu, lyDoTuChoi: item.lyDoTuChoi, quyCachDongGoi: item.quyCachDongGoi, nhietDoMucTieu: item.nhietDoMucTieu, dungSai: item.dungSai };
}
function publicTrip(item: HistoryTrip): CustomerTrip { return { ma: item.ma, ngayChay: item.ngayChay, tenHang: item.tenHang, tuyenDuong: item.tuyenDuong, daiNhiet: item.daiNhiet, ketQua: item.ketQua, nhietDoKetThuc: item.nhietDoKetThuc, trangThaiDatChuan: item.trangThaiDatChuan, soLanCanhBao: item.soLanCanhBao, rangeMin: item.rangeMin, rangeMax: item.rangeMax }; }
export function createCustomerService(actor: NguoiDung, source: CustomerSource = adminService, options = { demo: import.meta.env.VITE_DEMO === 'true' }): CustomerService {
  let scenario: DemoState = 'data';
  const guard = () => { if (actor.vaiTro !== 'khach-hang') throw new CustomerError('Không có quyền truy cập dữ liệu khách hàng.'); if (scenario === 'error') throw new CustomerError('Không thể tải dữ liệu. Vui lòng thử lại.'); };
  return {
    async load() {
      guard(); const [snapshot, settings, draft] = await Promise.all([source.load(), source.getCustomerSettings(actor), source.getCustomerDraft(actor)]);
      return { shipments: scenario === 'empty' ? [] : [...snapshot.requests, ...snapshot.shipments].filter(item => item.khachHangId === actor.id).map(publicShipment), history: scenario === 'empty' ? [] : snapshot.history.filter(item => (item.customerId ?? CUSTOMER_HISTORY_OWNERS[item.ma]) === actor.id).map(publicTrip), settings: scenario === 'empty' ? null : settings, config: scenario === 'empty' || !snapshot.settings ? null : customerMockConfig(snapshot.settings.temperature, snapshot.pageSize), draft, now: snapshot.now };
    },
    async createShipment(input) { guard(); return publicShipment(await source.createCustomerRequest(actor, input)); },
    async saveDraft(input) { guard(); await source.saveCustomerDraft(actor, input); },
    async saveProfile(profile) { guard(); const settings = await source.getCustomerSettings(actor); await source.saveCustomerSettings(actor, { ...settings, profile }); },
    async saveNotifications(notifications) { guard(); const settings = await source.getCustomerSettings(actor); await source.saveCustomerSettings(actor, { ...settings, notifications }); },
    setDemoState(state) { if (options.demo) { scenario = state; source.setDemoState?.('data'); } },
  };
}


