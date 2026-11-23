/**
 * src/mock/data.ts
 * Nguồn dữ liệu mock duy nhất cho toàn bộ hệ thống ColdTrack Web.
 * Toàn bộ số liệu khớp tuyệt đối với RULES.md mục 10.
 *
 * Mốc thời gian mock: 30/10/2026, 14:32.
 */

import type {
  NguoiDung,
  LoHang,
  Xe,
  CanhBao,
  ChuyenLichSu,
  NhatKyHoatDong,
} from './types';

export const THOI_GIAN_MOCK_HIEN_TAI = '2026-10-30T14:32:00';
export const THOI_GIAN_HIEN_THI = '30/10/2026, 14:32';

/**
 * 2. Vai trò và tài khoản mock (RULES.md mục 2)
 */
export const MOCK_USERS: Record<string, NguoiDung> = {
  admin: {
    id: 'usr-admin-01',
    ten: 'Thái Bảo Khang',
    email: 'khang.thai@coldtrack.vn',
    vaiTro: 'dieu-phoi',
    nhanHienThi: 'Quản trị viên Hub',
    donVi: 'Trung tâm Điều phối ColdTrack',
    soDienThoai: '0908 112 233',
  },
  khachHang: {
    id: 'usr-khach-01',
    ten: 'Nguyễn Văn An',
    email: 'an.nguyen@megafood.vn',
    vaiTro: 'khach-hang',
    nhanHienThi: 'Khách hàng, Công ty TNHH Thực phẩm Mega',
    donVi: 'Công ty TNHH Thực phẩm Mega',
    soDienThoai: '0912 345 678',
  },
  taiXe: {
    id: 'usr-taixe-01',
    ten: 'Trần Minh Khoa',
    email: 'khoa.tran@coldtrack.vn',
    vaiTro: 'tai-xe',
    nhanHienThi: 'Tài xế',
    donVi: 'Đội xe Hub Miền Nam',
    soDienThoai: '0987 654 321',
  },
};

/**
 * 5. Cảnh báo (RULES.md mục 5 & mục 10)
 * Tổng đang mở: 4 (1 Nghiêm trọng + 2 Cảnh báo + 1 Thông tin)
 * Badge hiển thị = 3 (1 Nghiêm trọng + 2 Cảnh báo)
 * Chuyến CT-2026-0156 có cảnh báo riêng.
 */
export const MOCK_CANH_BAO: CanhBao[] = [
  {
    id: 'CB-2026-001',
    maLo: 'CT-2026-0156',
    thoiGian: '30/10/2026 14:15',
    mucDo: 'Nghiêm trọng',
    tieuDe: 'Vượt ngưỡng nhiệt độ cho phép',
    noiDung: 'Nhiệt độ khoang lạnh đạt -15.8°C (vượt biên max -18°C trên 2°C)',
    nhietDoLucBao: -15.8,
    daXuLy: false,
  },
  {
    id: 'CB-2026-002',
    maLo: 'CT-2026-0148',
    thoiGian: '30/10/2026 13:50',
    mucDo: 'Cảnh báo',
    tieuDe: 'Tiến sát ngưỡng trên',
    noiDung: 'Nhiệt độ tăng lên -17.8°C, cách biên -18°C dưới 1°C',
    nhietDoLucBao: -17.8,
    daXuLy: false,
  },
  {
    id: 'CB-2026-003',
    maLo: 'CT-2026-0152',
    thoiGian: '30/10/2026 13:30',
    mucDo: 'Cảnh báo',
    tieuDe: 'Mất tín hiệu cảm biến phụ',
    noiDung: 'Cảm biến phụ vùng cửa khoang xe 51D-892.41 không phản hồi',
    nhietDoLucBao: -18.6,
    daXuLy: false,
  },
  {
    id: 'CB-2026-004',
    maLo: 'CT-2026-0160',
    thoiGian: '30/10/2026 14:05',
    mucDo: 'Thông tin',
    tieuDe: 'Cửa thùng xe mở quá 3 phút',
    noiDung: 'Ghi nhận mở cửa dỡ hàng tại điểm trả hàng phụ',
    nhietDoLucBao: -18.2,
    daXuLy: false,
  },
  // Đã xử lý (lịch sử cảnh báo)
  {
    id: 'CB-2026-005',
    maLo: 'CT-2026-0130',
    thoiGian: '30/10/2026 10:20',
    mucDo: 'Cảnh báo',
    tieuDe: 'Tiến sát ngưỡng dưới',
    noiDung: 'Nhiệt độ giảm xuống -20.8°C',
    nhietDoLucBao: -20.8,
    daXuLy: true,
    ghiChuXuLy: 'Tài xế đã điều chỉnh quạt gió, nhiệt độ ổn định trở lại.',
    nguoiXuLy: 'Thái Bảo Khang',
    thoiGianXuLy: '30/10/2026 10:35',
  },
];

