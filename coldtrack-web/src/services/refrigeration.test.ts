import { afterEach, expect, it, vi } from 'vitest';
import * as driverMock from '../mock/driver';
import { createAdminMockData } from '../mock/admin';
import { MOCK_USERS } from '../mock/data';
import { createDriverRepository } from './driverRepository';

afterEach(() => vi.restoreAllMocks());

it('accepts only an assigned, connected refrigerator target within the required range without changing sensor readings', async () => {
  const originalRuntime = driverMock.driverRuntime;
  vi.spyOn(driverMock, 'driverRuntime').mockImplementation((trip, location) => ({ ...originalRuntime(trip, location), refrigeratorConnected: true }));
  const data = createAdminMockData();
  const repository = createDriverRepository(data, async () => {}, { demo: true });
  const actor = MOCK_USERS.taiXe;
  const trip = data.shipments.find(item => item.ma === 'CT-2026-0156')!;
  const measured = trip.nhietDoHienTai;
  const telemetry = structuredClone(data.telemetry);
  for (const invalid of [NaN, Infinity, trip.daiNhietMin - 1, trip.daiNhietMax + 1]) {
    await expect(repository.setDriverTemperature(actor, trip.ma, invalid)).rejects.toThrow();
  }
  await expect(repository.setDriverTemperature(MOCK_USERS.khachHang, trip.ma, -19)).rejects.toThrow();
  await expect(repository.setDriverTemperature(actor, 'CT-2026-0148', -19)).rejects.toThrow();
  await repository.setDriverTemperature(actor, trip.ma, -19);
  expect((await repository.getDriverState(actor)).runtimes[trip.ma].refrigeratorTarget).toBe(-19);
  expect(trip.nhietDoHienTai).toBe(measured);
  expect(data.telemetry).toEqual(telemetry);
  await repository.setDriverConnection(actor, trip.ma, false);
  await expect(repository.setDriverTemperature(actor, trip.ma, -19)).rejects.toThrow();
});
