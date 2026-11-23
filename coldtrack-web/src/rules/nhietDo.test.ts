/**
 * src/rules/nhietDo.test.ts
 * Unit test cho trangThaiNhietDo và datChuan.
 * Bao phủ tất cả ca biên theo RULES.md mục 14:
 *   - Đúng bằng min, đúng bằng max
 *   - Lệch 1°C (trong dải, tiến sát biên)
 *   - Lệch 2°C (ngoài dải — ranh giới Vượt ngưỡng / Nghiêm trọng)
 *   - Mức vượt lớn
 */

import { describe, it, expect } from 'vitest';
import { trangThaiNhietDo, datChuan } from './nhietDo';

// Dải chuẩn dùng cho hầu hết test: min=-20, max=-18
const MIN = -20;
const MAX = -18;

describe('trangThaiNhietDo', () => {
  // ── Trong ngưỡng ──────────────────────────────────────────────
  it('trả về "Trong ngưỡng" khi nằm chính giữa dải', () => {
    expect(trangThaiNhietDo(-19, MIN, MAX)).toBe('Trong ngưỡng');
  });

  // ── Tiến sát ngưỡng (trong dải, cách biên < 1°C) ─────────────
  it('trả về "Tiến sát ngưỡng" khi đúng bằng min (-20)', () => {
    expect(trangThaiNhietDo(-20, MIN, MAX)).toBe('Tiến sát ngưỡng');
  });

  it('trả về "Tiến sát ngưỡng" khi đúng bằng max (-18)', () => {
    expect(trangThaiNhietDo(-18, MIN, MAX)).toBe('Tiến sát ngưỡng');
  });

  it('trả về "Tiến sát ngưỡng" khi cách min đúng 0.5°C (-19.5)', () => {
    expect(trangThaiNhietDo(-19.5, MIN, MAX)).toBe('Tiến sát ngưỡng');
  });

  it('trả về "Tiến sát ngưỡng" khi cách max đúng 0.5°C (-18.5)', () => {
    expect(trangThaiNhietDo(-18.5, MIN, MAX)).toBe('Tiến sát ngưỡng');
  });

  it('"Trong ngưỡng" khi cách biên đúng 1°C phía min (-19)', () => {
    // min+1 = -19 → cachBienGan = 1 → Trong ngưỡng
    expect(trangThaiNhietDo(-19, MIN, MAX)).toBe('Trong ngưỡng');
  });

  it('"Tiến sát ngưỡng" khi cách biên đúng 0.999°C phía min', () => {
    expect(trangThaiNhietDo(-19.001, MIN, MAX)).toBe('Tiến sát ngưỡng');
  });

  // ── Vượt ngưỡng (ngoài dải, vượt biên < 2°C) ─────────────────
  it('trả về "Vượt ngưỡng" khi vượt max 0.1°C (-17.9)', () => {
    expect(trangThaiNhietDo(-17.9, MIN, MAX)).toBe('Vượt ngưỡng');
  });

  it('trả về "Vượt ngưỡng" khi vượt min 0.1°C (-20.1)', () => {
    expect(trangThaiNhietDo(-20.1, MIN, MAX)).toBe('Vượt ngưỡng');
  });

  it('trả về "Vượt ngưỡng" khi vượt max đúng 1°C (-17)', () => {
    expect(trangThaiNhietDo(-17, MIN, MAX)).toBe('Vượt ngưỡng');
  });

  it('trả về "Vượt ngưỡng" khi vượt min đúng 1°C (-21)', () => {
    expect(trangThaiNhietDo(-21, MIN, MAX)).toBe('Vượt ngưỡng');
  });

  it('"Vượt ngưỡng" khi vượt max 1.999°C (biên dưới Nghiêm trọng)', () => {
    expect(trangThaiNhietDo(-16.001, MIN, MAX)).toBe('Vượt ngưỡng');
  });

  // ── Nghiêm trọng (ngoài dải, vượt biên ≥ 2°C) ───────────────
  it('trả về "Nghiêm trọng" khi vượt max đúng 2°C (-16)', () => {
    expect(trangThaiNhietDo(-16, MIN, MAX)).toBe('Nghiêm trọng');
  });

  it('trả về "Nghiêm trọng" khi vượt min đúng 2°C (-22)', () => {
    expect(trangThaiNhietDo(-22, MIN, MAX)).toBe('Nghiêm trọng');
  });

  it('trả về "Nghiêm trọng" khi vượt rất lớn (-30)', () => {
    expect(trangThaiNhietDo(-30, MIN, MAX)).toBe('Nghiêm trọng');
  });

  it('trả về "Nghiêm trọng" khi vượt rất lớn phía nóng (0)', () => {
    expect(trangThaiNhietDo(0, MIN, MAX)).toBe('Nghiêm trọng');
  });
});

