# B3 — Khách hàng ColdTrack Web

Triển khai cục bộ, không hosting. Không triển khai B4. Tham chiếu HTML desktop trực tiếp từ Stitch project `18073025285101425800`, cùng `RULES.md` và `SCREENS.md`.

## Route và thiết kế

| Màn | Route | Tham chiếu Stitch |
|---|---|---|
| Lô hàng của tôi | `/kh/lo-hang` | `ee25b381a8994e62ac3a56982204f1ea`, dùng lại bố cục danh sách và bỏ dữ liệu nội bộ |
| Tạo lô hàng | `/kh/tao-lo-hang` | `66d9ddfaabd14c41a4759daa3691872c` |
| Lịch sử | `/kh/lich-su` | `7ec40c5e97b3463c8ca12e349994c337`, chỉ dữ liệu chủ tài khoản |
| Cài đặt | `/kh/cai-dat` | `c1c96e7555334984bfe4924577fb60dc`; thông báo: `a8bf004c1a6747c3b71926513dbb4d2d` |

- Xem trạng thái lô qua drawer trên cùng route: `/kh/lo-hang?ma=CT-2026-0156`.
- Giữ biến thể xem bản nháp có sẵn: `/kh/tao-lo-hang/xem-lai`, tham chiếu `db3d8a811b9540ce95004dbc154382f5`.
- Theo yêu cầu B3 hiện tại, gửi thành công chuyển ngay về `/kh/lo-hang` và hiển thị thông báo có mã lô. Không tạo trang thành công thứ năm. Route cũ `/kh/lo-hang/:ma/da-gui` chuyển về danh sách và không giả tạo thành công.
- Khách hàng đăng nhập vào thẳng Lô hàng của tôi. Sidebar chỉ có 4 mục: Lô hàng của tôi, Tạo lô hàng, Lịch sử, Cài đặt. Không có Tổng quan, Xe, Tài xế, Cảnh báo toàn đội, Nhật ký hoặc tab Ngưỡng hệ thống.

## File tạo

Đường dẫn `src/` và `scripts/` tính từ `coldtrack-web/`:

- `src/mock/customer.ts`: loại hàng, giá trị mặc định mục tiêu/dung sai, địa điểm, đóng gói, giới hạn khối lượng/ghi chú và ánh xạ chủ sở hữu lịch sử mock.
- `src/services/customerTypes.ts`: DTO khách hàng, form, cấu hình và interface service/repository.
- `src/services/customerValidation.ts`: validate form và đọc mặc định theo loại hàng.
- `src/services/customerService.ts`: adapter chỉ trả dữ liệu của khách đang đăng nhập, lọc trường nội bộ, dùng chung mock source với B2.
- `src/services/CustomerContext.tsx`: tải, lỗi/thử lại, cập nhật dữ liệu và cờ demo.
- `src/services/customerValidation.test.ts`: 24 test validate và mặc định cấu hình.
- `src/services/customerService.test.ts`: 8 test quyền dữ liệu, mutation, liên thông B2, nháp và cài đặt riêng.
- `src/pages/customer/CustomerGate.tsx`: nối trạng thái context khách hàng với StatePanel chung.
- `src/pages/customer/CustomerShipmentsPage.tsx`: danh sách, bộ lọc và drawer trạng thái hiện tại.
- `src/pages/customer/CreateShipmentPage.tsx`: form 4 phần, tóm tắt, lưu nháp, xem lại và gửi yêu cầu.
- `src/pages/customer/CustomerHistoryPage.tsx`: lịch sử riêng, bộ lọc ngày và drawer thông tin chuyến.
- `src/pages/customer/CustomerSettingsPage.tsx`: tài khoản và thông báo, không có cấu hình hệ thống.
- `src/pages/customer/customer.css`: CSS riêng của form 7/5 cột và responsive.
- `src/pages/customer/customer.test.tsx`: 10 test UI, điều hướng và quyền route.
- `scripts/check-customer-browser.mjs`: Chrome QA và ảnh chụp desktop/mobile.
- `docs/B3-CUSTOMER-HANDOFF.md` ở gốc workspace: tài liệu này.

## File sửa và phạm vi dùng chung

