import { describe, expect, it } from 'vitest';
import { createMockAdminService } from './adminService';
import { createDriverService } from './driverService';
import { createDriverRepository } from './driverRepository';
import { createCustomerService } from './customerService';
import { createAdminMockData } from '../mock/admin';
import { driverMockConfig, DRIVER_MOCK } from '../mock/driver';
import { MOCK_USERS } from '../mock/data';
import { validateDriverAdjustment, validateDriverIncident } from './driverValidation';
const actor = MOCK_USERS.taiXe;
function setup(demo = true) { const source = createMockAdminService({ demo, delayMs: 0 }); return { source, driver: createDriverService(actor, source, { demo }) }; }
describe('B4 driver service and business rules', () => {
  it('returns only assigned current trip and its own alerts/history', async () => {
    const { driver } = setup(); const data = await driver.load(); expect(data.current?.ma).toBe('CT-2026-0156'); expect(data.alerts).toHaveLength(1); expect(data.alerts[0]).toMatchObject({ maLo: 'CT-2026-0156', mucDo: 'Nghiêm trọng' }); expect(data.history.map(item => item.ma)).toEqual(['CT-2026-0301']); expect(data.runtime).toMatchObject({ door: 'Đã đóng', location: 'QL1A, Đồng Nai' }); expect(data.current).not.toHaveProperty('khachHangId');
  });
  it('does not infer assignments from matching driver name', async () => {
    const { source } = setup(); const other = createDriverService({ ...actor, id: 'different-driver' }, source); const data = await other.load(); expect(data.current).toBeNull(); expect(data.alerts).toEqual([]); expect(data.history).toEqual([]);
  });
  it('rejects wrong role at service and repository boundaries', async () => {
    const { source } = setup(); await expect(createDriverService(MOCK_USERS.khachHang, source).load()).rejects.toThrow('Không có quyền'); await expect(source.getDriverState(MOCK_USERS.admin)).rejects.toThrow('Không có quyền');
  });
  it('rejects actions on another driver shipment', async () => {
    const { driver } = setup(); await expect(driver.reportIncident('CT-2026-0148', { type: 'other', description: 'Không được phép' })).rejects.toThrow(); await expect(driver.finishTrip('CT-2026-0148', 'Không được phép')).rejects.toThrow(); await expect(driver.acknowledgeAlert('CT-2026-0156', 'CB-2026-002', 'Không thuộc chuyến')).rejects.toThrow('không thuộc chuyến');
  });
  it('rejects driver management mutations and disconnected refrigeration control', async () => {
    const { driver, source } = setup();
    await expect(driver.requestAdjustment('CT-2026-0156', { min: '-22', max: '-18', reason: 'test' })).rejects.toThrow();
    await expect(driver.finishTrip('CT-2026-0156', 'test')).rejects.toThrow();
    await expect(driver.reportIncident('CT-2026-0156', { type: 'door', description: 'test' })).rejects.toThrow();
    await expect(driver.setTemperature('CT-2026-0156', -19)).rejects.toThrow();
    await expect(driver.setTemperature('CT-2026-0148', -19)).rejects.toThrow();
    const before = await source.load();
    await expect(source.updateTripRange('CT-2026-0156', -18, -22, 'test')).rejects.toThrow();
    await expect(source.updateTripRange('CT-2026-0156', -22, -18, '')).rejects.toThrow();
    await source.updateTripRange('CT-2026-0156', -22, -18, 'test');
    const after = await source.load();
    expect(after.shipments.find(t => t.ma === 'CT-2026-0156')?.daiNhietMin).toBe(-22);
    expect(after.telemetry).toEqual(before.telemetry);
  });
  it('acknowledges with note without closing dispatch alert', async () => {
    const { driver, source } = setup(); await expect(driver.acknowledgeAlert('CT-2026-0156', 'CB-2026-001', '  ')).rejects.toThrow('ghi chú'); await driver.acknowledgeAlert('CT-2026-0156', 'CB-2026-001', 'Đã nhận, đang kiểm tra.'); const data = await driver.load(); expect(data.acknowledgements[0].note).toBe('Đã nhận, đang kiểm tra.'); expect((await source.load()).alerts[0].daXuLy).toBe(false);
  });
  it('creates incident with configured severity and current GPS only on assigned trip', async () => {
    const { driver, source } = setup(); await expect(source.reportManagedIncident('CT-2026-0156', '', '')).rejects.toMatchObject({ fields: { type: 'Vui lòng chọn loại sự cố.', description: 'Vui lòng mô tả sự cố.' } });
    await source.reportManagedIncident('CT-2026-0156', 'door', 'Đang kiểm tra gioăng cửa.'); const data = await driver.load(); expect(data.alerts[0]).toMatchObject({ maLo: 'CT-2026-0156', mucDo: 'Cảnh báo', daXuLy: false }); expect(data.alerts[0].noiDung).toContain('QL1A, Đồng Nai'); expect((await source.load()).logs[0].hanhDong).toBe('Báo sự cố');
  });
  it('requires reason for not-passing completion and updates B2/B3 history', async () => {
    const { driver, source } = setup(); const customer = createCustomerService(MOCK_USERS.khachHang, source); const before = await customer.load();
    await expect(source.finishManagedTrip('CT-2026-0156', '')).rejects.toThrow('không đạt'); expect((await driver.load()).current).toBeTruthy();
    await source.finishManagedTrip('CT-2026-0156', 'Máy lạnh gặp sự cố, đã báo Điều phối.'); const after = await driver.load(); expect(after.current).toBeNull(); expect(after.alerts).toEqual([]); expect(after.history[0]).toMatchObject({ ma: 'CT-2026-0156', trangThaiDatChuan: 'Không đạt', nhietDoKetThuc: -15.8 });
    expect((await customer.load()).history).toHaveLength(before.history.length + 1); expect((await source.load()).vehicles.find(item => item.bienSo === '51D-800.10')?.trangThai).toBe('Rảnh'); await expect(source.finishManagedTrip('CT-2026-0156', 'lặp lại')).rejects.toThrow('Không có chuyến');
    await source.approve('CT-2026-0401', { vehicleId: 'xe-01', driverId: 'driver-busy-01', min: -20, max: -18 });
    expect((await source.load()).shipments.find(item => item.ma === 'CT-2026-0401')?.maTaiXe).toBe(actor.id);
  });
  it('computes passing completion from server temperature and supports missing sensor validation', async () => {
    const data = createAdminMockData(); const trip = data.shipments.find(item => item.ma === 'CT-2026-0156')!; const repo = createDriverRepository(data, async () => {}, { demo: false });
    trip.nhietDoHienTai = undefined; await expect(repo.finishDriverTrip(MOCK_USERS.admin, trip.ma, '')).rejects.toThrow('Chưa có nhiệt độ');
    trip.nhietDoHienTai = DRIVER_MOCK.completedTemperature; await repo.finishDriverTrip(MOCK_USERS.admin, trip.ma, ''); expect(data.history[0].trangThaiDatChuan).toBe('Đạt chuẩn'); expect(data.history[0].nhietDoKetThuc).toBe(DRIVER_MOCK.completedTemperature);
  });
  it('keeps profile and notifications scoped and role immutable', async () => {
    const { driver, source } = setup(); const data = await driver.load(); await driver.saveProfile({ ...data.settings!.profile, id: MOCK_USERS.admin.id, vaiTro: 'dieu-phoi', ten: 'Tài xế cập nhật' }); await driver.saveNotifications({ email: false, sms: true, temperature: true }); const after = await driver.load(); expect(after.settings!.profile).toMatchObject({ id: actor.id, vaiTro: 'tai-xe', ten: 'Tài xế cập nhật' }); expect(after.settings!.notifications.sms).toBe(true); expect((await source.load()).settings!.profile.ten).toBe(MOCK_USERS.admin.ten);
  });
  it('gates connection simulation and data scenarios by demo flag', async () => {
    const disabled = setup(false); disabled.driver.setDemoState!('error'); expect((await disabled.driver.load()).current).toBeTruthy(); await expect(disabled.driver.setConnection('CT-2026-0156', false)).rejects.toThrow('demo');
    const enabled = setup(); await enabled.driver.setConnection('CT-2026-0156', false); expect((await enabled.driver.load()).runtime).toMatchObject({ connected: false, pendingRecords: DRIVER_MOCK.queuedRecordsOffline }); enabled.driver.setDemoState!('empty'); expect((await enabled.driver.load()).current).toBeNull(); enabled.driver.setDemoState!('error'); await expect(enabled.driver.load()).rejects.toThrow('Không thể tải'); enabled.driver.setDemoState!('data'); expect((await enabled.driver.load()).current).toBeTruthy();
  });
});
describe('B4 driver validation', () => {
  const snapshot = createAdminMockData(); const config = driverMockConfig(snapshot.settings!.temperature, snapshot.pageSize);
  it.each([{ min: '', max: '-18' }, { min: '-30', max: '-18' }, { min: '-20', max: '-14' }, { min: '-18', max: '-20' }, { min: 'Infinity', max: '-18' }])('rejects invalid range $min to $max', input => expect(Object.keys(validateDriverAdjustment({ ...input, reason: 'Kiểm tra' }, config)).length).toBeGreaterThan(0));
  it('accepts exact configured boundaries and requires audit reason', () => { expect(validateDriverAdjustment({ min: String(config.temperature.min), max: String(config.temperature.max), reason: 'Kiểm tra dàn lạnh' }, config)).toEqual({}); expect(validateDriverAdjustment({ min: '-20', max: '-18', reason: '' }, config).reason).toBeTruthy(); });
  it('validates configured incident types and description length', () => { expect(validateDriverIncident({ type: 'other', description: 'Mô tả sự cố' }, config)).toEqual({}); expect(validateDriverIncident({ type: 'unknown', description: 'x'.repeat(config.maxNotesLength + 1) }, config)).toHaveProperty('type'); });
});