/**
 * 10. Xe (RULES.md mục 10)
 * Tổng số xe = 32
 * - Đang hoạt động = 24
 * - Rảnh = 3
 * - Đang bảo trì = 3
 * - Mất kết nối = 2
 */
export const MOCK_XE: Xe[] = [
  // 24 xe Đang hoạt động
  ...Array.from({ length: 24 }).map((_, i) => {
    const num = (i + 1).toString().padStart(2, '0');
    return {
      id: `xe-${num}`,
      bienSo: `51D-${800 + i}.${10 + i}`,
      loaiXe: i % 2 === 0 ? 'Xe đông lạnh 2.5 tấn' : 'Xe đông lạnh 5 tấn',
      taiTrongKg: i % 2 === 0 ? 2500 : 5000,
      trangThai: 'Đang hoạt động' as const,
      nhietDoThung: i === 0 ? -15.8 : -19.2 + ((i % 5) - 2) * 0.2,
      nhietDoMinHoTro: -25,
      nhietDoMaxHoTro: -15,
      viTriHienTai: i === 0 ? 'QL1A, Đồng Nai' : `Tuyến Quốc lộ 1A - Trạm ${i + 1}`,
      taiXeHienTai: i === 0 ? 'Trần Minh Khoa' : `Tài xế Đội ${((i % 4) + 1)}`,
      maThietBi: `TB-${8900 + i}`,
      capNhatLuc: '14:32',
    };
  }),

  // 3 xe Rảnh
  {
    id: 'xe-ranh-01',
    bienSo: '51D-950.01',
    loaiXe: 'Xe đông lạnh 2.5 tấn',
    taiTrongKg: 2500,
    trangThai: 'Rảnh',
    nhietDoThung: -20.0,
    nhietDoMinHoTro: -25,
    nhietDoMaxHoTro: -15,
    viTriHienTai: 'Hub Trung tâm TP.HCM',
    maThietBi: 'TB-9501',
    capNhatLuc: '14:30',
  },
  {
    id: 'xe-ranh-02',
    bienSo: '51D-950.02',
    loaiXe: 'Xe đông lạnh 3.5 tấn',
    taiTrongKg: 3500,
    trangThai: 'Rảnh',
    nhietDoThung: -19.5,
    nhietDoMinHoTro: -25,
    nhietDoMaxHoTro: -15,
    viTriHienTai: 'Hub Bình Dương',
    maThietBi: 'TB-9502',
    capNhatLuc: '14:28',
  },
  {
    id: 'xe-ranh-03',
    bienSo: '51D-950.03',
    loaiXe: 'Xe đông lạnh 5 tấn',
    taiTrongKg: 5000,
    trangThai: 'Rảnh',
    nhietDoThung: -18.8,
    nhietDoMinHoTro: -25,
    nhietDoMaxHoTro: -15,
    viTriHienTai: 'Hub Đồng Nai',
    maThietBi: 'TB-9503',
    capNhatLuc: '14:25',
  },

  // 3 xe Đang bảo trì
  {
    id: 'xe-bt-01',
    bienSo: '51D-710.11',
    loaiXe: 'Xe đông lạnh 2.5 tấn',
    taiTrongKg: 2500,
    trangThai: 'Đang bảo trì',
    nhietDoMinHoTro: -25,
    nhietDoMaxHoTro: -15,
    viTriHienTai: 'Xưởng dịch vụ Hub TP.HCM',
    maThietBi: 'TB-7111',
    capNhatLuc: '10:15',
  },
  {
    id: 'xe-bt-02',
    bienSo: '51D-710.22',
    loaiXe: 'Xe đông lạnh 3.5 tấn',
    taiTrongKg: 3500,
    trangThai: 'Đang bảo trì',
    nhietDoMinHoTro: -25,
    nhietDoMaxHoTro: -15,
    viTriHienTai: 'Xưởng dịch vụ Hub Bình Dương',
    maThietBi: 'TB-7122',
    capNhatLuc: '09:40',
  },
  {
    id: 'xe-bt-03',
    bienSo: '51D-710.33',
    loaiXe: 'Xe đông lạnh 5 tấn',
    taiTrongKg: 5000,
    trangThai: 'Đang bảo trì',
    nhietDoMinHoTro: -25,
    nhietDoMaxHoTro: -15,
    viTriHienTai: 'Xưởng dịch vụ Hub Đồng Nai',
    maThietBi: 'TB-7133',
    capNhatLuc: '08:00',
  },

  // 2 xe Mất kết nối
  {
    id: 'xe-mkn-01',
    bienSo: '51D-660.01',
    loaiXe: 'Xe đông lạnh 2.5 tấn',
    taiTrongKg: 2500,
    trangThai: 'Mất kết nối',
    nhietDoMinHoTro: -25,
    nhietDoMaxHoTro: -15,
    viTriHienTai: 'Hầm đường bộ đèo Cù Mông',
    maThietBi: 'TB-6601',
    capNhatLuc: '13:45',
  },
  {
    id: 'xe-mkn-02',
    bienSo: '51D-660.02',
    loaiXe: 'Xe đông lạnh 5 tấn',
    taiTrongKg: 5000,
    trangThai: 'Mất kết nối',
    nhietDoMinHoTro: -25,
    nhietDoMaxHoTro: -15,
    viTriHienTai: 'Khu vực đèo Hải Vân',
    maThietBi: 'TB-6602',
    capNhatLuc: '13:10',
  },
];

