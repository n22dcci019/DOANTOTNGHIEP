import { describe, expect, it } from 'vitest';
import { createMockAdminService } from './adminService';
import { createCustomerService } from './customerService';
import { MOCK_USERS } from '../mock/data';
import { productDefaults } from './customerValidation';
import type { CustomerConfig, ShipmentForm } from './customerTypes';
const actor = MOCK_USERS.khachHang;
function setup() { const source = createMockAdminService({ demo: true, delayMs: 0 }); return { source, customer: createCustomerService(actor, source, { demo: true }) }; }
function input(config: CustomerConfig): ShipmentForm { return { pickup: 'hcm', delivery: 'ct', product: 'frozen-food', weight: '1500', packaging: config.packaging[0], ...productDefaults('frozen-food', config), date: '2026-10-30', time: '16:00', notes: 'Giữ nhiệt ổn định' }; }
describe('B3 customer data isolation and mutations', () => {
  it('only returns owned shipments and strips internal fields', async () => {
    const { source, customer } = setup(); const data = await customer.load(); const original = await source.load();
    expect(data.shipments.length).toBeGreaterThan(0);
    expect(data.shipments.every(item => [...original.shipments, ...original.requests].find(record => record.ma === item.ma)?.khachHangId === actor.id)).toBe(true);
    expect(data.shipments.every(item => !('maXe' in item) && !('maTaiXe' in item) && !('maThietBi' in item))).toBe(true);
    expect(data.history.every(item => !('xeBienSo' in item) && !('taiXeTen' in item))).toBe(true);
    expect(data.settings?.profile.id).toBe(actor.id);
    expect(data.config).not.toHaveProperty('thresholdDesignId');
  });
  it('does not grant a new customer shipments/history by matching company name', async () => {
    const { source } = setup(); const another = createCustomerService({ ...actor, id: 'other-customer' }, source);
    const data = await another.load(); expect(data.shipments).toEqual([]); expect(data.history).toEqual([]);
  });
  it('rejects non-customer identity at both service boundaries', async () => {
    const { source } = setup(); const data = await source.load(); const config = (await createCustomerService(actor, source).load()).config!;
    await expect(createCustomerService(MOCK_USERS.admin, source).load()).rejects.toThrow('Không có quyền');
    await expect(source.createCustomerRequest(MOCK_USERS.admin, input(config))).rejects.toThrow('Không có quyền');
    expect((await source.load()).requests).toHaveLength(data.requests.length);
  });
  it('creates request with authenticated owner and shares it with B2 approval queue', async () => {
    const { source, customer } = setup(); const before = await customer.load(); const form = input(before.config!);
    await customer.saveDraft(form); const created = await customer.createShipment(form);
    expect(created).toMatchObject({ trangThai: 'Chờ điều phối duyệt', daiNhietMin: -20, daiNhietMax: -18, nhietDoMucTieu: -19, dungSai: 1 });
    expect(created.ma).toMatch(/^CT-2026-\d{4}$/);
    const after = await customer.load(); expect(after.shipments).toHaveLength(before.shipments.length + 1); expect(after.draft).toBeNull();
    const admin = await source.load(); expect(admin.requests.find(item => item.ma === created.ma)?.khachHangId).toBe(actor.id); expect(admin.logs[0].chiTiet).toContain(created.ma);
    await source.approve(created.ma, { vehicleId: 'xe-ranh-01', driverId: 'driver-free-01', min: created.daiNhietMin, max: created.daiNhietMax });
    expect((await customer.load()).shipments.find(item => item.ma === created.ma)?.trangThai).toBe('Chờ xuất phát');
  });
  it('validates mutation on service even if client validation is bypassed', async () => {
    const { customer } = setup(); const config = (await customer.load()).config!;
    await expect(customer.createShipment({ ...input(config), tolerance: '-1' })).rejects.toMatchObject({ fields: { tolerance: 'Dung sai phải là số dương.' } });
  });
  it('preserves partial draft by owner across service instances', async () => {
    const { source, customer } = setup(); const config = (await customer.load()).config!; const form = { ...input(config), delivery: '', weight: '' };
    await customer.saveDraft(form); expect((await createCustomerService(actor, source).load()).draft).toEqual(form);
    expect((await createCustomerService({ ...actor, id: 'other' }, source).load()).draft).toBeNull();
  });
  it('keeps profile/notifications scoped and refuses role or ID edits', async () => {
    const { source, customer } = setup(); const data = await customer.load();
    await customer.saveProfile({ ...data.settings!.profile, id: MOCK_USERS.admin.id, vaiTro: 'dieu-phoi', ten: 'Khách đã cập nhật' });
    await customer.saveNotifications({ email: false, sms: true, temperature: true });
    const updated = await customer.load(); expect(updated.settings?.profile).toMatchObject({ id: actor.id, vaiTro: 'khach-hang', ten: 'Khách đã cập nhật' }); expect(updated.settings?.notifications.sms).toBe(true);
    expect((await source.load()).settings!.profile.ten).toBe(MOCK_USERS.admin.ten);
  });
  it('uses latest default configuration from B2 and offers demo states only when enabled', async () => {
    const { source, customer } = setup(); const config = (await source.load()).settings!.temperature;
    await source.saveThresholds({ ...config, defaultMin: -22 }, 'Điều chỉnh mặc định');
    expect(productDefaults('frozen-food', (await customer.load()).config!)).toEqual({ target: '-20', tolerance: '2' });
    customer.setDemoState!('empty'); expect((await customer.load()).config).toBeNull();
    customer.setDemoState!('error'); await expect(customer.load()).rejects.toThrow('Không thể tải');
    customer.setDemoState!('data'); expect((await customer.load()).config).toBeTruthy();
    const disabled = createCustomerService(actor, source, { demo: false }); disabled.setDemoState!('error'); await expect(disabled.load()).resolves.toBeTruthy();
  });
});
