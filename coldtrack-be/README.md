# ColdTrack Backend

## Bước 0.1 — API

API dùng `@nestjs/config`, đọc `.env` tại gốc workspace (`D:/DoAnTotNghiep/.env`)
khi chạy các script npm trong tài liệu này. Biến môi trường của tiến trình được ưu tiên,
nên có thể truyền `DATABASE_URL` riêng cho integration test. `DATABASE_URL` bắt buộc;
`PORT` mặc định 3000, không được dùng 54321–54324.

Từ gốc workspace, sao chép `.env.example` thành `.env`, rồi chạy:

```powershell
npm run lint
npm test
npm run build
npm start
```

`npm test` gồm unit test env và integration test HTTP với PostgreSQL thật qua
`DATABASE_URL`; cần Supabase local đang chạy. Test chỉ chạy `select 1`, không tạo bảng.
`GET http://localhost:3000/api/v1/health` trả HTTP 200 với
`{"status":"ok","db":"ok"}` hoặc `{"status":"ok","db":"error"}`.
API tiếp tục chạy khi DB mất kết nối và kiểm tra lại DB trong từng request.

Khung domain hiện gồm `shipments`, `trips`, `devices`; chưa có logic nghiệp vụ.
Module DB xuất token `DATABASE` (Kysely), đóng pool khi ứng dụng shutdown.
API hiện dùng `apps/api/src/app.ts`, không dùng bootstrap hạ tầng cũ bên dưới.
Các hướng dẫn `/health/live`, `/health/ready`, OpenAPI bên dưới chỉ mô tả khung cũ;
ingest/worker được giữ nguyên ngoài phạm vi bước 0.1.

Thư mục này dành riêng cho backend, tách khỏi frontend web tại `../coldtrack-web/`.

Trạng thái: đã cài dependency và tạo khung hạ tầng API, ingest, worker. Chưa triển khai nghiệp vụ, Auth/RLS của ứng dụng, schema lô/chuyến hoặc pipeline telemetry/outbox.

Thiết kế và ERD: [BE-SYSTEM-DESIGN.md](../docs/BE-SYSTEM-DESIGN.md).

## Công nghệ

- NestJS API ghi nghiệp vụ.
- MQTT ingest và worker chạy ngoài Supabase.
- Kysely truy vấn database; Supabase CLI quản lý migration duy nhất.
- Supabase Auth, Database, Storage, Realtime và RLS.
- Simulator 5–7 xe cho demo.

NestJS 12, TypeScript, Kysely + pg, MQTT.js, Supabase SDK, JOSE, Zod, Helmet và OpenAPI. Supabase CLI được cài local qua npm; phiên bản khóa trong package-lock.json. Không cần cài Nest/Supabase global.

## Cấu trúc

```text
coldtrack-be/
├── apps/api/src/          # HTTP API, mặc định 3000
├── apps/ingest/src/       # Tiến trình ingest riêng, health trên 3001
├── apps/worker/src/       # Tiến trình worker riêng, health trên 3002
├── libs/platform/        # Cấu hình, DB/MQTT resources, health và bootstrap chung
├── infra/mosquitto/      # Broker, ACL và credential local không commit
├── scripts/              # Cấp credential local và kiểm tra hạ tầng
├── supabase/             # Cấu hình local; migration SQL ứng dụng sẽ đặt tại đây
├── .env.example          # Tên biến môi trường, không chứa secret thật
└── compose.yaml          # Mosquitto local
```

## Chuẩn bị môi trường local

Cần Node.js >=22.12, npm và Docker Desktop với Linux containers đang chạy. Chạy từ thư mục `coldtrack-be`:

```powershell
npm.cmd ci
npm.cmd run db:start
npm.cmd run local:configure
npm.cmd run mqtt:up
npm.cmd run build
npm.cmd run check:local
```