- `src/App.tsx`: thay placeholder B3 bằng màn thật, đặt CustomerProvider sau ProtectedRoute khách hàng. Giữ nguyên route B1/B2/B4.
- `src/components/layout/AppLayout.tsx`: dùng lại khung hiện có cho customer context, không tạo layout thứ hai. Sửa lỗi dùng chung: đổi pathname sẽ đưa vùng nội dung về đầu trang, tránh giữ scroll từ màn trước và làm khuất đầu form.
- `src/components/common/Header.tsx`: dùng tiêu đề, tìm kiếm và refresh theo nhóm route; sửa lỗi nút thông báo/tìm kiếm khách hàng trỏ sang route Điều phối. Các thao tác Điều phối giữ nguyên.
- `src/components/common/Sidebar.tsx`: đọc profile đã lưu của khách hàng từ context; tái sử dụng menu 4 mục đã có. Menu Điều phối không thay đổi.
- `src/services/adminService.ts`: mở rộng mock repository bằng phương thức tạo yêu cầu khách hàng, nháp và cài đặt theo owner. Không thay các màn hoặc luồng mutation B2. Yêu cầu từ B3 vào cùng queue B2, không tạo bộ dữ liệu độc lập.
- `src/mock/types.ts`: thêm thuộc tính tùy chọn `quyCachDongGoi`, `nhietDoMucTieu`, `dungSai` cho lô hàng; fixture B2 cũ vẫn hợp lệ.
- `docs/SCREENS.md`: cập nhật ghi chú form và hành vi chuyển hướng thành công B3.

Không sửa màn auth B1 hoặc các file màn Điều phối B2. Không thêm framework/dependency. Thay đổi ngoài B3 chỉ ở route, model/repository và component layout dùng chung như trên.

## Component được tái sử dụng

Tái sử dụng `AppLayout`, `Header`, `Sidebar`, `Drawer`, `Table` qua `DataTable`, `StatCard`, `Badge` qua `Status`, `Panel`, `PageHeading`, `Filters`, `SearchBox`, `SelectFilter`, `Tabs`, `StatePanel`, `KeyValues`, `AuthField`, `AuthButton`, `AuthMessage`, `SaveButton` và các hàm định dạng B2.

Component mới có lý do riêng:

- `CustomerGate`: DataGate B2 gắn trực tiếp useAdmin; wrapper này dùng context khách hàng và tái sử dụng StatePanel, không sao chép màn tải/rỗng/lỗi.
- `ShipmentSummary` nằm trong trang tạo: hiển thị mục tiêu ± dung sai và bản nháp theo config; dùng cùng một component cho tóm tắt bên phải và drawer xem lại.
- Các component màn B3 chứa state và thao tác theo tài khoản khách hàng. Không sửa/tách lại các form private trong màn Cài đặt B2 để tránh thay đổi phạm vi B2.

## Kiểm thử

- `npm.cmd test`: **122/122 pass** — **80 test cũ** vẫn pass, thêm **42 test B3**.
- `npm.cmd run build`: **PASS**, không bật `VITE_DEMO`.
- Chrome: **40 trường hợp** (8 route/biến thể × 5 width 1440, 1280, 1024, 390, 320 px); không cuộn ngang trang/vùng nội dung, không có lỗi JavaScript.
- Luồng browser: đăng nhập khách hàng, đúng 4 mục sidebar, mặc định theo loại hàng, lưu nháp, tạo và thông báo thành công trên danh sách, không xem được mã lô của khách khác, chỉ 2 tab Cài đặt và bị từ chối truy cập `/admin`.
- Unit/UI: bắt buộc trường cốt lõi; dung sai dương/hữu hạn; target và cả dải trong giới hạn; trọng lượng/ghi chú theo config; khác điểm giao/lấy; ngày giờ hợp lệ, không quá khứ; mặc định đổi theo loại hàng và vẫn sửa được; tạo ở server adapter vẫn validate nếu bỏ qua client; owner không thể thay bằng dữ liệu form; không kế thừa lịch sử chỉ vì trùng tên công ty; không gửi trường xe/tài xế/thiết bị cho UI khách; yêu cầu mới được duyệt trong B2 rồi B3 thấy trạng thái mới.
- Ảnh: `coldtrack-web/artifacts/customer/`, gồm desktop 1440 px và mobile 390 px.

Chạy lại QA: mở Vite tại `127.0.0.1:5176` với demo tắt, chạy `node scripts/check-customer-browser.mjs`. Dùng Chrome đã cài trên Windows; có thể đặt `CHROME_PATH` nếu executable ở vị trí khác.

## Khác biệt so với Stitch và lựa chọn

