# B4 — Tài xế ColdTrack Web

Triển khai cục bộ. Không hosting. Dùng cùng AppLayout của B2/B3 và thiết kế desktop trong Stitch project `18073025285101425800`.

## Route và tham chiếu thiết kế

| Màn | Route | Stitch |
|---|---|---|
| Chuyến hiện tại | `/tx/chuyen` | `d55f225d8b15469bb3988cdf2c464ed0` |
| Chỉnh nhiệt độ — lỗi validate | cùng màn Chuyến hiện tại | `0abe17056a18425c81e537ce82b10552` |
| Hoàn thành chặng / Báo sự cố | modal trong Chuyến hiện tại | `dada17e8de0d402c86e53e0dae3b9284` |
| Lịch sử chuyến | `/tx/lich-su` | dùng lại bố cục `7ec40c5e97b3463c8ca12e349994c337` theo SCREENS.md |
| Cảnh báo của chuyến | `/tx/canh-bao` | dùng lại bố cục `0ac6ac4f6ca94a2c9b1ef706029ecdbb`, giới hạn đúng chuyến |
| Cài đặt | `/tx/cai-dat` | dùng lại `c1c96e7555334984bfe4924577fb60dc`, thông báo `a8bf004c1a6747c3b71926513dbb4d2d` |

`/tx` chuyển đến `/tx/chuyen`; đăng nhập tài xế cũng vào route này. Sidebar chỉ có Chuyến hiện tại, Lịch sử chuyến, Cảnh báo của chuyến, Cài đặt. Settings chỉ có Tài khoản và Thông báo; không có Ngưỡng hệ thống. Drawer lịch sử dùng query `?ma=…`, không thêm màn chính mới.

## Hành vi đã triển khai

- Chuyến hiện tại lấy theo ID tài khoản được phân công, trạng thái Đang vận chuyển. Hiển thị nhiệt độ thực, mục tiêu/dải, trạng thái nhiệt tính từ dải, cửa, vị trí, độ ẩm, lô hàng/số thùng, khối lượng, hành trình và kết nối.
- Chỉnh tay là **Gửi yêu cầu chỉnh**, bắt buộc lý do và dải hợp lệ từ config. Chỉ tạo bản ghi Chờ điều phối duyệt, giữ nguyên dải đang áp dụng, không cho gửi trùng khi đã có yêu cầu chờ.
- Báo sự cố chọn loại, mô tả bắt buộc và đính kèm vị trí từ service. Tạo cảnh báo đúng mã lô với mức độ lấy từ cấu hình; Điều phối thấy trong cùng danh sách B2.
- Xác nhận cảnh báo bắt buộc ghi chú: ghi nhận tài xế đã nhận thông tin. Cảnh báo vẫn mở để Điều phối xử lý; không tự đổi `daXuLy`.
- Hoàn thành chặng lấy nhiệt độ kết thúc từ service, tính Đạt chuẩn/Không đạt bằng hàm nghiệp vụ dùng chung. Không đạt bắt buộc lý do; thiếu cảm biến không cho hoàn thành. Lưu trạng thái/lịch sử/nhật ký, trả xe/tài xế về rảnh, cập nhật lịch sử cho B2/B3, rồi màn hiện tại hiển thị không có chuyến.
- Tài xế chỉ xem lịch sử được gắn owner ID của mình. Không suy luận quyền từ tên tài xế.
- Cài đặt tài khoản và thông báo riêng theo ID tài xế; ID/vai trò không được thay từ payload form.
- Đủ tải/rỗng/lỗi/thử lại/có dữ liệu. Không có chuyến vẫn xem được lịch sử và cài đặt trong trạng thái dữ liệu thông thường.

## File tạo

Đường dẫn `src/` và `scripts/` tính từ `coldtrack-web/`:

- `src/mock/driver.ts`: metadata cửa, niêm phong, đóng gói, config sự cố/ghi chú và owner map lịch sử fixture.
- `src/services/driverTypes.ts`: DTO, hợp đồng DriverService/DriverRepository, runtime và yêu cầu chờ duyệt.
- `src/services/driverValidation.ts`: kiểm tra dải nhiệt/lý do/sự cố theo config.
- `src/services/driverRepository.ts`: mutation dùng chung dataset với B2/B3, kiểm tra vai trò/phân công, lưu nhật ký.
- `src/services/driverService.ts`: adapter có phạm vi tài xế, lọc chuyến/cảnh báo/lịch sử và cờ demo.
- `src/services/DriverContext.tsx`: trạng thái tải, refresh, error và bỏ qua kết quả request cũ.
- `src/services/driverService.test.ts`: 18 test nghiệp vụ/service/validation.
- `src/pages/driver/DriverGate.tsx`: nối context B4 với StatePanel dùng chung.
- `src/pages/driver/DriverCurrentPage.tsx`: thẻ giám sát chuyến, yêu cầu chỉnh nhiệt, cảnh báo, hàng hóa và hành trình.
- `src/pages/driver/DriverActions.tsx`: các modal xác nhận cảnh báo, báo sự cố và hoàn thành.
- `src/pages/driver/DriverHistoryPage.tsx`: lịch sử riêng, bộ lọc và drawer.
- `src/pages/driver/DriverAlertsPage.tsx`: bảng cảnh báo của chuyến, badge và xác nhận.
- `src/pages/driver/DriverSettingsPage.tsx`: hồ sơ tài xế và kênh thông báo.
- `src/pages/driver/driver.css`: bố cục hai cột desktop, thẻ đọc được trên mobile, style riêng B4.
- `src/pages/driver/driver.test.tsx`: 13 test UI/route, gồm test 3 mức badge với màu dùng chung B2.
- `scripts/check-driver-browser.mjs`: Chrome QA, thao tác và ảnh desktop/mobile.
- `docs/B4-DRIVER-HANDOFF.md` tại gốc workspace: tài liệu này.

## File sửa và lý do dùng chung

Không chỉnh nội dung các file màn B1, B2, B3.

- `src/App.tsx`: thay 4 placeholder tài xế bằng màn thật, đặt DriverProvider sau guard vai trò. Các nhóm route khác giữ nguyên.
- `src/components/layout/AppLayout.tsx`: nhận thêm context tài xế cho refresh/demo, tiếp tục dùng layout chung.
- `src/components/common/Header.tsx`: tiêu đề và nút thông báo của tài xế trỏ đúng `/tx`; không đưa tài xế sang route Điều phối. Tìm kiếm lô toàn đội không hiện cho tài xế.
- `src/components/common/Sidebar.tsx`: profile từ context B4, badge chỉ đếm cảnh báo chưa xử lý của chuyến (không tính Thông tin).
- `src/components/common/Modal.tsx`: sửa thiếu accessibility của modal có sẵn: role/label dialog, Escape, giữ focus trong hộp thoại, trả focus khi đóng và cuộn nội dung trên màn nhỏ.
- `src/services/adminService.ts`: gắn DriverRepository vào dataset chung. Sửa phân công tài xế dùng `userId` của tài khoản nếu có, thay vì luôn dùng ID tài nguyên nội bộ.
- `src/services/adminTypes.ts`: Driver có `userId` tùy chọn; HistoryTrip có `driverId`/`customerId` tùy chọn để phân quyền lịch sử mới.
- `src/mock/admin.ts`: gắn ID đăng nhập cho tài xế mẫu Trần Minh Khoa; không thay số lượng dữ liệu nền tảng.
- `src/services/customerService.ts`: lịch sử mới ưu tiên `customerId` thật, giữ owner map cho fixture cũ. Nhờ đó khách thấy chuyến vừa được tài xế hoàn thành. Không thay màn B3.
- `package.json`: `npm test` giới hạn 3 worker; tránh timeout test DOM cũ của B2 khi nhiều worker cùng tải trên Windows. Không bỏ test hoặc thêm dependency.
- `docs/SCREENS.md`: cập nhật ghi chú chức năng B4.

## Tái sử dụng component