/**
 * Danh sách sản phẩm thực phẩm đông lạnh hợp lệ (RULES.md mục 11)
 */
const SAN_PHAM_DONG_LANH = [
  'Thịt bò đông lạnh',
  'Hải sản đông lạnh',
  'Kem cao cấp',
  'Rau củ đông lạnh',
  'Thực phẩm đông lạnh xuất khẩu',
  'Tôm đông lạnh',
  'Cá hồi fillet đông lạnh',
];

/**
 * 10. Lô hàng (RULES.md mục 10)
 * - Đang vận chuyển = 24
 * - Chờ xuất phát = 8
 * - Hoàn thành hôm nay = 17
 * - Tab "Tất cả" = 49 (24 + 8 + 17)
 */
export const MOCK_LO_HANG: LoHang[] = [
  // ── 24 Lô đang vận chuyển ────────────────────────────────────
  // Chuyến mẫu đặc biệt: CT-2026-0156 (xe của Trần Minh Khoa, có cảnh báo riêng)
  {
    ma: 'CT-2026-0156',
    tenHang: 'Thịt bò đông lạnh Úc',
    soThung: 120,
    khoiLuongKg: 2400,
    diemLay: 'Kho lạnh Tân Tạo, Bình Tân, TP.HCM',
    diemGiao: 'Siêu thị Mega Mall, Biên Hòa, Đồng Nai',
    thoiGianKhoiHanh: '30/10/2026 12:30',
    thoiGianDuKienGiao: '30/10/2026 16:00',
    trangThai: 'Đang vận chuyển',
    daiNhietMin: -20,
    daiNhietMax: -18,
    nhietDoHienTai: -15.8, // Đang vượt ngưỡng / Nghiêm trọng
    maXe: '51D-800.10',
    maTaiXe: 'usr-taixe-01',
    tenTaiXe: 'Trần Minh Khoa',
    soDienThoaiTaiXe: '0987 654 321',
    maThietBi: 'TB-8900',
    khachHangId: 'usr-khach-01',
    tenKhachHang: 'Công ty TNHH Thực phẩm Mega',
    ghiChu: 'Cần giữ nhiệt độ ổn định, kiểm tra cảm biến khoang giữa.',
  },
  // Chuyến CT-2026-0148 (có cảnh báo riêng, không trùng CT-2026-0156)
  {
    ma: 'CT-2026-0148',
    tenHang: 'Hải sản đông lạnh Kiên Giang',
    soThung: 80,
    khoiLuongKg: 1800,
    diemLay: 'Cảng cá Rạch Giá, Kiên Giang',
    diemGiao: 'Kho tổng Thực phẩm An Gia, Cần Thơ',
    thoiGianKhoiHanh: '30/10/2026 11:00',
    thoiGianDuKienGiao: '30/10/2026 15:30',
    trangThai: 'Đang vận chuyển',
    daiNhietMin: -20,
    daiNhietMax: -18,
    nhietDoHienTai: -17.8,
    maXe: '51D-801.11',
    maTaiXe: 'usr-taixe-02',
    tenTaiXe: 'Lê Hoàng Nam',
    soDienThoaiTaiXe: '0933 222 111',
    maThietBi: 'TB-8901',
    khachHangId: 'usr-khach-02',
    tenKhachHang: 'Công ty TNHH Hải Sản Biển Nam',
  },
  // 22 lô hàng đang vận chuyển còn lại (tổng = 24)
  ...Array.from({ length: 22 }).map((_, i) => {
    const idx = i + 3;
    const ma = `CT-2026-${(156 + idx).toString().padStart(4, '0')}`;
    const sanPham = SAN_PHAM_DONG_LANH[i % SAN_PHAM_DONG_LANH.length];
    const xe = MOCK_XE[i + 2];
    return {
      ma,
      tenHang: sanPham,
      soThung: 50 + (i * 5),
      khoiLuongKg: 1200 + (i * 100),
      diemLay: `Kho lạnh Trung tâm ${((i % 3) + 1)}`,
      diemGiao: `Chuỗi siêu thị thực phẩm Mega - Chi nhánh ${i + 1}`,
      thoiGianKhoiHanh: '30/10/2026 10:00',
      thoiGianDuKienGiao: '30/10/2026 17:00',
      trangThai: 'Đang vận chuyển' as const,
      daiNhietMin: -20,
      daiNhietMax: -18,
      nhietDoHienTai: -19.2 + ((i % 4) - 1.5) * 0.3,
      maXe: xe?.bienSo || `51D-80${idx}.00`,
      maTaiXe: `usr-taixe-${idx}`,
      tenTaiXe: `Tài xế Đội ${((i % 5) + 1)}`,
      soDienThoaiTaiXe: `0909 ${100 + i} ${200 + i}`,
      maThietBi: xe?.maThietBi || `TB-${8910 + i}`,
      khachHangId: i % 2 === 0 ? 'usr-khach-01' : 'usr-khach-02',
      tenKhachHang: i % 2 === 0 ? 'Công ty TNHH Thực phẩm Mega' : 'Công ty Thực phẩm Đông Lạnh Á Châu',
    };
  }),

  // ── 8 Lô chờ xuất phát ───────────────────────────────────────
  ...Array.from({ length: 8 }).map((_, i) => {
    const ma = `CT-2026-${(201 + i).toString().padStart(4, '0')}`;
    const sanPham = SAN_PHAM_DONG_LANH[(i + 2) % SAN_PHAM_DONG_LANH.length];
    return {
      ma,
      tenHang: sanPham,
      soThung: 60 + i * 10,
      khoiLuongKg: 1500 + i * 150,
      diemLay: 'Kho lạnh KCN Sóng Thần 1, Dĩ An, Bình Dương',
      diemGiao: `Kho phân phối Thực phẩm Miền Tây ${i + 1}`,
      thoiGianKhoiHanh: '30/10/2026 16:00',
      thoiGianDuKienGiao: '30/10/2026 21:00',
      trangThai: 'Chờ xuất phát' as const,
      daiNhietMin: -20,
      daiNhietMax: -18,
      khachHangId: 'usr-khach-01',
      tenKhachHang: 'Công ty TNHH Thực phẩm Mega',
    };
  }),

  // ── 17 Lô hoàn thành hôm nay ─────────────────────────────────
  ...Array.from({ length: 17 }).map((_, i) => {
    const ma = `CT-2026-${(101 + i).toString().padStart(4, '0')}`;
    const sanPham = SAN_PHAM_DONG_LANH[(i + 4) % SAN_PHAM_DONG_LANH.length];
    const isDat = i !== 3; // Lô i=3 là Không đạt mẫu để kiểm thử theo RULES.md mục 10
    return {
      ma,
      tenHang: sanPham,
      soThung: 70 + i * 8,
      khoiLuongKg: 1600 + i * 120,
      diemLay: 'Hub Kho lạnh Cát Lái, TP.HCM',
      diemGiao: `Trung tâm Phân phối Bách Hóa ${i + 1}, Bình Dương`,
      thoiGianKhoiHanh: '30/10/2026 06:00',
      thoiGianDuKienGiao: '30/10/2026 11:30',
      thoiGianHoanThanh: '30/10/2026 11:20',
      trangThai: 'Hoàn thành' as const,
      daiNhietMin: -20,
      daiNhietMax: -18,
      nhietDoKetThuc: isDat ? -19.2 : -17.3,
      ketQuaChuyen: isDat ? ('Đúng nhiệt độ' as const) : ('Có cảnh báo' as const),
      khachHangId: 'usr-khach-01',
      tenKhachHang: 'Công ty TNHH Thực phẩm Mega',
    };
  }),
];

