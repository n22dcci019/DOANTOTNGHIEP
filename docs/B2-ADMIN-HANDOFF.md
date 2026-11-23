# B2 — Điều phối ColdTrack Web

Triển khai cục bộ trong `coldtrack-web`. Không triển khai hosting và không triển khai màn nghiệp vụ B3/B4. Dùng thiết kế desktop trong Stitch project `18073025285101425800`.

## Route

| Màn | Route | Stitch ID |
|---|---|---|
| Tổng quan | `/admin` | `ab273ed2e9fe49a59aeef5a07e7fa6d1` |
| Lô hàng | `/admin/lo-hang` | `ee25b381a8994e62ac3a56982204f1ea` |
| Chi tiết lô hàng | `/admin/lo-hang/:ma` | `cb67b07431ba439c8973ba3db4623390` |
| Duyệt đơn | `/admin/lo-hang/:ma/duyet` | `a74ebb25b2c048d9b9a6eb2a0b9df2d8` |
| Cảnh báo | `/admin/canh-bao` | `0ac6ac4f6ca94a2c9b1ef706029ecdbb` |
| Xử lý cảnh báo | `/admin/canh-bao/:id` | `ba0c3eb4e9cd437db30015e7bdf58781` |
| Xe | `/admin/xe` | `290a883fe9694216ad2018e20c54b74c` |
| Chi tiết xe | `/admin/xe/:id` | `c7b89cb1ad1f42f69261f4ffcdd34490` |
| Lịch sử | `/admin/lich-su` | `7ec40c5e97b3463c8ca12e349994c337` |
| Chi tiết chuyến | `/admin/lich-su/:ma` | `bc157ac04ef4472399eba4d40e4239e1` |
| Nhật ký hoạt động | `/admin/nhat-ky` | `0c1d00de5ffe4ba6bfa6b83520954737` |
| Cài đặt | `/admin/cai-dat` | `c1c96e7555334984bfe4924577fb60dc` |
| Thông báo | `/admin/cai-dat?tab=notifications` | `a8bf004c1a6747c3b71926513dbb4d2d` |
| Ngưỡng nhiệt độ | `/admin/cai-dat?tab=thresholds` | `b26b14e8674048c1895691f76a76f4cc` |

Ngưỡng chỉ hiện nếu service trả `settings.thresholdDesignId`. Thiết kế này hiện đã có ID thật; `SCREENS.md` đã cập nhật. `/admin/tai-xe` giữ link và placeholder đã có, chưa tạo màn tài xế riêng.

## File tạo

Các đường dẫn `src/` và `scripts/` tính từ `coldtrack-web/`:

- `src/services/adminTypes.ts`: hợp đồng dữ liệu/service, định dạng tiếng Việt, kiểm tra dải nhiệt và khả năng xe.
- `src/services/adminService.ts`: adapter mock cho đọc dữ liệu, duyệt/từ chối đơn, xử lý cảnh báo, lưu cài đặt và nhật ký.
- `src/services/AdminContext.tsx`: tải dữ liệu dùng chung, loading/error/retry và cập nhật snapshot sau thao tác.
- `src/services/adminService.test.ts`: test nghiệp vụ và tính nhất quán dữ liệu.
- `src/mock/admin.ts`: cấu hình, yêu cầu chờ duyệt, tài xế, chuỗi cảm biến và vị trí minh họa; tái sử dụng dữ liệu nền tảng.
- `src/components/admin/AdminUI.tsx`: khung nội dung, trạng thái, bảng có phân trang, bộ lọc, tab, biểu đồ, thông tin chi tiết và thang nhiệt.
- `src/components/admin/FleetMap.tsx`: bản đồ minh họa dùng chung và thông số cảm biến.
- `src/components/admin/admin.css`: layout desktop/mobile theo thiết kế.
- `src/pages/admin/ShipmentPages.tsx`: Tổng quan, danh sách và drawer chi tiết lô hàng, xuất CSV.
- `src/pages/admin/ApprovalPage.tsx`: duyệt/phân công hoặc từ chối có lý do.
- `src/pages/admin/AlertsPage.tsx`: lọc cảnh báo và drawer xử lý có ghi chú.
- `src/pages/admin/VehiclesPage.tsx`: danh sách xe, bộ lọc và drawer chi tiết.
- `src/pages/admin/HistoryPages.tsx`: lịch sử, drawer chuyến và nhật ký hoạt động.
- `src/pages/admin/SettingsPage.tsx`: thông tin tài khoản, thông báo, ngưỡng nhiệt và lịch sử thay đổi.
- `src/pages/admin/admin.test.tsx`: test giao diện, điều hướng, trạng thái và thao tác B2.
- `scripts/check-admin-browser.mjs`: kiểm tra Chrome và chụp ảnh desktop/mobile.
- `docs/B2-ADMIN-HANDOFF.md` tại gốc workspace: tài liệu này.