Dùng lại AppLayout, Sidebar, Header, Panel, PageHeading, KeyValues, Table/DataTable, StatCard, Badge/Status, Filters, SearchBox, SelectFilter, StatePanel, Drawer, Modal, AuthField, AuthButton/ActionButton, AuthMessage/Message và các formatter B2. Dùng lại `datChuan`, `trangThaiNhietDo` từ nền tảng A.

Component mới cần thiết:

- DriverGate: DataGate cũ gắn useAdmin; wrapper mới dùng context tài xế, vẫn tái sử dụng StatePanel.
- Các modal DriverActions chứa thao tác chuyên biệt theo chuyến, dùng Modal có sẵn. Modal xác nhận cảnh báo dùng chung giữa Chuyến hiện tại và Cảnh báo của chuyến.
- Các component màn B4 giữ state theo role; không tạo layout, bảng, badge, nút hoặc thẻ nền tảng thứ hai.

## Kiểm thử

- `npm.cmd test`: **153/153 pass** — giữ đủ **122 test cũ**, thêm **31 test B4** (18 service/validation + 13 UI).
- `npm.cmd run build`: **PASS**, demo không bật.
- Chrome: **45 trường hợp** = 6 route/biến thể và 3 modal × 5 width (1440, 1280, 1024, 390, 320 px). Không cuộn ngang trang/vùng nội dung và không có lỗi JavaScript.
- Browser kiểm tra: đăng nhập thật B1, menu tài xế desktop/mobile, báo sự cố, xác nhận đã nhận, yêu cầu chỉnh chờ duyệt, lý do hoàn thành không đạt, chuyển sang không có chuyến, lịch sử cập nhật, chặn `/admin` và `/kh/lo-hang`.
- Unit/UI kiểm tra: quyền theo ID; không nhận dữ liệu chỉ vì trùng tên; hành động với mã lô/cảnh báo của người khác bị từ chối; rỗng của cả 4 màn; lỗi/thử lại; 3 màu badge nhất quán B2; dải và lý do theo config; chỉnh nhiệt không tự áp dụng; thiếu nhiệt kế không được kết thúc; Đạt chuẩn/Không đạt tính từ service; hoàn thành hai lần bị từ chối; phân công lại giữ đúng ID đăng nhập; dữ liệu B2/B3 cùng cập nhật; cài đặt riêng và demo bị khóa khi tắt.
- Ảnh: `coldtrack-web/artifacts/driver/`, desktop 1440px và mobile 390px, gồm cả modal.

Chạy lại browser QA: mở Vite ở `127.0.0.1:5177` với demo tắt, chạy `node scripts/check-driver-browser.mjs`. Dùng Chrome cài trên Windows; có thể đặt `CHROME_PATH` cho vị trí khác.

## Khác biệt với Stitch và quyết định

- Dùng menu 4 mục đúng vai trò. Export có chỗ giữ menu quản trị 8 mục; không đưa các mục đó sang tài xế.
- Theo RULES.md, dùng thực phẩm đông lạnh, số thùng và mã CT/TB từ dữ liệu nền tảng. Bỏ vaccine, dược phẩm, tên chip, SKU y tế và khẳng định GDP/GSP.
- Chuyến mẫu vẫn CT-2026-0156 của Trần Minh Khoa, nhiệt độ hiện tại -15,8 °C và dải -20 đến -18 °C nên badge là Nghiêm trọng, thay cho 3,1 °C/dải dương trong export. Không lấy cảnh báo của CT-2026-0148 sang chuyến này.
- Giữ bố cục thẻ nhiệt độ/chỉnh tay/cảnh báo bên trái; lô hàng/hành trình/hàng hóa/kết nối bên phải. Bổ sung cửa/vị trí/độ ẩm trong thẻ cảm biến theo yêu cầu B4. Mobile xếp một cột; thẻ nhiệt độ chính vẫn đọc được.
- Chỉnh tay đổi “Lưu thay đổi/Quay lại v1” thành “Gửi yêu cầu chỉnh/Hủy” để đúng quyền tài xế. Chưa có màn duyệt yêu cầu cấu hình trong B2; yêu cầu được lưu cùng nhật ký và chờ backend/luồng Điều phối tương ứng.
- Xác nhận cảnh báo là xác nhận đã nhận, kèm ghi chú; không tự đóng cảnh báo toàn hệ thống. Đây là lựa chọn để phân biệt thao tác tài xế với xử lý cuối cùng của Điều phối.
- Hoàn thành dùng nhiệt độ sensor hiện có, không cho người dùng gõ nhiệt độ kết thúc để đổi kết quả. Modal có trạng thái Không đạt và lý do bắt buộc ngoài mẫu Đạt chuẩn trong Stitch.
- Loại sự cố/mức độ, giới hạn lý do và các giá trị cửa/niêm phong/đóng gói nằm trong mock/service, không đặt trong component. Mô tả sự cố bắt buộc để báo cáo có thông tin xử lý.
- Dùng Lucide/Inter và component cũ, không thay font icon/ảnh của export; có thể khác nhỏ về icon, khoảng cách/ngắt dòng. Header dùng chung giữ các nút Trợ giúp/Thông báo nhất quán.
- Chỉ bổ sung trường hợp tác nghiệp có trong thiết kế và RULES.md; không tự thêm nút nhận hàng/khởi hành khi chưa có thiết kế tương ứng.