`db:start` chạy bộ cần thiết gồm Database, Auth, Storage, Realtime, Data API và email local; bỏ Studio/metadata/analytics/Edge Runtime để giảm tài nguyên. Lần đầu tải image Supabase; thông tin kết nối lấy từ CLI, không cần tài khoản Supabase cloud. Chưa liên kết project cloud hoặc đẩy migration lên dịch vụ ngoài. Studio đã tải nhưng không vượt health check khi khởi động đầy đủ trên máy này; nếu cần thử lại bộ đầy đủ, dừng stack rồi chạy `npm.cmd run db:start:full`.

`local:configure` chỉ dành stack mặc định tại 127.0.0.1:54321/54322. Lệnh tạo `.env`, ba DB login riêng cho API/ingest/worker và password hash Mosquitto. DB login chưa có quyền nghiệp vụ; các quyền bảng/function sẽ được cấp bằng migration sau. Script chỉ bootstrap credential local, không quản lý schema ứng dụng và không in secret.

Credential thiết bị thử `TB-0001` nằm trong `infra/mosquitto/device.env` đã được ignore. `.env`, password file, log CLI và credential thiết bị không đưa vào Git/frontend. Chạy lại `local:configure` sau reset DB nếu cần.

Broker local dùng MQTT không TLS trên cổng **chỉ bind 127.0.0.1:1883**, có username/password và ACL. Đây là chế độ phát triển trên máy; không mở broker này cho ESP32 qua LAN/Internet. Khi tích hợp phần cứng cần listener TLS, CA và credential riêng. Mặc định khung code từ chối MQTT plaintext ngoài loopback hoặc trong production.

Mosquitto `acl_file` bảo vệ việc publish/nhận dữ liệu. Broker có thể chấp nhận SUBSCRIBE topic khác nhưng không giao bản tin nếu thiếu quyền đọc; kiểm tra local xác minh không nhận được dữ liệu topic thiết bị khác. Nếu cần từ chối ngay yêu cầu SUBSCRIBE, bổ sung plugin hỗ trợ ACL subscription khi tích hợp thiết bị; chưa tuyên bố đã có cơ chế này trong khung local.

## Chạy các tiến trình

Mở ba terminal tại `coldtrack-be/`:

```powershell
npm.cmd run dev:api
```

```powershell
npm.cmd run dev:ingest
```

```powershell
npm.cmd run dev:worker
```

- API: http://127.0.0.1:3000/health/live
- OpenAPI: http://127.0.0.1:3000/api/docs (chỉ development)
- Ingest: http://127.0.0.1:3001/health/live
- Worker: http://127.0.0.1:3002/health/live
- Supabase Studio: không chạy trong cấu hình tối giản; khi chạy bộ đầy đủ, dùng http://127.0.0.1:54323.
- Mỗi tiến trình có `/health/ready`: 200 khi dependency cần thiết đã kết nối; 503 nếu thiếu cấu hình hoặc mất kết nối. Readiness chỉ kiểm tra hạ tầng, chưa khẳng định nghiệp vụ đã hoàn thiện.

Ingest/worker hiện kết nối broker nhưng **chưa subscribe telemetry, ACK dữ liệu SD hoặc publish lệnh**. Không ACK trước khi pipeline lưu DB được triển khai. Chưa có API nghiệp vụ và simulator; đây là khung để tiếp tục các giai đoạn đã duyệt.

## Kiểm tra và migration

```powershell
npm.cmd run typecheck
npm.cmd run build
npm.cmd run format:check
npm.cmd run check:local
npm.cmd run db:migration -- ten_migration
```

`check:local` kiểm tra ba tiến trình trên cổng thử 3300–3302, readiness DB/MQTT, OpenAPI và ACL thiết bị. Không tạo lô, tài khoản khách hoặc gửi lệnh tới phần cứng.

Supabase CLI là công cụ migration duy nhất. Không dùng Kysely migrator hoặc hệ migration ORM khác. Chưa có migration nghiệp vụ ở giai đoạn cài đặt.

Tắt dịch vụ local: `npm.cmd run mqtt:down` và `npm.cmd run db:stop`. Các lệnh này không chủ động xóa volume dữ liệu. `db:reset` là lệnh xóa và dựng lại database local, chỉ dùng khi cần reset môi trường phát triển.