/**
 * 10. Lịch sử chuyến (RULES.md mục 10)
 * 24 chuyến, 21 đúng nhiệt độ, 3 có cảnh báo, tỷ lệ 87.5% (21/24)
 * Mốc năm 2026.
 */
export const MOCK_LICH_SU: ChuyenLichSu[] = Array.from({ length: 24 }).map((_, i) => {
  const ma = `CT-2026-${(301 + i).toString().padStart(4, '0')}`;
  // 3 chuyến có cảnh báo: chuyến index 4, 11, 19
  const coCanhBao = i === 4 || i === 11 || i === 19;
  const ketQua = coCanhBao ? 'Có cảnh báo' : 'Đúng nhiệt độ';
  // Chuyến hoàn thành mẫu mục 10: -19.2°C (Đạt chuẩn)
  // Nếu có cảnh báo: nhiệt độ kết thúc -17.5°C (Không đạt)
  const nhietDoKetThuc = coCanhBao ? -17.5 : -19.2;
  const trangThaiDatChuan = coCanhBao ? 'Không đạt' : 'Đạt chuẩn';

  return {
    ma,
    ngayChay: `2026-10-${(20 + (i % 10)).toString().padStart(2, '0')}`,
    tenHang: SAN_PHAM_DONG_LANH[i % SAN_PHAM_DONG_LANH.length],
    tuyenDuong: `TP.HCM - Trạm Vận chuyển ${i + 1}`,
    xeBienSo: `51D-8${(10 + i).toString().padStart(2, '0')}.22`,
    taiXeTen: i === 0 ? 'Trần Minh Khoa' : `Tài xế Đội ${((i % 4) + 1)}`,
    khachHangTen: 'Công ty TNHH Thực phẩm Mega',
    daiNhiet: '-20°C đến -18°C',
    ketQua,
    nhietDoKetThuc,
    trangThaiDatChuan,
    soLanCanhBao: coCanhBao ? (i === 4 ? 2 : 1) : 0,
  };
});