- Một số export gán Nguyễn Văn An vai trò Quản trị viên và chứa menu 8 mục. B3 giữ vai trò Khách hàng, đúng 4 mục theo RULES.md và yêu cầu phân quyền; vẫn dùng khung/sidebar trắng B2 hiện có.
- Theo phạm vi hàng đông lạnh của repo, không thêm vaccine/dược phẩm từ dữ liệu mẫu/ví dụ. Các preset gồm Thực phẩm đông lạnh, Thịt bò đông lạnh, Thủy hải sản đông lạnh, Kem, Rau củ đông lạnh.
- Form đổi hai đầu dải trong export thành **nhiệt độ mục tiêu ± dung sai** theo yêu cầu B3. Dải gửi cho B2 được tính từ hai giá trị này và hiển thị trong tóm tắt. Giới hạn lấy từ cấu hình service, không dùng dải -30 đến 10 trong export.
- Mặc định generic lấy từ dải mặc định mới nhất B2: ví dụ dải -20 đến -18 cho mục tiêu -19, dung sai 1. Preset riêng từng loại nằm trong file mock; khách được sửa.
- Form mở trống, không tự điền các địa chỉ, thời gian hoặc ghi chú mẫu như ảnh Stitch. Chọn loại hàng mới điền preset nhiệt độ/dung sai.
- Không hứa thời gian duyệt 15–30 phút hoặc khẳng định sẽ gửi SMS/email thật như export; các kênh hiện là cấu hình mock.
- Danh sách/chi tiết/lịch sử không có biển số, tài xế, số điện thoại nội bộ hay mã thiết bị. Đây là khác biệt có chủ đích so với màn điều phối được dùng làm tham chiếu.
- Icon, font và component bảng/thẻ dùng bộ có sẵn; có thể có sai khác nhỏ về khoảng cách và ngắt dòng so với HTML export.
- Ngày giờ tóm tắt và số hiển thị dùng formatter vi-VN. Control date/time native có thể hiển thị theo thiết lập locale của trình duyệt/hệ điều hành.

## Mock cần thay khi có backend

- CustomerService hiện là adapter bọc cùng repository mock với B2. Backend cần endpoint tự xác định owner từ session, trả DTO đã lọc theo quyền; guard frontend và DTO mock không thay thế kiểm tra quyền ở server.
- `customerMockConfig` là điểm thay cho API cấu hình: loại hàng/preset, địa điểm, đóng gói, giới hạn nhiệt độ, khối lượng, ghi chú, múi giờ và page size. Component không chứa giá trị mẫu.
- Mapping `CUSTOMER_HISTORY_OWNERS` dành cho fixture lịch sử cũ vốn chỉ có tên công ty; backend cần owner ID thật. Không dùng tên công ty để phân quyền.
- Tạo yêu cầu, bản nháp, cài đặt, trạng thái và nhật ký chỉ tồn tại trong bộ nhớ của phiên SPA; reload reset dữ liệu và phiên auth B1 như trước. Chưa lưu DB, chưa gửi email/SMS hoặc lấy telemetry thật.
- Cập nhật email trong Cài đặt hiện thay thông tin hồ sơ của mock; chưa đổi credential đăng nhập của auth mock B1. Backend cần luồng cập nhật email/đồng bộ tài khoản thật.
- Cờ `VITE_DEMO=true` giữ nguyên, bật chọn Có dữ liệu/Rỗng/Lỗi kết nối trên layout; demo tắt vẫn dùng service mock cho đến khi có adapter API và ẩn toàn bộ công cụ giả lập.
- Mốc thời gian mock vẫn theo RULES.md: 30/10/2026 14:32. Thời gian khởi hành được so với clock do service trả, không lấy giờ cố định trong component.
- Form hiện không thu thập số thùng riêng; repository giữ giá trị 0 cho trường legacy `soThung` (chưa xác định), không hiển thị như số kiện thực. Backend cần chuẩn hóa trường này nếu nghiệp vụ yêu cầu số kiện.

## Xem thử

```powershell
cd D:\DoAnTotNghiep\coldtrack-web
$env:VITE_DEMO="true"
npm run dev
```

Mở `/login`, đăng nhập `an.nguyen@megafood.vn` / `ColdTrack2026`. Khách vào thẳng `/kh/lo-hang`. Tạo yêu cầu mới rồi đổi sang Điều phối trong cùng phiên SPA để xem yêu cầu ở hàng chờ duyệt B2.