describe('datChuan', () => {
  // ── Đạt chuẩn ────────────────────────────────────────────────
  it('trả về "Đạt chuẩn" và chenhLech=0 khi đúng bằng min (-20)', () => {
    const r = datChuan(-20, MIN, MAX);
    expect(r.ketQua).toBe('Đạt chuẩn');
    expect(r.chenhLech).toBe(0);
  });

  it('trả về "Đạt chuẩn" khi đúng bằng max (-18)', () => {
    const r = datChuan(-18, MIN, MAX);
    expect(r.ketQua).toBe('Đạt chuẩn');
    expect(r.chenhLech).toBe(0);
  });

  it('trả về "Đạt chuẩn" khi nằm chính giữa (-19.2 — ví dụ mẫu RULES.md mục 10)', () => {
    const r = datChuan(-19.2, MIN, MAX);
    expect(r.ketQua).toBe('Đạt chuẩn');
    expect(r.chenhLech).toBe(0);
  });

  // ── Không đạt ─────────────────────────────────────────────────
  it('trả về "Không đạt" và chenhLech=0.1 khi lệch max 0.1°C (-17.9)', () => {
    const r = datChuan(-17.9, MIN, MAX);
    expect(r.ketQua).toBe('Không đạt');
    expect(r.chenhLech).toBeCloseTo(0.1, 5);
  });

  it('trả về "Không đạt" khi lệch min 0.1°C (-20.1)', () => {
    const r = datChuan(-20.1, MIN, MAX);
    expect(r.ketQua).toBe('Không đạt');
    expect(r.chenhLech).toBeCloseTo(0.1, 5);
  });

  it('trả về "Không đạt" và chenhLech=1 khi lệch max 1°C (-17)', () => {
    const r = datChuan(-17, MIN, MAX);
    expect(r.ketQua).toBe('Không đạt');
    expect(r.chenhLech).toBe(1);
  });

  it('trả về "Không đạt" và chenhLech=1 khi lệch min 1°C (-21)', () => {
    const r = datChuan(-21, MIN, MAX);
    expect(r.ketQua).toBe('Không đạt');
    expect(r.chenhLech).toBe(1);
  });

  it('trả về "Không đạt" và chenhLech=2 khi lệch max 2°C (-16)', () => {
    const r = datChuan(-16, MIN, MAX);
    expect(r.ketQua).toBe('Không đạt');
    expect(r.chenhLech).toBe(2);
  });

  it('trả về "Không đạt" và chenhLech=2 khi lệch min 2°C (-22)', () => {
    const r = datChuan(-22, MIN, MAX);
    expect(r.ketQua).toBe('Không đạt');
    expect(r.chenhLech).toBe(2);
  });

  it('trả về "Không đạt" với chenhLech lớn khi vượt xa', () => {
    const r = datChuan(-30, MIN, MAX);
    expect(r.ketQua).toBe('Không đạt');
    expect(r.chenhLech).toBe(10);
  });
});
