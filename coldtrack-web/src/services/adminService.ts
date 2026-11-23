import { createAdminMockData, ADMIN_MOCK_OPTIONS } from '../mock/admin';
import { AdminError, validateThresholds, vehicleIssue } from './adminTypes';
import type { AdminData, AdminService, DemoState } from './adminTypes';
import { validateEmail } from '../auth/validation';
import { customerMockConfig, initialCustomerSettings } from '../mock/customer';
import { validateShipmentForm } from './customerValidation';
import { CustomerError } from './customerTypes';
import type { CustomerRepository, CustomerSettings, ShipmentForm } from './customerTypes';
import type { NguoiDung } from '../mock/types';
import { createDriverRepository } from './driverRepository';
import type { DriverRepository } from './driverTypes';
export function createMockAdminService(options = { demo: false, delayMs: ADMIN_MOCK_OPTIONS.latencyMs }): AdminService & CustomerRepository & DriverRepository {
  const data = createAdminMockData();
  let scenario: DemoState = 'data';
  const customerSettings = new Map<string, CustomerSettings>();
  const drafts = new Map<string, ShipmentForm>();
  const requireCustomer = (actor: NguoiDung) => { if (actor.vaiTro !== 'khach-hang') throw new CustomerError('Không có quyền truy cập dữ liệu khách hàng.'); };
  const settingsFor = (actor: NguoiDung) => { requireCustomer(actor); if (!customerSettings.has(actor.id)) customerSettings.set(actor.id, initialCustomerSettings(actor)); return customerSettings.get(actor.id)!; };
  const wait = async () => { if (options.delayMs) await new Promise(resolve => setTimeout(resolve, options.delayMs)); if (scenario === 'error') throw new AdminError('Không thể tải dữ liệu. Vui lòng thử lại.'); };
  const log = (action: string, detail: string) => { data.logs.unshift({ id: crypto.randomUUID(), thoiGian: data.now, nguoiThucHien: data.settings!.profile.ten, vaiTro: 'Quản trị viên Hub', hanhDong: action, chiTiet: detail }); };
  const driverRepository = createDriverRepository(data, wait, options);
  return {
    ...driverRepository,
    async finishManagedTrip(id, reason) { await driverRepository.finishDriverTrip(data.settings!.profile, id, reason); },
    async reportManagedIncident(id, type, description) { await driverRepository.reportDriverIncident(data.settings!.profile, id, { type, description }); },
    async updateTripRange(id, min, max, reason) {
      await wait(); const trip = data.shipments.find(item => item.ma === id);
      if (!trip || trip.trangThai !== '\u0110ang v\u1eadn chuy\u1ec3n') throw new AdminError('Chuy\u1ebfn kh\u00f4ng c\u00f2n \u0111ang v\u1eadn chuy\u1ec3n.');
      const error = validateThresholds({ ...data.settings!.temperature, defaultMin: min, defaultMax: max });
      if (error) throw new AdminError(error);
      if (!reason.trim()) throw new AdminError('Vui l\u00f2ng nh\u1eadp l\u00fd do thay \u0111\u1ed5i.');
      trip.daiNhietMin = min; trip.daiNhietMax = max;
      log('C\u1eadp nh\u1eadt d\u1ea3i nhi\u1ec7t', `${id}: ${min} \u2192 ${max}. ${reason.trim()}`);
    },
    async load(signal) { await wait(); if (signal?.aborted) throw new DOMException('Đã hủy', 'AbortError'); const result = structuredClone(data); return scenario === 'empty' ? { ...result, shipments: [], requests: [], alerts: [], vehicles: [], history: [], logs: [], settings: null } : result; },
    async approve(id, input) {
      await wait(); const request = data.requests.find(item => item.ma === id);
      if (!request) throw new AdminError('Yêu cầu không tồn tại hoặc đã được xử lý.');
      const config = data.settings!.temperature;
      const error = validateThresholds({ ...config, defaultMin: input.min, defaultMax: input.max });
      if (error) throw new AdminError(error, 'temperature');
      const vehicle = data.vehicles.find(item => item.id === input.vehicleId);
      if (!vehicle || vehicleIssue(vehicle, request, input.min, input.max)) throw new AdminError(vehicle ? vehicleIssue(vehicle, request, input.min, input.max) : 'Vui lòng chọn xe hợp lệ.', 'vehicle');
      const driver = data.drivers.find(item => item.id === input.driverId && item.available);
      if (!driver) throw new AdminError('Vui lòng chọn tài xế đang rảnh.', 'driver');
      const [date, time] = request.thoiGianKhoiHanh.split(' '); const [day, month, year] = date.split('/');
      if (new Date(`${year}-${month}-${day}T${time}:00+07:00`) < new Date(data.now)) throw new AdminError('Thời gian khởi hành không được ở quá khứ.');
      data.requests = data.requests.filter(item => item.ma !== id);
      data.shipments.unshift({ ...request, trangThai: 'Chờ xuất phát', maXe: vehicle.bienSo, maTaiXe: driver.userId ?? driver.id, tenTaiXe: driver.name, soDienThoaiTaiXe: driver.phone, maThietBi: vehicle.maThietBi, daiNhietMin: input.min, daiNhietMax: input.max });
      vehicle.trangThai = 'Đang hoạt động'; vehicle.taiXeHienTai = driver.name; driver.available = false;
      log('Duyệt & phân công chuyến', `${id}: xe ${vehicle.bienSo}, tài xế ${driver.name}.`);
    },
    async reject(id, reason) { await wait(); if (!reason.trim()) throw new AdminError('Vui lòng nhập lý do từ chối.', 'reason'); const request = data.requests.find(item => item.ma === id); if (!request) throw new AdminError('Yêu cầu không tồn tại hoặc đã được xử lý.'); data.requests = data.requests.filter(item => item.ma !== id); data.shipments.unshift({ ...request, trangThai: 'Từ chối', lyDoTuChoi: reason.trim() }); log('Từ chối yêu cầu', `${id}: ${reason.trim()}`); },
    async resolveAlert(id, note) { await wait(); if (!note.trim()) throw new AdminError('Vui lòng nhập ghi chú xử lý.', 'note'); const alert = data.alerts.find(item => item.id === id); if (!alert || alert.daXuLy) throw new AdminError('Cảnh báo không tồn tại hoặc đã được xử lý.'); alert.daXuLy = true; alert.ghiChuXuLy = note.trim(); alert.nguoiXuLy = data.settings!.profile.ten; alert.thoiGianXuLy = data.now; log('Xử lý cảnh báo', `${id} · ${alert.maLo}: ${note.trim()}`); },
    async saveProfile(profile) { await wait(); if (!profile.ten.trim()) throw new AdminError('Vui lòng nhập họ và tên.', 'name'); if (validateEmail(profile.email)) throw new AdminError(validateEmail(profile.email), 'email'); if (!/^(\+84|0)\d{9}$/.test((profile.soDienThoai ?? '').replace(/\s/g, ''))) throw new AdminError('Vui lòng nhập số điện thoại hợp lệ.', 'phone'); data.settings!.profile = { ...data.settings!.profile, ten: profile.ten.trim(), email: profile.email.trim(), soDienThoai: profile.soDienThoai, donVi: profile.donVi }; log('Cập nhật tài khoản', 'Đã cập nhật thông tin tài khoản Điều phối.'); },
    async saveNotifications(notifications) { await wait(); data.settings!.notifications = { ...notifications }; log('Cập nhật thông báo', 'Đã lưu kênh nhận thông báo.'); },
    async saveThresholds(config, reason) { await wait(); if (!data.settings!.thresholdDesignId) throw new AdminError('Chưa có thiết kế ngưỡng nhiệt độ.'); const limits = data.settings!.temperature; if (config.min !== limits.min || config.max !== limits.max) throw new AdminError('Không được thay đổi giới hạn hệ thống.'); const error = validateThresholds(config); if (error) throw new AdminError(error, 'temperature'); if (!reason.trim()) throw new AdminError('Vui lòng nhập lý do thay đổi để lưu vết kiểm toán.', 'reason'); data.settings!.temperature = { ...config }; log('Thay đổi ngưỡng nhiệt độ', `${config.defaultMin} °C → ${config.defaultMax} °C. ${reason.trim()}`); },
    async createCustomerRequest(actor, input) {
      requireCustomer(actor); await wait();
      const config = customerMockConfig(data.settings!.temperature, data.pageSize);
      const fields = validateShipmentForm(input, config, data.now);
      if (Object.keys(fields).length) throw new CustomerError('Vui lòng kiểm tra thông tin lô hàng.', fields);
      const profile = settingsFor(actor).profile;
      const allIds = [...data.shipments, ...data.requests].map(item => Number(item.ma.split('-').at(-1))).filter(Number.isFinite);
      const ma = `CT-${data.now.slice(0, 4)}-${String(Math.max(...allIds) + 1).padStart(4, '0')}`;
      const request = {
        ma, tenHang: config.products.find(item => item.id === input.product)!.label,
        soThung: 0, khoiLuongKg: Number(input.weight),
        diemLay: config.locations.find(item => item.id === input.pickup)!.label,
        diemGiao: config.locations.find(item => item.id === input.delivery)!.label,
        thoiGianKhoiHanh: `${input.date.split('-').reverse().join('/')} ${input.time}`,
        trangThai: 'Chờ điều phối duyệt' as const,
        daiNhietMin: Number(input.target) - Number(input.tolerance), daiNhietMax: Number(input.target) + Number(input.tolerance),
        nhietDoMucTieu: Number(input.target), dungSai: Number(input.tolerance), quyCachDongGoi: input.packaging,
        khachHangId: actor.id, tenKhachHang: profile.donVi || profile.ten, ghiChu: input.notes.trim(),
      };
      data.requests.unshift(request); data.telemetry[ma] = []; drafts.delete(actor.id);
      data.logs.unshift({ id: crypto.randomUUID(), thoiGian: data.now, nguoiThucHien: profile.ten, vaiTro: 'Khách hàng', hanhDong: 'Gửi yêu cầu tạo lô hàng', chiTiet: `${ma}: ${request.tenHang}, ${request.khoiLuongKg} kg.` });
      return structuredClone(request);
    },
    async getCustomerSettings(actor) { await wait(); return structuredClone(settingsFor(actor)); },
    async saveCustomerSettings(actor, input) {
      requireCustomer(actor); await wait(); const existing = settingsFor(actor);
      if (!input.profile.ten.trim()) throw new CustomerError('Vui lòng nhập họ và tên.', { name: 'Vui lòng nhập họ và tên.' });
      if (validateEmail(input.profile.email)) throw new CustomerError(validateEmail(input.profile.email), { email: validateEmail(input.profile.email) });
      if (!/^(\+84|0)\d{9}$/.test((input.profile.soDienThoai ?? '').replace(/\s/g, ''))) throw new CustomerError('Vui lòng nhập số điện thoại hợp lệ.', { phone: 'Vui lòng nhập số điện thoại hợp lệ.' });
      customerSettings.set(actor.id, { profile: { ...existing.profile, ten: input.profile.ten.trim(), email: input.profile.email.trim(), donVi: input.profile.donVi?.trim(), soDienThoai: input.profile.soDienThoai?.trim() }, notifications: { email: !!input.notifications.email, sms: !!input.notifications.sms, temperature: !!input.notifications.temperature } });
    },
    async getCustomerDraft(actor) { requireCustomer(actor); await wait(); return structuredClone(drafts.get(actor.id) ?? null); },
    async saveCustomerDraft(actor, draft) { requireCustomer(actor); await wait(); drafts.set(actor.id, structuredClone(draft)); },
    setDemoState(state) { if (options.demo) scenario = state; },
  };
}
export const adminService: AdminService & CustomerRepository & DriverRepository = createMockAdminService({ demo: import.meta.env.VITE_DEMO === 'true', delayMs: ADMIN_MOCK_OPTIONS.latencyMs });
export type { AdminData, AdminService };