## Mock cần thay khi có backend

- DriverService là interface thay API. DriverRepository hiện đọc/ghi cùng bộ nhớ với B2/B3; reload reset dữ liệu và phiên auth như các giai đoạn trước.
- Backend cần xác thực role/owner từ session, khóa mutation nguyên tử, cung cấp phân công hiện tại, lịch sử theo driver ID và cấu hình giới hạn. Guard frontend/mock không thay quyền server.
- Nhiệt độ, cửa, vị trí, độ ẩm, pin, niêm phong, đóng gói, lịch sử và kết nối đều là dữ liệu giả lập. Chưa kết nối GPS/IoT, không điều khiển máy lạnh hoặc gửi SMS/email thật.
- Yêu cầu chỉnh nhiệt được lưu trạng thái Chờ điều phối duyệt; cần endpoint/quy trình Điều phối phê duyệt, phiên bản cấu hình và đồng bộ thiết bị thật.
- Xác nhận đã nhận cần lưu riêng với xử lý cảnh báo; backend cần trả acknowledgement và log. Hiện các bản ghi này chỉ trong bộ nhớ.
- Báo sự cố tạo cảnh báo và nhật ký mock. Hoàn thành cập nhật lô/lịch sử và tài nguyên mock; backend cần biên bản giao nhận, kiểm tra cảm biến/niêm phong và audit trail thật.
- `DRIVER_HISTORY_OWNERS` và `DRIVER_RESOURCE_IDS` chỉ ánh xạ fixture cũ; backend cần owner/account IDs thật. Lịch sử mới đã có driverId/customerId.
- `VITE_DEMO=true` bật công cụ Có dữ liệu/Rỗng/Lỗi và Giả lập mất 4G. Tắt demo ẩn UI và chặn simulation ở service. Dữ liệu chờ đồng bộ khi giả lập mất mạng là số minh họa, chưa có hàng đợi offline thật hoặc cơ chế gửi lại.
- Email chỉnh trong Cài đặt chỉ đổi profile mock, chưa đổi credential của auth mock B1. Backend cần luồng đổi email tài khoản thật.
- Mốc giờ mock giữ 30/10/2026 14:32 theo RULES.md; mọi ngày giờ/số dùng formatter tiếng Việt.

## Xem thử

```powershell
cd D:\DoAnTotNghiep\coldtrack-web
$env:VITE_DEMO="true"
npm run dev
```

Đăng nhập `khoa.tran@coldtrack.vn` / `ColdTrack2026`. Tài xế vào thẳng `/tx/chuyen`. Chuyến mẫu có cảnh báo nghiêm trọng nên hoàn thành cần nhập lý do Không đạt. Sau hoàn thành, xem kết quả trong Lịch sử chuyến; reload để khởi tạo lại bộ mock khi muốn thử từ đầu.
