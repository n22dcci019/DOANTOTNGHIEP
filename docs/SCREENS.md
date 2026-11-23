# ColdTrack Web: Ánh xạ màn hình Stitch

Dự án Stitch: **Cold Chain Logistics Portal** (ID 18073025285101425800)

Mỗi màn chỉ có một route và một vai trò. Màn nào không có trong bảng này thì không code, trừ khi được xác nhận.

## Xác thực (không cần vai trò)
| Tên màn (đặt lại trên Stitch) | Stitch ID | Route | Ghi chú |
|---|---|---|---|
| AUTH-DangNhap | 1a5e4999162f4006b82cca389a7b9128 | /login | Có nút Google SSO, form email và mật khẩu |
| AUTH-QuenMatKhau | ec8d49d0d5dd4724b1ad52a3d3676dc2 | /forgot-password | Form nhập email gửi liên kết đặt lại mật khẩu |
| AUTH-LienKetHetHan | eca728d4496f44e480671924ede1e71b | /reset/expired | Thông báo liên kết hết hạn hoặc không hợp lệ |
| AUTH-DatLaiMatKhau | 46be44938f694d4c91396e2d6f45a716 | /reset | Đặt lại mật khẩu mới; kèm trạng thái lỗi không khớp (Stitch ID: 67f5a561150c483eb7aa8df945102a00) |
| AUTH-DatLaiThanhCong | 2fb8082dc3bb477eb60888019f069946 | /reset/success | Thông báo đặt lại mật khẩu thành công |
| AUTH-DangKy | 222b6b6b3d6f48308fbfe531cb5cc7ed | /register | Đăng ký tài khoản khách hàng mới |

## Khách hàng
*Khách hàng không có màn Tổng quan. Sau khi đăng nhập, route mặc định vào thẳng `/kh/lo-hang`.*

| Tên màn | Stitch ID | Route | Ghi chú |
|---|---|---|---|
| KH-LoHangCuaToi | Dùng lại AD-LoHang | /kh/lo-hang | Route mặc định của Khách hàng sau đăng nhập. Dùng lại bố cục từ màn điều phối, ẩn cột và dữ liệu nội bộ theo RULES.md mục 3. Không hiển thị dữ liệu xe, tài xế nội bộ cho khách |
| KH-TaoLoHang | 66d9ddfaabd14c41a4759daa3691872c | /kh/tao-lo-hang | Form 4 phần: hành trình, hàng hóa và quy chuẩn, mục tiêu ± dung sai và thời gian, ghi chú; tính dải từ cấu hình |
| KH-XemLaiNhap | db3d8a811b9540ce95004dbc154382f5 | /kh/tao-lo-hang/xem-lai | Drawer xem lại, dùng sau khi bấm Lưu nháp |
| KH-DaGuiYeuCau | 424319a697cd42ceae28c0cf6c813ffe | /kh/lo-hang/:ma/da-gui | B3 hiển thị thông báo thành công và chuyển về /kh/lo-hang theo yêu cầu mới. Route cũ chuyển về danh sách, không tự tạo thông báo thành công |
| KH-LichSu | Dùng lại AD-LichSu | /kh/lich-su | Dùng lại bố cục từ màn điều phối, ẩn cột và dữ liệu nội bộ theo RULES.md mục 3. Không hiển thị dữ liệu xe, tài xế nội bộ cho khách |
| KH-CaiDat | c1c96e7555334984bfe4924577fb60dc | /kh/cai-dat | Tab Tài khoản và Thông báo (SMS tắt: a8bf004c1a6747c3b71926513dbb4d2d; Lưu thành công: da95d13832404000aa54307119929a15). Không có tab Ngưỡng hệ thống |

## Điều phối (Admin)
| Tên màn | Stitch ID | Route | Ghi chú |
|---|---|---|---|
| AD-TongQuan | ab273ed2e9fe49a59aeef5a07e7fa6d1 | /admin | Màn Tổng quan điều phối (bản mở rộng "ColdTrack - TongQuan (Mở rộng)"). Các bản thu gọn và hover là biến thể, không code riêng |
| AD-LoHang | ee25b381a8994e62ac3a56982204f1ea | /admin/lo-hang | Thẻ lọc trạng thái, bộ lọc, bảng, chuyển sang bản đồ |
| AD-LoHangChiTiet | cb67b07431ba439c8973ba3db4623390 | /admin/lo-hang/:ma | Drawer: biểu đồ 6 giờ, cảm biến, nhật ký hành trình (nhãn canvas: ColdTrack - Chi tiết lô hàng) |
| AD-DuyetDon | a74ebb25b2c048d9b9a6eb2a0b9df2d8 | /admin/lo-hang/:ma/duyet | Drawer trong Lô hàng: phân công xe, tài xế, dải nhiệt. Có nút Từ chối có lý do |
| AD-Xe | 290a883fe9694216ad2018e20c54b74c | /admin/xe | Bảng quản lý xe. Drawer chi tiết xe: c7b89cb1ad1f42f69261f4ffcdd34490 |
| AD-CanhBao | 0ac6ac4f6ca94a2c9b1ef706029ecdbb | /admin/canh-bao | Thẻ thống kê, bộ lọc, bảng. Trạng thái rỗng: 208aea0ddfef4815b27df18e44c3c3a7 |
| AD-CanhBaoXuLy | ba0c3eb4e9cd437db30015e7bdf58781 | /admin/canh-bao/:id | Drawer xử lý cảnh báo, bắt buộc ghi chú |
| AD-LichSu | 7ec40c5e97b3463c8ca12e349994c337 | /admin/lich-su | Bảng, bộ lọc ngày, trạng thái rỗng (610a73d49949438f8dadb9b6551f36b6), drawer chi tiết chuyến (bc157ac04ef4472399eba4d40e4239e1) |
| AD-NhatKy | 0c1d00de5ffe4ba6bfa6b83520954737 | /admin/nhat-ky | Bảng hoạt động. Cột chi tiết tự xuống dòng |
| AD-CaiDat | c1c96e7555334984bfe4924577fb60dc + b26b14e8674048c1895691f76a76f4cc | /admin/cai-dat | Tab Tài khoản và Thông báo dùng lại từ KH-CaiDat (gán vai trò Điều phối). Tab Ngưỡng nhiệt độ hệ thống đã có ID thật b26b14e8674048c1895691f76a76f4cc, triển khai trong B2 |

