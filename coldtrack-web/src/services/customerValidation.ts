import { rangeVi } from './adminTypes';
import type { CustomerConfig, ShipmentForm } from './customerTypes';
export function validateShipmentForm(input: ShipmentForm, config: CustomerConfig, now: string) {
  const errors: Record<string, string> = {};
  if (!config.locations.some(item => item.id === input.pickup)) errors.pickup = 'Vui lòng chọn điểm lấy hàng.';
  if (!config.locations.some(item => item.id === input.delivery)) errors.delivery = 'Vui lòng chọn điểm giao hàng.';
  else if (input.pickup === input.delivery) errors.delivery = 'Điểm giao phải khác điểm lấy hàng.';
  if (!config.products.some(item => item.id === input.product)) errors.product = 'Vui lòng chọn loại hàng hóa.';
  const weight = Number(input.weight); if (!input.weight.trim() || !Number.isFinite(weight) || weight <= 0 || weight > config.maxWeightKg) errors.weight = `Khối lượng phải lớn hơn 0 và không vượt quá ${new Intl.NumberFormat('vi-VN').format(config.maxWeightKg)} kg.`;
  if (!config.packaging.includes(input.packaging)) errors.packaging = 'Vui lòng chọn quy cách đóng gói.';
  const target = Number(input.target), tolerance = Number(input.tolerance);
  if (!input.target.trim() || !Number.isFinite(target) || target < config.temperature.min || target > config.temperature.max) errors.target = `Nhiệt độ mục tiêu phải nằm trong khoảng ${rangeVi(config.temperature.min, config.temperature.max)}.`;
  if (!input.tolerance.trim() || !Number.isFinite(tolerance) || tolerance <= 0) errors.tolerance = 'Dung sai phải là số dương.';
  else if (!errors.target && (target - tolerance < config.temperature.min || target + tolerance > config.temperature.max)) errors.tolerance = `Dải nhiệt mục tiêu ± dung sai phải nằm trong khoảng ${rangeVi(config.temperature.min, config.temperature.max)}.`;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.date)) errors.date = 'Vui lòng chọn ngày khởi hành.';
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(input.time)) errors.time = 'Vui lòng chọn giờ khởi hành hợp lệ.';
  if (!errors.date && !errors.time) {
    const parsed = new Date(`${input.date}T${input.time}:00${config.timeZoneOffset}`);
    const actualDate = !Number.isFinite(parsed.getTime()) ? '' : new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh', year: 'numeric', month: '2-digit', day: '2-digit' }).format(parsed);
    if (!Number.isFinite(parsed.getTime()) || actualDate !== input.date) errors.date = 'Ngày khởi hành không hợp lệ.';
    else if (parsed.getTime() < new Date(now).getTime()) errors.date = 'Thời gian khởi hành không được ở quá khứ.';
  }
  if (input.notes.length > config.maxNotesLength) errors.notes = `Ghi chú không được vượt quá ${config.maxNotesLength} ký tự.`;
  return errors;
}
export function productDefaults(id: string, config: CustomerConfig) {
  const product = config.products.find(item => item.id === id);
  return { target: product ? String(product.target) : '', tolerance: product ? String(product.tolerance) : '' };
}

