# B1 — Xác thực ColdTrack Web

Triển khai cục bộ, không triển khai hosting. Tham chiếu trực tiếp HTML của 6 màn desktop trong Stitch project `18073025285101425800`.

## Route và thiết kế

| Route | Màn | Stitch screen |
|---|---|---|
| `/login` | Đăng nhập | `1a5e4999162f4006b82cca389a7b9128` |
| `/forgot-password` | Quên mật khẩu, kết quả gửi email | `ec8d49d0d5dd4724b1ad52a3d3676dc2` |
| `/reset/expired` | Liên kết hết hạn hoặc thiếu token | `eca728d4496f44e480671924ede1e71b` |
| `/reset?token=…` | Đặt lại mật khẩu | `46be44938f694d4c91396e2d6f45a716` |
| `/reset/success` | Đặt lại thành công | `2fb8082dc3bb477eb60888019f069946` |
| `/register` | Đăng ký khách hàng | `222b6b6b3d6f48308fbfe531cb5cc7ed` |

## File tạo/sửa

Đường dẫn dưới đây tính từ `coldtrack-web/`:

- Sửa `src/App.tsx`: thay ba placeholder auth bằng màn hoạt động; giữ các route B2 hiện có.
- Sửa `src/auth/AuthContext.tsx`: ban đầu chưa đăng nhập; đăng nhập qua kết quả service; chặn đổi vai trò/đăng nhập nhanh khi demo tắt; logout xóa phiên trong bộ nhớ.
- Tạo `src/auth/service.ts`: interface `AuthService`, adapter giả lập, lỗi có trường tương ứng, chuyển hướng theo vai trò.
- Tạo `src/auth/validation.ts`: validate email, mật khẩu, xác nhận, tên, điện thoại, điều khoản.
- Tạo `src/mock/auth.ts`: thông số giả lập, thời hạn token, tài khoản từ nguồn mock cũ, dữ liệu telemetry, placeholder và email hỗ trợ.
- Tạo `src/components/common/Auth.tsx`, `src/components/common/auth.css`: layout hai panel, logo, heading, field, nút, thông báo và responsive.
- Tạo `src/pages/auth/AuthPages.tsx`: xử lý form, loading, lỗi, thành công và token.
- Sửa `src/pages/auth/LoginPage.tsx`, `ForgotPasswordPage.tsx`, `ResetExpiredPage.tsx`: dùng triển khai chung.
- Tạo `src/pages/auth/ResetPasswordPage.tsx`, `ResetSuccessPage.tsx`, `RegisterPage.tsx`: entry component cho từng route.
- Tạo `src/auth/validation.test.ts`, `service.test.ts`, `flows.test.tsx`.
- Tạo `scripts/check-auth-browser.mjs`, `scripts/check-auth-demo.mjs`: kiểm tra Chrome và chụp ảnh.
- Sửa `index.html`: ngôn ngữ tiếng Việt, tiêu đề ColdTrack, tải font Inter.
- Sửa `package.json`, `package-lock.json`: thư viện kiểm thử DOM/trình duyệt, không thêm framework ứng dụng.
- Tạo tài liệu này tại `docs/B1-AUTH-HANDOFF.md` ở thư mục gốc workspace.
- Ảnh kiểm tra ở `coldtrack-web/artifacts/auth/`; thư mục `dist/` là kết quả build.

## Kiểm thử

- `npm.cmd test`: **59/59 pass**, bao gồm toàn bộ **26 test cũ** và **33 test mới**.
- `npm.cmd run build`: TypeScript và Vite build **PASS**, không đặt `VITE_DEMO=true`.
- Chrome: 6 route × 5 width (1440, 1280, 1024, 390, 320 px); không cuộn ngang và không có lỗi JavaScript.
- Luồng demo thực tế: gửi email → mở liên kết → đặt mật khẩu → thành công → đăng nhập bằng mật khẩu mới → từ chối token đã sử dụng. Form reset có token hợp lệ được kiểm tra thêm ở cả 5 width.
- Test DOM: điều hướng, lỗi phía client, loading, sai thông tin, đăng nhập ba vai trò, đăng ký, gửi lại email, token thiếu/không hợp lệ, reset thành công và Google SSO chưa kết nối.
- Test service: email phải khớp đầy đủ, mật khẩu phải đúng, trùng email, hạn token ở đúng biên thời gian, dùng một lần, vô hiệu hóa tất cả token cũ sau reset, không lộ link preview khi demo tắt.

