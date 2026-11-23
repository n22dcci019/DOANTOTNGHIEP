import { describe, expect, it } from 'vitest';
import { customerMockConfig } from '../mock/customer';
import { createAdminMockData } from '../mock/admin';
import { emptyShipmentForm } from './customerTypes';
import type { ShipmentForm } from './customerTypes';
import { productDefaults, validateShipmentForm } from './customerValidation';
const source = createAdminMockData(); const config = customerMockConfig(source.settings!.temperature, source.pageSize);
export const validCustomerForm = (): ShipmentForm => ({ pickup: 'hcm', delivery: 'ct', product: 'frozen-food', weight: '1800', packaging: config.packaging[0], ...productDefaults('frozen-food', config), date: '2026-10-30', time: '16:00', notes: '' });
describe('B3 shipment validation', () => {
  it('requires all core fields', () => expect(Object.keys(validateShipmentForm(emptyShipmentForm(), config, source.now))).toEqual(['pickup', 'delivery', 'product', 'weight', 'packaging', 'target', 'tolerance', 'date', 'time']));
  it('accepts valid shipment', () => expect(validateShipmentForm(validCustomerForm(), config, source.now)).toEqual({}));
  it.each(['0', '-1', '', 'NaN', 'Infinity'])('rejects non-positive/non-finite tolerance %s', tolerance => expect(validateShipmentForm({ ...validCustomerForm(), tolerance }, config, source.now).tolerance).toBeTruthy());
  it.each(['0', '-2', '', '5001', 'Infinity'])('rejects weight %s', weight => expect(validateShipmentForm({ ...validCustomerForm(), weight }, config, source.now).weight).toBeTruthy());
  it.each(['-26', '-14', '', 'NaN'])('rejects out-of-range target %s', target => expect(validateShipmentForm({ ...validCustomerForm(), target }, config, source.now).target).toBeTruthy());
  it('checks whole target±tolerance range including exact system boundary', () => {
    expect(validateShipmentForm({ ...validCustomerForm(), target: '-24', tolerance: '1' }, config, source.now)).toEqual({});
    expect(validateShipmentForm({ ...validCustomerForm(), target: '-24', tolerance: '2' }, config, source.now).tolerance).toBeTruthy();
  });
  it('requires different pickup and delivery', () => expect(validateShipmentForm({ ...validCustomerForm(), delivery: 'hcm' }, config, source.now).delivery).toBeTruthy());
  it.each([{ date: '2026-10-29', time: '23:00' }, { date: '2026-10-30', time: '14:31' }, { date: '2026-02-30', time: '16:00' }])('rejects past/invalid departure $date $time', departure => expect(validateShipmentForm({ ...validCustomerForm(), ...departure }, config, source.now).date).toBeTruthy());
  it('accepts departure exactly at service clock and rejects invalid time', () => {
    expect(validateShipmentForm({ ...validCustomerForm(), time: '14:32' }, config, source.now)).toEqual({});
    expect(validateShipmentForm({ ...validCustomerForm(), time: '25:00' }, config, source.now).time).toBeTruthy();
  });
  it('reads product defaults and limits from supplied config', () => {
    expect(productDefaults('ice-cream', config)).toEqual({ target: '-22', tolerance: '2' });
    const custom = { ...config, products: [{ id: 'custom', label: 'Tùy chỉnh', target: -21, tolerance: .5 }] };
    expect(productDefaults('custom', custom)).toEqual({ target: '-21', tolerance: '0.5' });
    expect(productDefaults('unknown', custom)).toEqual({ target: '', tolerance: '' });
  });
  it('rejects unknown goods/packaging and enforces configured note length', () => {
    const errors = validateShipmentForm({ ...validCustomerForm(), product: 'vaccine', packaging: 'unknown', notes: 'x'.repeat(config.maxNotesLength + 1) }, config, source.now);
    expect(Object.keys(errors)).toEqual(['product', 'packaging', 'notes']);
  });
});
