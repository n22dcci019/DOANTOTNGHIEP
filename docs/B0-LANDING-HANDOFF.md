# B0 — Landing ColdTrack và bổ sung chuyển hướng B1

Triển khai cục bộ tại `/`, công khai, không sidebar. Tham chiếu Stitch project `18073025285101425800`, màn `c5779fb5d36b4977a91f58868670e772`. Đủ 13 khối theo thứ tự yêu cầu. Không tạo trang giá, đăng ký doanh nghiệp hoặc màn đăng nhập mới.

## File tạo

Các đường dẫn `src/`, `scripts/`, `artifacts/` tính từ `coldtrack-web/`:

- `src/content/landing.ts`: nội dung marketing, nhãn, thông báo, menu, FAQ và footer.
- `src/mock/landing.ts`: dữ liệu dashboard/tra cứu công khai, testimonial minh họa và adapter dùng chung preset hàng hóa.
- `src/services/landingService.ts`: interface LandingService, tải nội dung động, lookup và giả lập trạng thái.
- `src/pages/landing/LandingPage.tsx`: ghép trang, tải/rỗng/lỗi/thử lại, công cụ demo có điều kiện.
- `src/pages/landing/LandingSections.tsx`: các khối trang, menu mobile, form tra cứu, danh sách công tắc.
- `src/pages/landing/LandingBlocks.tsx`: logo, thẻ tính năng/testimonial, FAQ, bước quy trình, dòng hàng hóa, dashboard và kết quả tra cứu tái sử dụng.
- `src/pages/landing/landing.css`: CSS giới hạn trong landing, responsive và trạng thái focus.
- `src/auth/GuestRoute.tsx`: chuyển người đã đăng nhập khỏi login/register/forgot-password.
- `src/auth/navigation.ts`: chọn đích sau đăng nhập đúng vai trò, bảo toàn query/hash, loại URL ngoài ứng dụng.
- `src/pages/landing/landing.test.tsx`, `src/services/landingService.test.ts`, `src/auth/navigation.test.ts`, `src/auth/routing.test.tsx`: 40 test mới.
- `scripts/check-landing-browser.mjs`: kiểm tra tương tác và responsive bằng Chrome/Playwright.
- `artifacts/landing/`: ảnh toàn trang ở 6 kích thước, ảnh viewport desktop/mobile và kết quả tra cứu.
- `docs/B0-LANDING-HANDOFF.md`: tài liệu này.

## File sửa và phạm vi B1–B4

- `src/App.tsx`: `/` dùng landing; `/app` vào hệ thống theo vai trò; bổ sung alias có bảo vệ `/tong-quan` → `/admin`; gắn GuestRoute cho 3 form yêu cầu.
- `src/auth/ProtectedRoute.tsx`: lưu route ban đầu gồm query/hash khi chuyển khách chưa đăng nhập về login.
- `src/pages/auth/AuthPages.tsx`: chỉ đổi đích sau đăng nhập thành công theo route ban đầu hợp lệ/vai trò; giữ nguyên service xác thực, validate và giao diện form.
- `src/components/common/Header.tsx`: bộ chọn vai trò demo vào thẳng trang của vai trò, vì `/` nay là landing công khai.
- `src/auth/flows.test.tsx`: test đăng nhập cũ bắt đầu tại `/login` thay vì `/`, tương ứng yêu cầu mới cho root. Các kiểm tra còn lại giữ nguyên.
- `docs/SCREENS.md`: cập nhật phạm vi và route landing.

Không sửa các màn nghiệp vụ B2–B4. Không thêm thư viện. Dùng lại AuthField, AuthButton, AuthMessage, Badge, formatter và AuthContext hiện có.

## Điều hướng và tương tác

- Menu Đăng nhập → `/login`, Đăng ký và CTA đăng ký → `/register`. Khi đã đăng nhập, menu đổi thành Vào hệ thống → `/admin`, `/kh/lo-hang` hoặc `/tx/chuyen`.
- Login/register/forgot-password tự chuyển người đã đăng nhập về giao diện tương ứng. Khách mở route nội bộ được chuyển login, đăng nhập xong quay lại route đúng quyền, giữ query/hash. Đích khác vai trò hoặc ngoài ứng dụng trả về trang mặc định của vai trò.
- Các mục menu/footer dùng anchor trên cùng trang; không có liên kết tới trang giá hay trang con chưa triển khai.
- Menu mobile có nút aria-expanded; công tắc dùng checkbox có role switch; FAQ dùng button aria-expanded/aria-controls và vùng nội dung có nhãn. Có focus bàn phím và liên kết bỏ qua menu.
- Mã tra cứu mẫu: `CT-2026-0901`, `CT-2026-0902`; không cần tài khoản. Có lỗi nhập rỗng, không tìm thấy, đang tra cứu, lỗi service và kết quả hành trình/nhiệt độ.
- Công tắc hàng hóa chỉ thay đổi bản xem thử trên landing; không ghi cấu hình vận hành.

## Kiểm chứng

