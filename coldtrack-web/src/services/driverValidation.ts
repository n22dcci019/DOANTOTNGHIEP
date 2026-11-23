import { rangeVi } from './adminTypes';
import type { DriverConfig, AdjustmentInput, IncidentInput } from './driverTypes';
export function validateDriverAdjustment(input: AdjustmentInput, config: DriverConfig) {
  const errors: Record<string, string> = {}; const min = Number(input.min), max = Number(input.max);
  if (!input.min.trim() || !Number.isFinite(min) || min < config.temperature.min || min > config.temperature.max) errors.min = `Nhiệt độ phải nằm trong khoảng ${rangeVi(config.temperature.min, config.temperature.max)}.`;
  if (!input.max.trim() || !Number.isFinite(max) || max < config.temperature.min || max > config.temperature.max) errors.max = `Nhiệt độ phải nằm trong khoảng ${rangeVi(config.temperature.min, config.temperature.max)}.`;
  if (!errors.min && !errors.max && min >= max) errors.max = 'Nhiệt độ tối thiểu phải nhỏ hơn tối đa.';
  if (!input.reason.trim()) errors.reason = 'Vui lòng nhập lý do thay đổi.';
  else if (input.reason.length > config.maxNotesLength) errors.reason = `Lý do không được vượt quá ${config.maxNotesLength} ký tự.`;
  return errors;
}
export function validateDriverIncident(input: IncidentInput, config: DriverConfig) { const errors: Record<string, string> = {}; if (!config.incidentTypes.some(item => item.id === input.type)) errors.type = 'Vui lòng chọn loại sự cố.'; if (!input.description.trim()) errors.description = 'Vui lòng mô tả sự cố.'; else if (input.description.length > config.maxNotesLength) errors.description = `Mô tả không được vượt quá ${config.maxNotesLength} ký tự.`; return errors; }
