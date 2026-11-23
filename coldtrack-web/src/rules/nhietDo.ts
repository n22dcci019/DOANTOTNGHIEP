/**
 * src/rules/nhietDo.ts
 * Các hàm thuần túy tính trạng thái nhiệt độ và kết quả chặng.
 * Nguồn quy tắc: RULES.md mục 4.
 * Không phụ thuộc giao diện.
 */

export type TrangThaiNhietDo =
  | 'Trong ngưỡng'
  | 'Tiến sát ngưỡng'
  | 'Vượt ngưỡng'
  | 'Nghiêm trọng';

export interface KetQuaDatChuan {
  ketQua: 'Đạt chuẩn' | 'Không đạt';
  chenhLech: number; // 0 nếu đạt, > 0 nếu không đạt (khoảng cách tới biên gần nhất)
}

/**
 * Tính trạng thái nhiệt độ so với dải [min, max].
 *
 * Điều kiện theo RULES.md mục 4:
 * - Trong ngưỡng:   nhietDo ∈ [min, max] VÀ cách cả hai biên ≥ 1°C
 *                   tức min + 1 ≤ nhietDo ≤ max - 1
 * - Tiến sát ngưỡng: nhietDo ∈ [min, max] VÀ cách ít nhất một biên < 1°C
 *                   tức nhietDo < min + 1 hoặc nhietDo > max - 1
 * - Vượt ngưỡng:   nhietDo ∉ [min, max] VÀ vượt biên < 2°C
 *                   tức nhietDo ∈ (max, max+2) hoặc nhietDo ∈ (min-2, min)
 * - Nghiêm trọng:  nhietDo ∉ [min, max] VÀ vượt biên ≥ 2°C
 */
export function trangThaiNhietDo(
  nhietDo: number,
  min: number,
  max: number
): TrangThaiNhietDo {
  if (nhietDo >= min && nhietDo <= max) {
    // Trong dải — kiểm tra khoảng cách tới biên
    const cachBienGan = Math.min(nhietDo - min, max - nhietDo);
    if (cachBienGan >= 1) {
      return 'Trong ngưỡng';
    } else {
      return 'Tiến sát ngưỡng';
    }
  } else {
    // Ngoài dải — tính khoảng vượt biên
    const vuotBien = nhietDo < min ? min - nhietDo : nhietDo - max;
    if (vuotBien < 2) {
      return 'Vượt ngưỡng';
    } else {
      return 'Nghiêm trọng';
    }
  }
}

/**
 * Tính kết quả hoàn thành chặng.
 * - Đạt chuẩn: nhietDoKetThuc ∈ [min, max]
 * - Không đạt: ngoài dải, chenhLech = khoảng cách tới biên gần nhất
 */
export function datChuan(
  nhietDoKetThuc: number,
  min: number,
  max: number
): KetQuaDatChuan {
  if (nhietDoKetThuc >= min && nhietDoKetThuc <= max) {
    return { ketQua: 'Đạt chuẩn', chenhLech: 0 };
  }
  const chenhLech =
    nhietDoKetThuc < min
      ? min - nhietDoKetThuc
      : nhietDoKetThuc - max;
  return { ketQua: 'Không đạt', chenhLech: +chenhLech.toFixed(2) };
}
