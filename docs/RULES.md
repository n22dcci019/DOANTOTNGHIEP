# ColdTrack Web: Quy tắc nghiệp vụ và từ vựng

Tài liệu này là nguồn quy tắc duy nhất cho frontend. Khi thiết kế Stitch và tài liệu này mâu thuẫn, ưu tiên tài liệu này và ghi chú lại chỗ đã chọn.

## 1. Phạm vi
- Hệ thống chỉ vận chuyển thực phẩm đông lạnh.
- Không có vaccine, dược phẩm, sữa tươi, hay hàng không đông lạnh.
- Không hiển thị tên phần cứng (ESP, STM, chip). Thiết bị hiển thị là "Thiết bị giám sát", mã dạng TB-8924.
- Không dùng khẳng định chứng nhận (ISO, GDP, GSP, "chuẩn y tế") trong giao diện.
- Công cụ demo (ví dụ "Giả lập mất 4G") chỉ hiển thị khi VITE_DEMO=true.

## 2. Vai trò và tài khoản mock
| Vai trò | Người dùng mock | Nhãn hiển thị |
|---|---|---|
| Điều phối (Admin) | Thái Bảo Khang | Quản trị viên Hub |
| Khách hàng | Nguyễn Văn An | Khách hàng, Công ty TNHH Thực phẩm Mega |
| Tài xế | Trần Minh Khoa | Tài xế |

- Mỗi vai trò có menu riêng, xem mục 3.
- Vào URL không được phép: hiển thị trang 403.
- Dữ liệu mock không được lẫn vai trò. Nguyễn Văn An luôn là Khách hàng, không bao giờ là Quản trị viên.

## 3. Menu theo vai trò
- **Điều phối:** Tổng quan, Lô hàng, Xe, Tài xế, Cảnh báo, Lịch sử, Nhật ký hoạt động, Cài đặt.
- **Khách hàng:** Lô hàng của tôi, Tạo lô hàng, Lịch sử, Cài đặt.
- **Tài xế:** Chuyến hiện tại, Lịch sử chuyến, Cảnh báo của chuyến, Cài đặt.

Khách hàng không có màn Tổng quan. Khi đăng nhập, khách vào thẳng "Lô hàng của tôi".
Mọi vai trò đều có Cài đặt. Nội dung Cài đặt tùy vai trò:
- Khách hàng và tài xế: tab Tài khoản và Thông báo.
- Điều phối: thêm tab Ngưỡng nhiệt độ hệ thống.

Khách và tài xế không thấy: Xe, Tài xế, Cảnh báo toàn đội, Nhật ký, tab Ngưỡng nhiệt độ hệ thống.

## 4. Nhiệt độ và dải

**Dải hợp lệ toàn hệ thống:** min ≥ -25°C, max ≤ -15°C, min < max. Ngoài dải này không cho lưu.

**Mặc định khi tạo đơn:** -20°C đến -18°C.

**Trạng thái nhiệt độ** so với dải [min, max]:

| Trạng thái | Điều kiện | Màu |
|---|---|---|
| Trong ngưỡng | Nằm trong dải, cách biên ≥ 1°C | Xanh lá |
| Tiến sát ngưỡng | Nằm trong dải, cách một biên < 1°C | Cam |
| Vượt ngưỡng | Ngoài dải, vượt biên < 2°C | Cam |
| Nghiêm trọng | Ngoài dải, vượt biên ≥ 2°C | Đỏ |

**Đạt/không đạt khi hoàn thành chặng:**
- Nhiệt độ kết thúc nằm trong [min, max]: "Đạt chuẩn".
- Ngoài dải: "Không đạt", hiển thị mức chênh lệch, bắt buộc ghi lý do trước khi xác nhận.
- Nhãn này phải được tính từ dải, không gõ cứng.

## 5. Cảnh báo
- "Đang mở" là mọi cảnh báo chưa được xử lý, gồm ba mức: Nghiêm trọng, Cảnh báo, Thông tin.
- Badge trên menu Cảnh báo = số Nghiêm trọng + số Cảnh báo đang mở. Không tính Thông tin.
- Mỗi cảnh báo gắn đúng một mã lô. Màn chuyến chỉ hiển thị cảnh báo của lô đó.
- "Đánh dấu đã xử lý" bắt buộc có ghi chú.

## 6. Chỉnh nhiệt độ tay (tài xế)
- Tài xế không áp dụng trực tiếp. Nút là "Gửi yêu cầu chỉnh", trạng thái chuyển thành "Chờ điều phối duyệt".
- Chỉ điều phối duyệt mới tạo phiên bản cấu hình mới.
- Lý do bắt buộc. Nút gửi bị khóa khi form chưa hợp lệ.
- Ô "Hiện tại" lấy từ dải thực của chuyến, không lấy số cố định.
- Form áp dụng cùng dải hợp lệ toàn hệ thống (mục 4).

## 7. Duyệt đơn (điều phối)
- Chỉ cho chọn xe và tài xế đang rảnh (không chạy chuyến khác).
- Xe phải có khả năng giữ dải nhiệt độ yêu cầu. Xe không đủ điều kiện bị khóa, có chú thích lý do.
- Ngày khởi hành không được trước hôm nay.
- "Từ chối" bắt buộc có lý do.
- Điều phối không tạo đơn thay khách.

