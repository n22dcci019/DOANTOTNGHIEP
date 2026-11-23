import { describe, expect, it } from 'vitest';
import { createMockAdminService } from './adminService';
import { validateThresholds, vehicleIssue } from './adminTypes';
const setup = () => createMockAdminService({ demo: true, delayMs: 0 });
describe('B2 AdminService', () => {
  it('keeps baseline totals consistent and alert shipment references valid', async () => {
    const data = await setup().load();
    expect(data.shipments).toHaveLength(49); expect(data.vehicles).toHaveLength(32); expect(data.history).toHaveLength(24);
    expect(data.history.filter(item => item.ketQua === 'Đúng nhiệt độ')).toHaveLength(21);
    expect(data.alerts.filter(item => !item.daXuLy)).toHaveLength(4);
    expect(data.alerts.filter(item => !item.daXuLy && item.mucDo !== 'Thông tin')).toHaveLength(3);
    expect(data.alerts.every(alert => data.shipments.some(shipment => shipment.ma === alert.maLo))).toBe(true);
    expect(data.requests.every(item => item.trangThai === 'Chờ điều phối duyệt')).toBe(true);
  });
  it('returns detached snapshots', async () => { const service = setup(); const first = await service.load(); first.shipments.length = 0; expect((await service.load()).shipments).toHaveLength(49); });
  it('requires note to resolve and updates counts and audit trail', async () => {
    const service = setup(); const data = await service.load(); const alert = data.alerts[0];
    await expect(service.resolveAlert(alert.id, '   ')).rejects.toThrow('ghi chú');
    await service.resolveAlert(alert.id, 'Đã kiểm tra máy lạnh.');
    const after = await service.load(); expect(after.alerts.find(item => item.id === alert.id)).toMatchObject({ daXuLy: true, ghiChuXuLy: 'Đã kiểm tra máy lạnh.' });
    expect(after.logs[0].chiTiet).toContain(alert.id);
    expect(after.alerts.filter(item => !item.daXuLy && item.mucDo !== 'Thông tin')).toHaveLength(2);
    await expect(service.resolveAlert(alert.id, 'Lặp lại')).rejects.toThrow('đã được xử lý');
  });
  it('approves a request, allocates resources and disallows double allocation', async () => {
    const service = setup(); const data = await service.load(); const request = data.requests[0];
    const input = { vehicleId: data.vehicles.find(item => item.trangThai === 'Rảnh')!.id, driverId: data.drivers.find(item => item.available)!.id, min: request.daiNhietMin, max: request.daiNhietMax };
    await service.approve(request.ma, input); const after = await service.load();
    expect(after.requests).toHaveLength(data.requests.length - 1); expect(after.shipments).toHaveLength(50);
    expect(after.shipments[0]).toMatchObject({ ma: request.ma, trangThai: 'Chờ xuất phát' });
    expect(after.drivers.find(item => item.id === input.driverId)!.available).toBe(false);
    expect(after.vehicles.find(item => item.id === input.vehicleId)!.trangThai).toBe('Đang hoạt động');
    await expect(service.approve(data.requests[1].ma, input)).rejects.toThrow('không rảnh');
  });
  it('rejects busy driver and invalid temperature without changing request', async () => {
    const service = setup(); const data = await service.load(); const request = data.requests[0];
    const input = { vehicleId: data.vehicles.find(item => item.trangThai === 'Rảnh')!.id, driverId: data.drivers.find(item => !item.available)!.id, min: request.daiNhietMin, max: request.daiNhietMax };
    await expect(service.approve(request.ma, input)).rejects.toThrow('tài xế đang rảnh');
    await expect(service.approve(request.ma, { ...input, min: -30 })).rejects.toThrow('giới hạn');
    expect((await service.load()).requests).toHaveLength(data.requests.length);
  });
  it('validates vehicle load and supported range', async () => {
    const data = await setup().load(); const vehicle = data.vehicles.find(item => item.trangThai === 'Rảnh')!; const request = data.requests[0];
    expect(vehicleIssue(vehicle, { ...request, khoiLuongKg: vehicle.taiTrongKg + 1 })).toContain('tải trọng');
    expect(vehicleIssue({ ...vehicle, nhietDoMinHoTro: -18 }, request)).toContain('dải nhiệt');
  });
  it('requires rejection reason and persists refusal', async () => {
    const service = setup(); const data = await service.load(); const id = data.requests[0].ma;
    await expect(service.reject(id, '')).rejects.toThrow('lý do');
    await service.reject(id, 'Không đủ xe phù hợp');
    const after = await service.load(); expect(after.shipments.find(item => item.ma === id)).toMatchObject({ trangThai: 'Từ chối', lyDoTuChoi: 'Không đủ xe phù hợp' });
  });
  it('saves thresholds with reason without rewriting existing shipment ranges', async () => {
    const service = setup(); const data = await service.load(); const config = { ...data.settings!.temperature, defaultMin: -22 };
    await expect(service.saveThresholds(config, '')).rejects.toThrow('lý do');
    await expect(service.saveThresholds({ ...config, min: -30 }, 'changed')).rejects.toThrow('giới hạn');
    await service.saveThresholds(config, 'Điều chỉnh cho đơn mới');
    const after = await service.load(); expect(after.settings!.temperature.defaultMin).toBe(-22); expect(after.shipments).toEqual(data.shipments); expect(after.logs[0].hanhDong).toBe('Thay đổi ngưỡng nhiệt độ');
    expect(validateThresholds({ ...config, defaultMin: config.defaultMax })).toBeTruthy();
    expect(validateThresholds({ ...config, nearMargin: 0 })).toBeTruthy();
  });
  it('validates profile and preserves server-owned role', async () => {
    const service = setup(); const data = await service.load();
    await expect(service.saveProfile({ ...data.settings!.profile, email: 'invalid' })).rejects.toThrow('email');
    await service.saveProfile({ ...data.settings!.profile, ten: 'Điều phối mới', vaiTro: 'tai-xe' });
    expect((await service.load()).settings!.profile).toMatchObject({ ten: 'Điều phối mới', vaiTro: 'dieu-phoi' });
  });
  it('supports empty/error demo states and disables simulation when demo off', async () => {
    const service = setup(); service.setDemoState!('empty'); expect((await service.load()).shipments).toEqual([]);
    service.setDemoState!('error'); await expect(service.load()).rejects.toThrow('Không thể tải');
    service.setDemoState!('data'); expect((await service.load()).shipments).toHaveLength(49);
    const production = createMockAdminService({ demo: false, delayMs: 0 }); production.setDemoState!('error'); expect((await production.load()).shipments).toHaveLength(49);
  });
});