## File sửa

- `src/App.tsx`: thay placeholder B2 bằng route thật, đặt `AdminProvider` trong cổng bảo vệ vai trò Điều phối. Giữ các route B1/B3/B4.
- `src/components/layout/AppLayout.tsx`: sidebar/header/vùng nội dung, menu mobile và bộ chọn trạng thái demo.
- `src/components/common/Sidebar.tsx`: sidebar trắng theo Stitch, đủ 8 mục, active theo route, badge từ dữ liệu cảnh báo, thu gọn/mở rộng.
- `src/components/common/Header.tsx`: tiêu đề theo route, tìm kiếm lô hàng, làm mới, thông báo, trợ giúp; giữ đổi vai trò sau cờ demo.
- `src/components/common/Drawer.tsx`: hỗ trợ dialog, Escape, giữ focus bàn phím trong drawer, trả focus khi đóng và full-width trên mobile.
- `docs/SCREENS.md`: sửa project ID và cập nhật ID thật của tab Ngưỡng.

Không thêm dependency hoặc framework trong B2. Tái sử dụng `Table`, `StatCard`, `Badge`, `Drawer` nền tảng và `AuthField`, `AuthButton`, `AuthMessage` của B1.

## Kết quả kiểm tra

- `npm.cmd test`: **80/80 pass** — giữ toàn bộ **59 test A/B1**, thêm **21 test B2**.
- `npm.cmd run build`: **PASS**, không bật `VITE_DEMO`.
- Chrome: **75 trường hợp** (15 route/biến thể × 5 width: 1440, 1280, 1024, 390, 320 px); không cuộn ngang trang/vùng nội dung và không có lỗi JavaScript.
- Bảng rộng có cuộn riêng trong khung, không đẩy chiều rộng trang.
- Luồng Chrome pass: tìm kiếm ra trạng thái rỗng, duyệt/phân công đơn, xử lý cảnh báo, lưu ngưỡng có lý do.
- Unit/UI kiểm tra: đủ 8 mục và active đúng trên route chi tiết; danh sách → chi tiết; tải/rỗng/lỗi/thử lại; thiếu ID; ghi chú bắt buộc và badge cập nhật; chọn xe/tài xế; ẩn tab Ngưỡng nếu thiếu design ID; lý do lưu ngưỡng; giới hạn tải trọng/nhiệt độ; không phân công lại xe/tài xế bận; dữ liệu trả về không bị sửa qua snapshot; không đổi vai trò từ form tài khoản.
- Ảnh đối chiếu: `coldtrack-web/artifacts/admin/` (desktop 1440 px và mobile 390 px).

Chạy lại browser test: mở Vite ở `127.0.0.1:5175` với demo tắt rồi chạy `node scripts/check-admin-browser.mjs`. Script đăng nhập qua form thật. Mặc định dùng Chrome đã cài trên Windows; có thể đặt `CHROME_PATH` để dùng vị trí executable khác.

## Khác biệt so với Stitch và quyết định

