import type { ProductPreset } from '../services/customerTypes';
import type { TemperatureConfig } from '../services/adminTypes';
import { customerMockConfig } from './customer';
export interface PublicMilestone { title: string; time: string; location: string; temperature?: number; done: boolean }
export interface PublicTracking { code: string; product: string; status: string; min: number; max: number; temperature: number; humidity: number; location: string; eta: string; origin: string; destination: string; milestones: PublicMilestone[] }
export interface Testimonial { id: string; title: string; quote: string; name: string; role: string; initials: string }
export const LANDING_MOCK_OPTIONS = { delayMs: 180, codeMaxLength: 40 };
export const LANDING_TESTIMONIALS: Testimonial[] = [
  { id: 'nam', title: 'Giảm hàng hỏng', quote: 'Từ khi dùng ColdTrack, chúng tôi nắm được nhiệt độ từng chuyến hàng và xử lý sự cố trước khi hàng bị hư.', name: 'Nguyễn Hoài Nam', role: 'Quản lý kho vận · Công ty thực phẩm (mẫu)', initials: 'HN' },
  { id: 'trang', title: 'Cảnh báo kịp thời', quote: 'Cảnh báo gửi đến ngay khi nhiệt độ sát ngưỡng, tài xế kịp thời xử lý trên đường.', name: 'Trần Thu Trang', role: 'Điều phối vận tải · Đơn vị vận chuyển (mẫu)', initials: 'TT' },
  { id: 'long', title: 'Truy vết dễ dàng', quote: 'Mỗi lô hàng đều có nhật ký nhiệt độ đầy đủ, việc kiểm tra chất lượng nhanh hơn rất nhiều.', name: 'Lê Hoàng Nam', role: 'Giám đốc vận hành · Chuỗi cửa hàng thực phẩm (mẫu)', initials: 'LN' },
];
export function landingMockPresets(temperature: TemperatureConfig, pageSize: number): ProductPreset[] { return customerMockConfig(temperature, pageSize).products; }
export function landingMockRecords(products: ProductPreset[]): PublicTracking[] {
  return [{ code: 'CT-2026-0901', productId: 'seafood', temperature: -20.4 }, { code: 'CT-2026-0902', productId: 'beef', temperature: -19 }].flatMap(sample => {
    const product = products.find(item => item.id === sample.productId); if (!product) return [];
    return [{ code: sample.code, product: product.label, status: 'Đang vận chuyển', min: product.target - product.tolerance, max: product.target + product.tolerance, temperature: sample.temperature, humidity: 58.2, location: 'Tân An, Long An', origin: 'TP.HCM', destination: 'Cần Thơ', eta: '2026-10-30T16:40:00+07:00', milestones: [
      { title: 'Đã nhận hàng', time: '2026-10-30T08:30:00+07:00', location: 'Kho lạnh TP.HCM', temperature: product.target, done: true },
      { title: 'Đang làm lạnh', time: '2026-10-30T09:00:00+07:00', location: 'Kho lạnh TP.HCM', temperature: product.target, done: true },
      { title: 'Đang vận chuyển', time: '2026-10-30T14:32:00+07:00', location: 'Tân An, Long An', temperature: sample.temperature, done: true },
      { title: 'Giao thành công', time: '2026-10-30T16:40:00+07:00', location: 'Điểm giao Cần Thơ (dự kiến)', done: false },
    ] }];
  });
}