## 8. Tạo lô hàng (khách hàng)
- Điểm giao phải khác điểm lấy.
- Khối lượng lớn hơn 0.
- Ngày khởi hành từ hôm nay trở đi. Nếu là hôm nay, giờ khởi hành không được ở quá khứ.
- "Lưu nháp" cho phép thiếu trường. "Gửi yêu cầu tạo lô hàng" yêu cầu đủ trường.
- Đơn vị nhận và điểm giao là MỘT trường duy nhất.

## 9. Mốc thời gian
- Thời điểm hiện tại của mock: 30/10/2026, 14:32.
- Mọi "x phút trước", "Cập nhật lúc", và nhãn "hôm nay" tính theo mốc này.

## 10. Số liệu mock (phải khớp nhau)
- **Lô hàng:** Đang vận chuyển 24, Chờ xuất phát 8, Hoàn thành hôm nay 17. Tab "Tất cả" = 49.
- **Xe:** 32 = Đang hoạt động 24 + Rảnh 3 + Đang bảo trì 3 + Mất kết nối 2.
- **Cảnh báo đang mở:** 4 = 1 Nghiêm trọng + 2 Cảnh báo + 1 Thông tin. Badge menu = 3.
- **Lịch sử:** 24 chuyến, 21 đúng nhiệt độ, 3 có cảnh báo, tỷ lệ 87.5%. Màn đăng nhập dùng 87.5%, không dùng 99.98%.
- **Chuyến CT-2026-0156:** có cảnh báo riêng, không dùng cảnh báo của CT-2026-0148.
- **Hoàn thành chặng mẫu:** nhiệt độ kết thúc -19.2°C (Đạt chuẩn). Thêm một trạng thái Không đạt để kiểm thử.

## 11. Nội dung mock đã sửa
- Vaccine và dược phẩm đổi thành thực phẩm đông lạnh: Thịt bò đông lạnh, Hải sản đông lạnh, Kem, Rau củ đông lạnh, Thực phẩm đông lạnh.
- Card "Lô hàng bảo quản": hiển thị tên sản phẩm đông lạnh và số thùng. Không dùng "Vaccine Sinh Học" hay SKU VAC.
- Bỏ "Kho Dược BV Bạch Mai" làm đơn vị nhận.
- Thiết bị hiển thị là TB-xxxx.
- Màn đăng nhập: bỏ "ISO 9001", "GDP Certified" và "Mã hóa SSL 256-bit".
- Cấp độ xác thực vận hành: bỏ hoặc viết lại, không dùng cụm "lộ trình lạnh độc quyền".
- Lịch sử: bộ lọc ngày dùng năm 2026, không dùng 2024.

## 12. Từ vựng (tiếng Việt)
- **Lô hàng** là đơn đã tạo. **Chuyến** là một lần vận chuyển thực tế.
- Mã luôn có dạng CT-2026-XXXX. Không dùng "mã vận đơn".
- **Trạng thái lô:** Chờ điều phối duyệt, Chờ xuất phát, Đang vận chuyển, Hoàn thành, Từ chối.
- **Trạng thái nhiệt độ:** Trong ngưỡng, Tiến sát ngưỡng, Vượt ngưỡng, Nghiêm trọng.
- **Trạng thái xe:** Đang hoạt động, Rảnh, Đang bảo trì, Mất kết nối.
- **Kết quả chuyến:** Đúng nhiệt độ, Có cảnh báo, Đạt chuẩn, Không đạt.
- **Tên nút:** Lưu nháp, Gửi yêu cầu tạo lô hàng, Duyệt & phân công, Từ chối, Gọi tài xế, Xem trên bản đồ, Đánh dấu đã xử lý, Báo sự cố, Hoàn thành chặng, Gửi yêu cầu chỉnh, Hủy, Lưu thay đổi.
- Không dùng tiếng Anh trong giao diện: Critical, Warning, Running, Scheduled, Completed, Done.

## 13. Thành phần và màu
- Component dùng chung: Sidebar, Header, Badge trạng thái, Drawer, Modal, Table, StatCard, Field.
- Badge màu: đỏ = Nghiêm trọng, Không đạt. Cam = Cảnh báo, Vượt ngưỡng. Xanh dương = Thông tin, Đang chạy. Xanh lá = Trong ngưỡng, Đạt chuẩn. Xám = Chờ, Hoàn thành.
- Ô chỉ đọc: nền xám, không viền. Ô sửa được: có viền.
- Chip "Cập nhật lúc 14:32" luôn một dòng. Placeholder ô tìm kiếm không bị cắt.
- Mô tả trong Cài đặt chiếm toàn chiều rộng.
- Cột chi tiết trong Nhật ký tự xuống dòng, không chồng chữ.
- Header dùng cùng một bộ nút ở mọi màn (không có nút "?" ở màn này mà thiếu ở màn khác).
- Nút "Trợ giúp" có trên header mọi màn.

## 14. Nghiệm thu
- Mỗi màn bố cục khớp Stitch. Chạy ổn ở 1280px và 1024px, không cuộn ngang.
- Khách hàng không thấy menu bị cấm. Gõ URL trang admin bằng tài khoản khách hiện 403.
- Số liệu trên màn khớp mục 10.
- Có unit test cho hàm tính trạng thái nhiệt độ và hàm đạt/không đạt, gồm các ca biên: đúng bằng min, đúng bằng max, lệch 1°C, lệch 2°C.
- Liệt kê mọi chỗ đã tự quyết định khi thiết kế không nói rõ.