- `npm.cmd test`: **193/193 test pass, 15 file test**, gồm toàn bộ test A–B4; một test cũ đổi URL khởi đầu theo thay đổi root đã nêu.
- `npm.cmd run build`: **PASS**, TypeScript và Vite production build, cờ demo không bật.
- Chrome headless: kiểm tra các width 1440, 1280, 1024, 768, 390, 320 px; không tràn ngang, không sidebar. Kiểm tra menu mobile, nhập rỗng/tra cứu mẫu, switch và FAQ bằng bàn phím; đăng nhập/guest guard/đích quay lại/liên kết landing theo 3 vai trò. Script báo lỗi qua exit code khi có vấn đề.
- Browser script: **21 kiểm tra đạt, `problems: []`**; đã xem ảnh viewport 1440 và 390 px.
- `npm.cmd run lint`: exit code 0, còn warning. Phần B0 có warning dependency trong fixture đăng nhập của test và regex cố ý chặn control character trong URL; các warning khác nằm ở component/context đã có. Chưa thay đổi các màn cũ chỉ để dọn warning.

## Khác biệt với Stitch và nội dung còn thiếu

- Giữ bố cục trang dài, hero giữa trên lưới, dashboard, các khối xanh đậm, sơ đồ 6 nút, so sánh, quy trình, tra cứu, hàng hóa, testimonial, FAQ, CTA và footer. Dashboard/bản đồ là HTML/SVG minh họa; không tích hợp bản đồ thật. Responsive hẹp được suy ra từ bố cục desktop.
- Thêm Đăng ký và Vào hệ thống theo yêu cầu mới. Nhóm giải pháp hiển thị 4 thẻ; export chỉ có nội dung chi tiết tab đầu, nên không tạo nội dung tab chưa có.
- Chuyển các nội dung y tế/dược phẩm sang thực phẩm đông lạnh theo RULES.md. Bỏ tuyên bố chứng nhận, độ chính xác được chứng nhận, AI bảo đảm và khả năng tích hợp chưa kiểm chứng; mô tả API là hướng mở rộng. Không hiển thị logo khách hàng hoặc địa chỉ văn phòng chưa xác nhận.
- Export không cung cấp câu trả lời cho 4 FAQ: “Khách hàng xem được những thông tin nào?”, “Điều gì xảy ra khi xe mất sóng 4G?”, “Dữ liệu nhiệt độ được lưu bao lâu?”, “Làm sao để đăng ký sử dụng ColdTrack?”. Giữ `answer: null` và thông báo đang cập nhật khi mở; không tự tạo chính sách. Câu trả lời FAQ đầu điều chỉnh theo tra cứu mẫu thực tế.
- Có nhãn dữ liệu/testimonial minh họa và ghi chú xác nhận số liệu, liên hệ. Đây là phần bổ sung có chủ đích cho bản prototype.

## Mock và việc cần xác nhận trước khi công bố

- Marketing `99,9%`, `24/7`, `±0,5°C`, “dưới 30 giây” nằm trong file nội dung, **cần người phụ trách xác nhận** bằng số liệu thực trước khi công bố; không được dùng làm cam kết vận hành.
- Xác nhận quyền sử dụng tên, chức danh và trích dẫn của 3 testimonial mẫu từ Stitch; thay bằng đánh giá thật khi được cho phép.
- Xác nhận số `1900 6868`, email `contact@coldtrack.vn`, nội dung bản quyền, nội dung footer và các CTA. Liên hệ hiện là mẫu từ thiết kế và có nhãn rõ.
- Hoàn thiện 4 FAQ còn thiếu; xác nhận chính sách mất kết nối, lưu trữ, quyền xem dữ liệu và quy trình đăng ký thật.
- Khoảng nhiệt độ lấy từ cùng `customerMockConfig` trong `src/mock/customer.ts` với màn Tạo lô hàng, kết hợp giới hạn hệ thống hiện có; không đặt giới hạn trong component landing. Cần backend và người phụ trách nghiệp vụ xác nhận preset trước khi dùng thực tế.
- LandingService trả dữ liệu công khai tổng hợp từ mock riêng, không xuất danh sách lô hàng/định danh riêng tư của B2–B4. Cần thay bằng endpoint public tracking có kiểm soát khi có backend; dashboard, hành trình, nhiệt độ, thời gian và testimonial hiện là mock.
- Giữ cờ `VITE_DEMO` hiện có: bật công cụ giả lập dữ liệu/rỗng/lỗi khi true; tắt không biến mock thành backend thật. AuthContext/AuthService hiện có vẫn giả lập, trạng thái đăng nhập trong bộ nhớ và mất khi tải lại trang. Cần thay session/API phía service khi có backend; không thêm cơ chế đăng nhập riêng cho landing.

## Xem thử

Chạy trong `D:\DoAnTotNghiep\coldtrack-web`: `npm.cmd run dev`, rồi mở URL Vite in ra và vào `/`. Kiểm tra browser script khi dev server chạy cổng 5178: `npm.cmd run dev -- --host 127.0.0.1 --port 5178`, sau đó `node scripts/check-landing-browser.mjs` ở terminal khác.
