/**
 * src/mock/types.ts
 * Kiểu dữ liệu nghiệp vụ chuẩn xác theo RULES.md.
 */

export type VaiTro = 'dieu-phoi' | 'khach-hang' | 'tai-xe';

export interface NguoiDung {
  id: string;
  ten: string;
  email: string;
  vaiTro: VaiTro;
  nhanHienThi: string;
  donVi?: string;
  soDienThoai?: string;
  avatar?: string;
}

export type TrangThaiLoHang =
  | 'Chờ điều phối duyệt'
  | 'Chờ xuất phát'
  | 'Đang vận chuyển'
  | 'Hoàn thành'
  | 'Từ chối';

export type MucDoCanhBao = 'Nghiêm trọng' | 'Cảnh báo' | 'Thông tin';

export type TrangThaiXe =
  | 'Đang hoạt động'
  | 'Rảnh'
  | 'Đang bảo trì'
  | 'Mất kết nối';

export interface CanhBao {
  id: string;
  maLo: string;
  thoiGian: string; // ISO hoặc định dạng hiển thị
  mucDo: MucDoCanhBao;
  tieuDe: string;
  noiDung: string;
  nhietDoLucBao?: number;
  daXuLy: boolean;
  ghiChuXuLy?: string;
  nguoiXuLy?: string;
  thoiGianXuLy?: string;
}

export interface LoHang {
  ma: string; // Dạng CT-2026-XXXX
  tenHang: string; // Thực phẩm đông lạnh (Thịt bò, Hải sản, Kem,...)
  soThung: number;
  quyCachDongGoi?: string;
  nhietDoMucTieu?: number;
  dungSai?: number;
  khoiLuongKg: number;
  diemLay: string;
  diemGiao: string; // Đơn vị nhận và điểm giao là MỘT trường
  thoiGianKhoiHanh: string;
  thoiGianDuKienGiao?: string;
  thoiGianHoanThanh?: string;
  trangThai: TrangThaiLoHang;
  daiNhietMin: number; // Mặc định -20
  daiNhietMax: number; // Mặc định -18
  nhietDoHienTai?: number;
  maXe?: string; // Biển số xe hoặc mã xe
  maTaiXe?: string;
  tenTaiXe?: string;
  soDienThoaiTaiXe?: string;
  maThietBi?: string; // Dạng TB-xxxx
  khachHangId: string;
  tenKhachHang: string;
  ghiChu?: string;
  lyDoTuChoi?: string;
  ketQuaChuyen?: 'Đúng nhiệt độ' | 'Có cảnh báo' | 'Đạt chuẩn' | 'Không đạt';
  nhietDoKetThuc?: number;
}

export interface Xe {
  id: string;
  bienSo: string;
  loaiXe: string; // Tải trọng thùng lạnh
  taiTrongKg: number;
  trangThai: TrangThaiXe;
  nhietDoThung?: number;
  nhietDoMinHoTro: number; // Để kiểm tra xe có khả năng giữ dải yêu cầu không
  nhietDoMaxHoTro: number;
  viTriHienTai: string;
  taiXeHienTai?: string;
  maThietBi: string; // TB-xxxx
  capNhatLuc: string;
}

export interface ChuyenLichSu {
  ma: string; // CT-2026-XXXX
  ngayChay: string;
  tenHang: string;
  tuyenDuong: string;
  xeBienSo: string;
  taiXeTen: string;
  khachHangTen: string;
  daiNhiet: string; // ví dụ: -20°C đến -18°C
  ketQua: 'Đúng nhiệt độ' | 'Có cảnh báo';
  nhietDoKetThuc: number;
  trangThaiDatChuan: 'Đạt chuẩn' | 'Không đạt';
  soLanCanhBao: number;
}

export interface NhatKyHoatDong {
  id: string;
  thoiGian: string;
  nguoiThucHien: string;
  vaiTro: string;
  hanhDong: string;
  chiTiet: string; // Cột chi tiết tự xuống dòng, không chồng chữ
}