## Tài xế
| Tên màn | Stitch ID | Route | Ghi chú |
|---|---|---|---|
| TX-ChuyenHienTai | d55f225d8b15469bb3988cdf2c464ed0 | /tx/chuyen | B4: nhiệt độ, dải, cửa, vị trí, yêu cầu chỉnh chờ duyệt, cảnh báo của chuyến, hàng hóa và kết nối (Kèm trạng thái lỗi validation: 0abe17056a18425c81e537ce82b10552) |
| TX-ModalHoanThanh | dada17e8de0d402c86e53e0dae3b9284 | /tx/chuyen (modal) | Có kiểm tra Đạt chuẩn và Không đạt theo RULES.md mục 4 |
| TX-ModalBaoSuCo | dada17e8de0d402c86e53e0dae3b9284 | /tx/chuyen (modal) | Gửi báo cáo ưu tiên cho điều phối |
| TX-LichSuChuyen | Dùng lại AD-LichSu | /tx/lich-su | Dùng lại bố cục từ màn điều phối, ẩn cột và dữ liệu nội bộ theo RULES.md mục 3. Chỉ hiển thị các chuyến của tài xế |
| TX-CanhBaoCuaChuyen | Dùng lại AD-CanhBao | /tx/canh-bao | Dùng lại bố cục từ màn điều phối, ẩn cột và dữ liệu nội bộ theo RULES.md mục 3. B4: chỉ cảnh báo của chuyến hiện tại, xác nhận đã nhận có ghi chú; không tự đóng cảnh báo của Điều phối |
| TX-CaiDat | Dùng lại KH-CaiDat | /tx/cai-dat | Dùng lại bố cục từ KH-CaiDat, gồm hai tab Tài khoản và Thông báo, không có tab Ngưỡng nhiệt độ |

## Landing công khai (B0)
| Tên trên Stitch | Stitch ID | Loại | Ghi chú |
|---|---|---|---|
| ColdTrack - Trang chủ Doanh nghiệp (Corporate Professional) | c5779fb5d36b4977a91f58868670e772 | `/` | B0: landing công khai, không sidebar; liên kết vào B1, người đã đăng nhập có nút Vào hệ thống theo vai trò. Xem B0-LANDING-HANDOFF.md về nội dung cần xác nhận |

## Màn chưa có trong Stitch (chưa có ID thật - KHÔNG CODE)
Các màn sau chưa có thiết kế hoặc chưa có ID thật trên Stitch, nghiêm cấm tự ý code:
- Tab Ngưỡng nhiệt độ hệ thống đã có thiết kế, xem AD-CaiDat ở trên (cập nhật B2).
- Không tạo trang lỗi riêng mới; trạng thái tải/rỗng/lỗi nội tuyến được yêu cầu và triển khai trong B2.
- Danh sách tài xế (AD-TaiXe) và chi tiết tài xế.
- Form thêm xe (AD-XeThem).
- Quản lý người dùng và phân quyền.

## Biến thể và màn trùng (không code riêng)
| Tên canvas mới / Tên Stitch | Stitch ID | Loại | Quyết định |
|---|---|---|---|
| ColdTrack - TongQuan (Thu gọn) | cbfdbf3ab38f46ef8f87a9818d82954b | Biến thể AD-TongQuan | Biến thể sidebar thu gọn; xử lý qua state/CSS của Sidebar, không code màn riêng |
| ColdTrack - TongQuan (Thu gọn 1) | 35df987699f9404b9ffbe50dde74c6cb | Biến thể AD-TongQuan | Biến thể sidebar hover; xử lý qua hiệu ứng hover của Sidebar, không code màn riêng |
| ColdTrack - Admin Dashboard (Desktop 1440x1024) | 6217854c3ed94193b4f3ea1d272d412e | Trùng lặp (bản ẩn cũ) | Bản cũ đã được thay thế bằng bản canvas mở rộng ab273ed2e9fe49a59aeef5a07e7fa6d1 |
| ColdTrack - Admin Dashboard (Collapsed Sidebar) | 91657b8717d24832b511cbb567350075 | Trùng lặp (bản ẩn cũ) | Bản cũ, không code riêng |