- Chọn layout sidebar trắng 240px từ bản Tổng quan mở rộng làm layout chung. Các bản export dùng sidebar khác nhau được thống nhất theo bản này. Mobile dùng menu trượt, drawer chiếm toàn chiều rộng; desktop giữ bố cục bảng và drawer.
- Theo `RULES.md`: chỉ thực phẩm đông lạnh, người Điều phối là Thái Bảo Khang; bỏ tên chip và chứng nhận; trạng thái tiếng Việt; số liệu nền tảng 49 lô, 32 xe, 24 lịch sử (21 đúng nhiệt độ), 4 cảnh báo đang mở và badge menu 3. Không dùng dữ liệu dược phẩm hoặc nhiệt dương trong thiết kế.
- Có 2 yêu cầu chờ duyệt tách khỏi 49 lô đang theo dõi, xem tab “Chờ điều phối duyệt”. Duyệt xong chuyển yêu cầu vào lô “Chờ xuất phát”; tổng số và số xe/tài xế rảnh cập nhật từ dữ liệu thực của mock. Không giả định số liệu luôn cố định sau thao tác.
- Bản đồ là sơ đồ SVG/CSS tương tác trên dữ liệu vị trí mock (zoom, toàn màn hình, chọn xe và mở lô). Chưa dùng bản đồ địa lý/GPS thật, không đảm bảo khớp hình nền map từng pixel.
- Logo và icon dùng Lucide có sẵn thay các font icon/ảnh logo của export. Chuỗi cảm biến mô phỏng, không lấy mẫu thật.
- Xuất **CSV** mở được bằng Excel, nhãn là “Xuất CSV”; chưa thêm thư viện xuất `.xlsx`.
- Không có nút tạo lô thay khách hoặc thêm xe vì trái phạm vi/nghiệp vụ hoặc chưa có thiết kế được duyệt.
- Các drawer có route trực tiếp; thao tác đóng quay lại danh sách. Chi tiết lịch sử dùng mã mock thực có trong dataset, ví dụ `CT-2026-0301`, thay mã minh họa trong Stitch.
- Các card thống kê/badge dùng component chung; không sao chép nguyên HTML export nên có khác biệt nhỏ về icon, ngắt dòng, kích thước chữ và khoảng cách.
- Đồ thị trong lịch sử dùng dải nhiệt dạng số từ service, không suy đoán giới hạn trong component. Bộ lọc ngày mặc định không giới hạn, lấy ngày từ dữ liệu mock năm 2026.

## Mock và điểm nối backend

`AdminService` là interface duy nhất cho B2; component chỉ lấy dữ liệu qua context/service. Hiện export `adminService` dùng `createMockAdminService`, tương tự cách B1 hoạt động khi chưa có backend.

- Thay bằng adapter API thật để đọc snapshot/danh sách, lấy chi tiết và thực hiện mutation. Khi hợp đồng trả về được giữ nguyên, không cần đổi component.
- Cờ `VITE_DEMO=true` chỉ bật công cụ giả lập, gồm chọn Có dữ liệu/Rỗng/Lỗi kết nối; demo tắt không hiện công cụ và service không nhận chuyển trạng thái giả lập. Đây không phải cờ biến mock thành backend thật.
- Dữ liệu/mock mutation chỉ giữ trong bộ nhớ của phiên SPA. Reload khởi tạo lại mock và phiên đăng nhập B1. Chưa lưu DB, không gửi SMS/email, không điều khiển thiết bị thật.
- Backend phải xác thực vai trò, kiểm tra và khóa phân công nguyên tử, tạo lịch sử kiểm toán, kiểm tra quyền thay cài đặt. Guard phía frontend chưa thay thế quyền server.
- Backend trả cấu hình nhiệt độ, tải trọng và lịch trống, telemetry, giờ server, thời hạn và ID thiết kế; các giá trị mẫu nằm trong mock, không đặt trực tiếp trong component.
- Tích hợp bản đồ thật, GPS/IoT thời gian thực, cập nhật sự kiện và xuất XLSX là các điểm nối còn lại. Dữ liệu cảm biến/mock đang được tạo từ các lô thực của mock để không lẫn mã lô.
- Mốc giờ mock giữ theo `RULES.md`: 30/10/2026 14:32; định dạng hiển thị dùng tiếng Việt/múi giờ Asia/Ho_Chi_Minh.

## Xem thử

```powershell
cd D:\DoAnTotNghiep\coldtrack-web
$env:VITE_DEMO="true"
npm run dev
```

Mở `/login`, dùng tài khoản `khang.thai@coldtrack.vn` / `ColdTrack2026`. Vào Lô hàng → Chờ điều phối duyệt để thử đơn `CT-2026-0401` hoặc `CT-2026-0402`. Bảng điều khiển demo ở đầu vùng nội dung giúp kiểm tra rỗng/lỗi; chọn “Có dữ liệu” để khôi phục.
