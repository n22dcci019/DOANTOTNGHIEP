# ColdTrack Backend

## Bước 1.2 — Xe, thiết bị và phân công

Migration `../supabase/migrations/*_resources_vehicles_devices.sql` bổ sung bốn
bảng, không sửa migration 1.1 và không thêm dữ liệu demo. Status theo quyết định
đã chốt của bước 1.2: xe `active` (mặc định), `maintenance`, `inactive`; thiết bị
`active` (mặc định), `disabled`, `retired`. Online/offline không thuộc status này.
Các timestamp là `timestamptz`; reuse trigger cập nhật timestamp của bước 1.1.

Hai partial unique index `WHERE valid_to IS NULL` giới hạn một phân công mở
cho mỗi thiết bị và mỗi xe. Phải đóng phân công cũ trước khi mở phân công mới.
Không chặn chồng lấn giữa các khoảng lịch sử đã đóng. `devices.vehicle_id`
và lịch sử phân công sẽ được đồng bộ trong transaction server khi triển khai API;
migration này không tự tạo trigger đồng bộ hoặc logic chuyến.

RLS dùng lại `current_account_role()` và `has_permission()`. Chỉ admin active có
quyền đọc tài nguyên theo permission; driver/customer chưa có policy vì cần phạm
vi chuyến ở bước 1.3/1.7. Client không có quyền ghi trên cả bốn bảng. Credential
không có SELECT grant/policy cho bất kỳ client nào, kể cả admin.

`libs/credentials/mosquitto-hash.ts` cung cấp hàm async
`hashMosquittoCredential(password)` bằng crypto chuẩn của Node: PBKDF2-HMAC-SHA512,
220.000 vòng, salt ngẫu nhiên 64 byte, derived key 64 byte. Kết quả là phần hash
`$7$iterations$base64(salt)$base64(digest)` tương thích `mosquitto_passwd
-H sha512-pbkdf2`, không chứa username hoặc password rõ. Chọn thuật toán này để
dùng trực tiếp định dạng password file Mosquitto; chỉ định rõ thuật toán thay vì
phụ thuộc default của từng phiên bản. Số vòng cao làm tăng chi phí thử mật khẩu;
cần đo hiệu năng broker trước khi provisioning thiết bị thật ở bước 1.9.
Tham chiếu: https://mosquitto.org/man/mosquitto_passwd-1.html.

DB chấp nhận salt 12 byte của định dạng cũ và 64 byte của định dạng mới.
DB kiểm tra định dạng hash và partial unique index `WHERE active` bảo đảm tối đa
một credential active/thiết bị. `provisioning_status` giữ dạng text nullable như
đặc tả, không tự đặt enum trước bước provisioning. Hàm hash không lưu credential,
không ghi password file hay cấp tài khoản thiết bị. Không thể xác minh một giá trị
thật sự là hash chỉ bằng cấu trúc chuỗi; server phải dùng hàm hash thay vì nhận
`credential_hash` do client gửi vào.

Chạy `npm run db:reset`, `npm run lint`, `npm test`, `npm run build` tại
`coldtrack-be/` (reset xóa dữ liệu local project gốc `DoAnTotNghiep`). Test mới
dùng PostgreSQL thật, fixture trong transaction rollback, cộng hai container
Mosquitto tạm `--network none --rm` không publish cổng: đối chiếu hash native và
kiểm chứng broker chấp nhận hash 220.000 vòng. Cần Docker đang chạy và có image
`eclipse-mosquitto:2`; không dùng credential thật, không sửa broker Compose/ACL.

## Bước 1.1 — Baseline tài khoản

Project Supabase hiện hành là `DoAnTotNghiep`, cấu hình tại
`../supabase/config.toml`; migration duy nhất cho bước này nằm trong
`../supabase/migrations/`. Không dùng `coldtrack-be/supabase/` để migrate/reset.
Các script `db:*` đã thêm `--workdir ..` để trỏ đúng project gốc.

Migration tạo `roles`, `permissions`, `role_permissions`, `profiles`,
`account_access`, hai helper RLS và dữ liệu tham chiếu hệ thống. Client chỉ
được SELECT theo RLS, không được ghi kể cả hồ sơ của mình. `profiles.update`
là capability dành cho PATCH /me bước 2.2, không phải SQL UPDATE grant.
Helper chỉ nhận vai trò/quyền của account active từ DB, không tin role metadata JWT.
Permission không thay thế việc kiểm tra chủ sở hữu, chuyến và trạng thái ở bước sau.