Chạy lại kiểm tra browser: mở Vite tại `127.0.0.1:5173` với demo tắt và tại `127.0.0.1:5174` với `VITE_DEMO=true`, rồi chạy hai script bằng Node. Các script mặc định dùng Chrome đã cài tại `C:/Program Files/Google/Chrome/Application/chrome.exe`; đổi đường dẫn nếu môi trường khác. Ảnh gồm desktop và mobile, cả reset với token hợp lệ.

## Khác biệt và quyết định

- Theo `RULES.md`, nội dung chỉ nói về thực phẩm đông lạnh, dùng 87.5% từ mock chung, bỏ chứng nhận ISO/GDP và khẳng định SSL. Đây là các khác biệt nội dung có chủ đích so với Stitch.
- Giữ tỷ lệ panel 50/50, navy `#0F172A`, xanh `#2563EB`, font Inter, form 400px (đăng ký 440px), input/nút bo góc 8px. Dưới 1024px ẩn panel thương hiệu như HTML responsive của Stitch.
- Logo dựng bằng Lucide Snowflake và chữ; họa tiết nền là lưới CSS thay cho texture mạng/map SVG và ảnh logo trong export. Không bảo đảm giống từng pixel ở hai chi tiết này.
- Telemetry được gom vào mock chung, giá trị trong ngưỡng hiển thị cùng nhãn. Không hardcode thông số mẫu vào màn.
- Form khởi đầu trống thay cho các giá trị điền sẵn trong Stitch; lỗi xuất hiện theo thao tác, không luôn bật như trạng thái review của export đăng ký.
- Nhãn đăng nhập giữ “Email hoặc tên đăng nhập” theo thiết kế; hiện adapter chỉ chấp nhận email đúng định dạng theo yêu cầu B1. Chưa hỗ trợ alias tên đăng nhập.
- Đăng ký thành công hiển thị ngay tại `/register` rồi có liên kết đăng nhập; không tạo route thứ bảy. Trang thành công reset không tự động chuyển hướng.
- Google SSO và nội dung điều khoản/chính sách chưa có backend/nội dung thật: thao tác hiện thông báo chưa kết nối/đang cập nhật. Không giả vờ xác thực hay phát hành văn bản pháp lý.
- Email hỗ trợ trong mock cần được thay bằng địa chỉ vận hành thật.

## Phần cần thay khi có backend

`authService` đang sử dụng `createMockAuthService` vì chưa có API. Cờ **`VITE_DEMO` giữ nguyên**, điều khiển công cụ demo và link mở email giả lập. Tắt demo không biến mock thành xác thực backend: form vẫn gọi cùng interface service để kiểm thử luồng thủ công; link preview và tài khoản điền nhanh bị ẩn.

- Thay adapter bằng HTTP implementation của `AuthService`: login, register, requestReset, inspectToken, resetPassword. Xử lý lỗi server thành `AuthError` với `field` tương ứng.
- Backend gửi email thật, tạo/kiểm tra token, giới hạn tần suất và lưu mật khẩu đã băm. Mock chỉ mô phỏng thời hạn và tính dùng một lần, không gửi email.
- Tài khoản đăng ký, mật khẩu đã đổi, token và trạng thái đăng nhập hiện chỉ nằm trong bộ nhớ. Reload trang khởi tạo lại mock và yêu cầu đăng nhập; token mới không tồn tại qua reload/tab khác. Đây là giới hạn của adapter phát triển, chưa phải session backend.
- Backend cần cơ chế session/cookie và khôi phục phiên; frontend hiện không lưu mật khẩu hay tự tin vào vai trò trong localStorage. Thực thi quyền thật phải ở server.
- Bật `VITE_DEMO=true` để điền tài khoản mẫu và mở liên kết reset trong cùng phiên SPA. Tài khoản mẫu từ `MOCK_USERS`, mật khẩu mẫu trong `src/mock/auth.ts` (`ColdTrack2026`). Tắt demo để kiểm tra bản không có công cụ mô phỏng.
- Thay dữ liệu telemetry, email hỗ trợ và chính sách mật khẩu/thời hạn token bằng cấu hình/API theo hợp đồng backend khi có.