/**
 * Thống kê hoạt động khớp chính xác với RULES.md mục 10
 */
export const MOCK_THONG_KE = {
  // Lô hàng
  loHangDangVanChuyen: 24,
  loHangChoXuatPhat: 8,
  loHangHoanThanhHomNay: 17,
  loHangTatCa: 49,

  // Xe
  xeTong: 32,
  xeDangHoatDong: 24,
  xeRanh: 3,
  xeBaoTri: 3,
  xeMatKetNoi: 2,

  // Cảnh báo
  canhBaoDangMo: 4,
  canhBaoNghiemTrong: 1,
  canhBaoCanhBao: 2,
  canhBaoThongTin: 1,
  canhBaoBadgeMenu: 3, // 1 Nghiêm trọng + 2 Cảnh báo

  // Lịch sử
  lichSuTong: 24,
  lichSuDungNhietDo: 21,
  lichSuCoCanhBao: 3,
  tyLeDungNhietDo: '87.5%',
};

/**
 * Nhật ký hoạt động (RULES.md mục 3, 10, 13)
 */
export const MOCK_NHAT_KY: NhatKyHoatDong[] = [
  {
    id: 'NK-01',
    thoiGian: '30/10/2026 14:15',
    nguoiThucHien: 'Hệ thống Cảm biến',
    vaiTro: 'Hệ thống',
    hanhDong: 'Phát hiện cảnh báo nhiệt độ',
    chiTiet: 'Lô hàng CT-2026-0156 nhiệt độ tăng lên -15.8°C, vượt biên trên dải bảo quản cho phép.',
  },
  {
    id: 'NK-02',
    thoiGian: '30/10/2026 13:50',
    nguoiThucHien: 'Thái Bảo Khang',
    vaiTro: 'Quản trị viên Hub',
    hanhDong: 'Duyệt & phân công chuyến',
    chiTiet: 'Phân công xe 51D-800.10 và tài xế Trần Minh Khoa phụ trách lô hàng CT-2026-0156.',
  },
  {
    id: 'NK-03',
    thoiGian: '30/10/2026 12:45',
    nguoiThucHien: 'Trần Minh Khoa',
    vaiTro: 'Tài xế',
    hanhDong: 'Bắt đầu hành trình',
    chiTiet: 'Xe 51D-800.10 xuất phát từ Kho lạnh Tân Tạo hướng về Biên Hòa, Đồng Nai.',
  },
  {
    id: 'NK-04',
    thoiGian: '30/10/2026 11:30',
    nguoiThucHien: 'Nguyễn Văn An',
    vaiTro: 'Khách hàng',
    hanhDong: 'Gửi yêu cầu tạo lô hàng',
    chiTiet: 'Tạo thành công yêu cầu vận chuyển thịt bò đông lạnh 2.4 tấn, dải nhiệt -20°C đến -18°C.',
  },
  {
    id: 'NK-05',
    thoiGian: '30/10/2026 10:35',
    nguoiThucHien: 'Thái Bảo Khang',
    vaiTro: 'Quản trị viên Hub',
    hanhDong: 'Xử lý cảnh báo',
    chiTiet: 'Đánh dấu đã xử lý cảnh báo CB-2026-005 cho lô CT-2026-0130 kèm xác nhận tài xế đã chỉnh quạt gió.',
  },
];