```powershell
# Chạy tại coldtrack-be/, sau khi xác minh stack DoAnTotNghiep:
npm run db:status
# Lệnh sau XÓA dữ liệu local rồi dựng lại từ migrations:
npm run db:reset
npm run lint
npm test
npm run build
```

Integration test dùng `DATABASE_URL` từ môi trường hoặc `.env` gốc. Test tạo user
trong `auth.users` bằng Supabase Auth Admin với service-role key, tạo fixture
public bằng SQL `service_role`, rồi kiểm thử `SET LOCAL ROLE authenticated/anon`
và JWT claims trên PostgreSQL thật. Fixture public luôn rollback; Auth fixtures
được xóa sau test. Không có seed demo. Key lấy từ `SUPABASE_SERVICE_ROLE_KEY`
nếu được truyền; nếu thiếu, test đọc qua Supabase CLI `status` ở project gốc,
không ghi key ra file/log. `SUPABASE_URL` mặc định `http://127.0.0.1:54321`.
Không cấp INSERT trực tiếp vào `auth.users` cho service_role để phục vụ test.
Schema dùng `timestamptz` và cập nhật `updated_at` bằng trigger.

## Bước 0.2 — Docker Compose TLS

Compose có bốn service `mosquitto`, `api`, `ingest`, `publisher` (dùng `apps/worker`).
Supabase chạy riêng trên host; không thêm service PostgreSQL. Cả ba app dùng
`DATABASE_URL=postgresql://postgres:postgres@host.docker.internal:54322/postgres`.
Chỉ publish cổng loopback 3000 (API) và 8883 (MQTT TLS).

Chạy tại `coldtrack-be/`, với Docker Desktop và Supabase local đang chạy:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File infra/mosquitto/scripts/gen-certs.ps1
docker compose config --quiet
docker compose up -d --build
docker compose ps
curl.exe -i http://localhost:3000/api/v1/health
docker compose exec -T mosquitto sh /mosquitto/scripts/test-tls.sh
docker compose logs ingest publisher
```

Script thiết lập chạy một lần, dùng OpenSSL trong container tạm để tạo CA local,
chứng chỉ server có SAN `mosquitto`, `localhost`, `127.0.0.1` (hạn 365 ngày),
và mật khẩu ngẫu nhiên cho `coldtrack-test`. Không in mật khẩu; script từ chối
ghi đè credential đã có. `certs/` và `secrets/` được ignore; không commit chúng.
Nếu cần dùng client khác: username `coldtrack-test`, password đọc từ
`infra/mosquitto/secrets/test-password`, CA là `infra/mosquitto/certs/ca.crt`.
Không tắt kiểm tra chứng chỉ TLS. User này chỉ được đọc/ghi `coldtrack/test/#`.
Password/ACL thiết bị cũ được giữ trên đĩa nhưng không được broker dùng ở bước 0.2;
provisioning và ACL theo thiết bị thuộc bước 1.9. Không chạy `local:configure`
để tạo credential cho bước này.

Ingest/publisher chỉ kiểm tra DB bằng `select 1`, kết nối MQTT và ghi log
`DB connected` / `MQTT connected`; không subscribe, ACK hay publish nghiệp vụ,
không mở HTTP endpoint. DB/MQTT lỗi thì ghi log và thử lại sau 5 giây.
API health vẫn HTTP 200 khi DB lỗi; Docker healthcheck chuyển unhealthy.
Trước khi Compose chạy cần dừng API host cũ nếu đang chiếm cổng 3000.

Kiểm tra DB tắt/khôi phục, không dùng `db:reset`:

```powershell
npm run db:stop
curl.exe -i http://localhost:3000/api/v1/health
npm run db:start
curl.exe -i http://localhost:3000/api/v1/health
```

`docker compose stop` dừng bốn service, giữ volume MQTT và stack Supabase riêng.
Phần hướng dẫn hạ tầng plaintext/credential tự động cũ phía dưới là lịch sử,
không áp dụng cho Compose TLS của bước 0.2.

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
