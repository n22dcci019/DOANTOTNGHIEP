# ColdTrack Backend

## Bước 2.5 — Cấu hình nhiệt và lệnh queued

Không thêm migration hoặc quyền. POST `/api/v1/trips/:id/temperature-configs`
chỉ admin có `temperature_configs.create`, bắt buộc Idempotency-Key và body
`target_min`, `target_max`, `version` của trip. Dải trong [-25,-15], bội 0.5 và
độ rộng ít nhất 2°C; dải sai trả 400 VALIDATION_FAILED. Chuyến phải scheduled
hoặc in_transit, khác trả 422 UNPROCESSABLE; version cũ trả 409 VERSION_CONFLICT.

**Chủ đích đã chốt:** tạo cấu hình kiểm tra nhưng không tăng `trips.version`.
API khóa shipment → trip → device; lấy và tăng `devices.next_config_version_no`
trong transaction. Counter theo thiết bị tăng xuyên các chuyến, không reset.
Hai request đồng thời cùng version trip đều có thể trả 201, nhận hai số cấu hình
khác nhau; cấu hình được tạo sau supersede cấu hình trước. `version` trong dòng
cấu hình là version của bản ghi cấu hình, khác với trips.version và config_version_no.

Cùng transaction: supersede mọi config approved/sent của thiết bị và tăng version
các dòng đó; fail mọi command queued/sent với superseded_command; tạo config mới
approved, command set_target_range queued, outbox pending và audit cho mọi thao tác.
Wire payload có schema_version=1, command_id UUID, type=set_target_range,
config_version_no, target_min/max, issued_at UTC, expires_at=issued_at+30 giây.
Outbox dùng topic `device_command.enqueued`, payload chỉ command_id/device_id.
Response 201 có id cấu hình, config_version_no, command_id. Config applied/failed
và command đã kết thúc được giữ nguyên. Rollback hoàn tác cả counter/supersession,
các dòng mới và audit; test kiểm chứng bằng lỗi constraint thật ở cuối transaction.

GET `/api/v1/trips/:id/temperature-configs`: admin/driver được giao; ngoài phạm vi
và customer trả 404. GET `/api/v1/device-commands/:command_id` trả metadata trạng
thái/failure_reason và `acks` (ack_id, result, reason, retry_after_seconds, received_at)
cho admin/driver được giao; ngoài phạm vi trả 404, không có command payload hay raw ACK.
ACK reader dùng bigint FK nội bộ; UUID command_id là định danh trên API/wire.

Depart chọn cấu hình có config_version_no lớn nhất của chuyến, status khác
superseded, kiểm tra device_latest_state.config_version_no khớp và mẫu tươi trong
60 giây, rồi gán departure_config_version_id cùng transaction khởi hành. Không chờ
ACK applied. Không có config hợp lệ thì giữ hành vi 2.4, departure_config_version_id=null.
Cấu hình tạo khi in_transit không thay đổi pin cấu hình tại thời điểm departure.

API không import MQTT, không publish, không đọc/xử lý outbox. Event của command cũ
đã superseded vẫn pending; publisher 2.7 phải đối chiếu trạng thái command trước gửi.
ACK ingest chưa triển khai (3.1); test ACK reader chèn ACK bằng SQL. Telemetry trong
test cũng được chèn SQL, không kiểm thử ingest. Chưa relay tay hoặc retry/publisher.
Giới hạn crash giữa commit nghiệp vụ và lưu response idempotency 2.1 vẫn còn.

`test:temperature-configs` chạy riêng sau trips, trước reset seed, giữ audit append-only.
Ca không publish dùng MQTT subscriber thật của SIM-01, chỉ subscribe (không publish
probe); cần broker 1.9 đang chạy với credential đã provision và chứng chỉ local.
Nó xác nhận không nhận UUID lệnh mới, command vẫn queued, outbox pending/attempts=0,
không có command attempt. Sau toàn bộ test khôi phục seed/device/service/MQTT như runbook.

## Bước 2.4 — Chuyến và bằng chứng

Không thêm migration, không thay cấu hình Auth/Storage hay policy. Mọi mutation
bắt buộc Idempotency-Key và version của **trip**. Tài xế phải active và được giao
chuyến; tài xế khác nhận `404 NOT_FOUND`, khách/admin gọi depart nhận `403 FORBIDDEN`.

| Endpoint | Điều kiện / kết quả |
|---|---|
| POST /api/v1/trips/:id/depart | trips.depart; scheduled; last_fresh_sample_at trong 60 giây; trả 200 |
| POST /api/v1/trips/:id/complete | trips.complete; in_transit, có delivery_proofs; trả 200 |
| POST /api/v1/trips/:id/proof | delivery_proofs.upload; in_transit; multipart; trả 201 |
| PATCH /api/v1/trips/:id/notes | trips.update_notes; scheduled/in_transit; body version, driver_notes |
| GET /api/v1/trips; GET /api/v1/trips/:id | admin thấy tất cả; driver chỉ chuyến của mình; customer dùng view |

Depart/complete khóa shipment trước rồi trip theo cùng thứ tự với API hủy lô.
Trạng thái chuyến và lô phải tương ứng; sai trạng thái/telemetry thiếu hoặc cũ/
complete thiếu bằng chứng trả `422 UNPROCESSABLE`. Trạng thái được kiểm tra trước
version: hai request depart khác key đồng thời trả đúng một 200 và một 422;
version cũ khi chuyến còn scheduled trả `409 VERSION_CONFLICT`.
Depart cập nhật cả hai sang in_transit và đặt departed_at. Complete đặt cả hai
completed, completed_at, result=pending_evaluation; không tự pass/fail. Version
của cả hai tăng trong cùng transaction với audit. Notes chỉ sửa driver_notes
và tăng version trip; các trường khác bị từ chối.

Upload dùng field `file`, `version` và `signed_by` tùy chọn. Version multipart là
chuỗi số nguyên; JSON depart/complete/notes dùng số nguyên. Chỉ nhận JPEG/PNG có
magic bytes phù hợp MIME, tối đa **5 × 1024 × 1024 byte**, kể cả đúng biên 5 MB.
Không lấy tên hoặc đường dẫn do client gửi để đặt object. Server dùng service role
ghi `delivery-proofs/proofs/{trip_id}/{uuid}.jpg|png`; bucket vẫn private, client
không được đọc object trực tiếp. Proof thành công trả photo_path và trip_version
mới để complete; gửi proof thứ hai khác key trả `409 CONFLICT`.

Global upload interceptor chạy sau guard và trước idempotency: hash tính trên các
field và SHA-256 của bytes ảnh, không phụ thuộc boundary multipart hoặc tên file.
Cùng key/cùng ảnh replay response; cùng key/khác ảnh trả IDEMPOTENCY_KEY_REUSED.
Ảnh không vào response, log hoặc audit. Proof ghi audit cho delivery_proofs và
version trip. Nếu DB thất bại sau Storage upload, service xóa object vừa tạo;
cleanup thất bại ghi request_id/path để xử lý thủ công và trả INTERNAL.

Giới hạn bước này: telemetry trong test được chèn trực tiếp vào device_latest_state
và telemetry_readings; **chưa kiểm thử ingest/MQTT**, để BE-3.1. Kiểm tra cấu hình
nhiệt/config_version_no đã được bổ sung ở BE-2.5 phía trên; test 2.4 vẫn dùng chuyến chưa cấu hình.
Đánh giá pass/fail để 3.6. GET chưa phân trang; chưa thêm endpoint signed URL.
Storage/DB không có distributed transaction: process crash giữa upload và commit
có thể để lại object cần dọn. Giới hạn crash giữa commit DB và lưu response của
interceptor idempotency 2.1 vẫn còn.

`test:trips` dùng PostgreSQL/Auth/Storage local thật. Test xóa các object Storage
do mình tạo, giữ audit append-only đến reset của test:seed. Chuỗi `npm test` chạy
core → profiles → shipments → trips → seed/reset → MQTT; sau đó khôi phục bốn
lệnh seed/device/service/MQTT theo runbook bên dưới.

## Bước 2.3 — API lô hàng

Không thêm migration hoặc trigger. Dùng CHECK dải nhiệt và bốn partial unique index
trên tài nguyên chuyến từ BE-1. Các route `/api/v1/shipments` đi qua guard, kiểm tra
account_access/quyền mỗi request và dùng envelope lỗi chuẩn.

| Endpoint | Quyền / trạng thái |
|---|---|
| POST /shipments | customer, shipments.create; tạo draft/version 1, trả 201 |
| PATCH /shipments/:id | customer chủ sở hữu, shipments.update; draft/pending_review |
| POST /shipments/:id/submit | customer chủ sở hữu, shipments.submit; draft → pending_review |
| POST /shipments/:id/approve | admin, shipments.approve; pending_review → approved |
| POST /shipments/:id/reject | admin, shipments.reject; pending_review → rejected, cần rejected_reason |
| POST /shipments/:id/assign | admin, shipments.assign; approved → scheduled và tạo trip scheduled |
| POST /shipments/:id/cancel | shipments.cancel; customer: draft/pending_review; admin: thêm approved/scheduled |
| GET /shipments; GET /shipments/:id | customer chỉ lô của mình; admin tất cả; driver trả 404 |

POST nhận product_type, temp_min, temp_max, warehouse_notes tùy chọn. `customer_id`
nếu gửi lên bị bỏ qua; chủ lô lấy từ principal đã xác thực. Create khởi tạo version 1
vì chưa có entity trước đó; mọi cập nhật/action sau create bắt buộc body.version.
Mọi mutation bắt buộc Idempotency-Key UUID. PATCH không cho sửa chủ hoặc status;
chỉ các action nêu trên đổi trạng thái. Từ chối cần lý do không rỗng sau khi trim;
rejected/cancelled là trạng thái cuối của các thao tác bước này.

Mã lỗi thống nhất: sửa/hủy sai trạng thái và tài nguyên không active/không đủ dải
trả `422 UNPROCESSABLE`; tranh tài nguyên chuyến trả `409 CONFLICT`; version cũ
trả `409 VERSION_CONFLICT` với current_version. Ngoài phạm vi và không tồn tại
đều trả `404 NOT_FOUND`. Dải nhiệt kiểm tra trong API và CHECK DB: [-25,-15],
bước 0.5, độ rộng ít nhất 2°C; PATCH kiểm tra dải sau khi ghép với giá trị hiện có.

Trong transaction service role, API khóa shipment và so version, rồi khóa xe,
account_access tài xế và thiết bị theo thứ tự cố định khi phân công. Xe, tài xế
và thiết bị phải active; tài xế phải có role driver. Xe phải có đủ hai biên nhiệt
để bao phủ dải shipment. Kiểm tra chuyến scheduled/in_transit và unique index DB
ngăn trùng xe/tài xế/thiết bị/lô, kể cả hai request đồng thời.
Phân công tạo trip và đổi shipment cùng transaction, ghi audit cho cả hai.
Admin hủy lô scheduled thì khóa/hủy trip scheduled, tăng version của cả hai
và ghi audit trong cùng transaction. Không đặt lô về approved khi hủy toàn lô.

Test `test:shipments` chạy sau core/profiles, trước reset của seed để cách ly
fixture có audit append-only. Test gây lỗi DB thật kiểm chứng rollback shipment,
trip và audit; không sửa assertion baseline hay nới quyền. `npm test` chạy đủ các
suite rồi cần khôi phục seed/device/service/MQTT theo runbook.

Giới hạn: chưa depart/complete, cấu hình nhiệt/lệnh, publisher hay cảnh báo.
Không thay đổi lịch sử gán thiết bị/xe; không yêu cầu telemetry tươi/online ở assign.
GET list chưa phân trang. Giới hạn crash giữa commit dữ liệu và lưu response của
interceptor idempotency 2.1 vẫn còn; response chưa commit nguyên tử cùng nghiệp vụ.

## Bước 2.2 — Hồ sơ và lời mời

Migration `20261127081646_profiles_invitations_email.sql` thêm `profiles.version`,
unique index `profiles_email_lower_unique`, bảng lời mời chỉ service role truy cập,
và quyền `account.invite`, `account.manage` chỉ gán cho admin. Migration cũ giữ nguyên.

| Endpoint | Quyền / đầu vào |
|---|---|
| PATCH /api/v1/me | `profiles.update`; full_name, phone, email, version; Idempotency-Key |
| POST /api/v1/invitations | `account.invite`; email, role_code; Idempotency-Key; trả 202 |
| POST /api/v1/invitations/accept | Public; token, full_name, password; trả 201 |
| POST /api/v1/accounts/:userId/suspend | `account.manage`; Idempotency-Key |
| POST /api/v1/accounts/:userId/activate | `account.manage`; Idempotency-Key |

Hồ sơ chỉ sửa theo chủ JWT. Version bắt buộc; UPDATE kiểm tra id/version và tăng version
trong cùng câu lệnh, không có trigger version. Email trùng không phân biệt hoa thường
trả `409 CONFLICT`; version cũ trả `409 VERSION_CONFLICT`. Phone bỏ khoảng trắng,
kiểm tra tiền tố `0` hoặc `+84` và 9–10 chữ số theo sau. Admin tự suspend trả
`422 UNPROCESSABLE`. Mọi thao tác thành công ghi audit cùng transaction DB,
không ghi token, mật khẩu hay email vào audit payload.

Lời mời có token ngẫu nhiên 32 byte base64url, DB chỉ lưu SHA-256; thời hạn đúng
72 giờ. Mặc định response không chứa token. Chỉ khi **cả** `NODE_ENV=test` và
`EXPOSE_INVITE_TOKEN_FOR_TEST=true`, response test mới có token. Không bật cờ này
trong môi trường thật. Không ghi token/mật khẩu vào log.
Token expose chỉ được cache trong bộ nhớ khi test để replay; response lưu ở bảng
idempotency luôn bỏ token. Sau khi process test khởi động lại, replay không còn
trả được phần token tùy chọn này. Production không có ngoại lệ đó.

**Ngoại lệ đã duyệt:** accept công khai **không yêu cầu Idempotency-Key**.
Token sai, hết hạn, thu hồi hoặc đã dùng đều trả `404 NOT_FOUND`; token dùng rồi
không replay response. Đăng ký dùng email từ lời mời, full_name và password
8–128 ký tự qua Auth Admin API, xác nhận email theo quyền sở hữu link mời.
Sau khi tạo Auth user, transaction DB khóa lời mời bằng SELECT FOR UPDATE, kiểm tra
lại và tạo profile/account_access active theo role từ DB, đánh dấu used, ghi audit.
Session advisory lock theo hash token tuần tự hóa các accept cùng lời mời trước
Auth creation, tránh GoTrue trả 500 khi hai createUser cạnh tranh email; transaction
nghiệp vụ vẫn bắt đầu sau Auth creation và vẫn kiểm tra lời mời bằng FOR UPDATE.
DB thất bại thì xóa Auth user vừa tạo; lỗi compensation ghi request_id và user_id
ở mức error để xử lý thủ công. Auth và PostgreSQL không có distributed transaction.

Email thay đổi ở PATCH /me chỉ cập nhật `profiles.email`, **không đổi email đăng nhập
trong auth.users**. API vẫn dùng cơ chế claim/replay idempotency bước 2.1; crash giữa
commit dữ liệu và lưu response vẫn là giới hạn hiện có của interceptor.

SMTP lời mời dùng Mailpit riêng trong Compose backend vì Mailpit của Supabase
chỉ expose UI; không thay cấu hình Auth hoặc Supabase. Tại `coldtrack-be/`:

```powershell
docker compose up -d mailpit
```

Trong `.env` gốc: `EMAIL_PROVIDER=mailpit` (mặc định), `MAILPIT_SMTP_HOST=127.0.0.1`,
`MAILPIT_SMTP_PORT=54325`. Inbox lời mời: `http://127.0.0.1:54326`.
Mailpit chỉ bind loopback, không có SMTP relay ra ngoài. `EMAIL_PROVIDER=noop` dùng
NoopEmailSender lưu email trong bộ nhớ khi integration test. Server Auth Admin cần
`SUPABASE_SECRET_KEY` (hoặc `SUPABASE_SERVICE_ROLE_KEY`) trong `.env` đã ignore.

Integration test 2.2 cố ý giữ fixture có audit đã commit: audit là append-only và FK
tham chiếu profile. Vì các suite baseline yêu cầu dataset rỗng, `npm test` chạy
`test:core` trước, rồi `test:profiles` riêng; không đổi assertion hay quyền DB.
`npm test` reset DB ở bước seed tiếp theo để xóa fixture, sau đó
phải chạy lại `db:seed`, `device:provision`, `svc:provision`, `mqtt:sync` như runbook.

## Bước 2.1 — Guard API

API mặc định yêu cầu JWT và kiểm tra `account_access` cùng quyền trong DB mỗi request.
Chỉ route `@Public()` (health) bỏ qua guard. Các route `/_t` chỉ có trong module kiểm thử,
không được đăng ký trong AppModule production.

Đặt `SUPABASE_URL=http://127.0.0.1:54321` trong `.env` ở thư mục gốc repo.
Guard chỉ chấp nhận ES256/HS256, yêu cầu `exp`, audience `authenticated` và issuer
`{SUPABASE_URL}/auth/v1`. ES256 dùng khóa công khai theo `kid` từ JWKS của Supabase;
cache trong bộ nhớ 10 phút, giới hạn tải lại mỗi 60 giây, timeout 3 giây.
Không lấy được khóa cần thiết thì trả `401 UNAUTHENTICATED`.

HS256 chỉ được bật khi `SUPABASE_JWT_SECRET` có giá trị. Tại `coldtrack-be/`, lấy trường
`JWT_SECRET` từ `npm.cmd run --silent db:status -- --output json` và đặt vào `.env`
dưới tên `SUPABASE_JWT_SECRET`. Giữ secret trong file đã ignore, không đưa vào Git/frontend.
Không cần đổi cấu hình Auth hoặc `supabase/config.toml`.

Mọi lỗi có envelope `error: { code, message, details, request_id }` và header `X-Request-Id`.
`@Idempotent()` cung cấp claim/replay cho POST/PATCH/DELETE; `assertVersion` trả
`VERSION_CONFLICT` với `details.current_version`. Chưa có endpoint nghiệp vụ ở bước này.
Các transaction nghiệp vụ ở bước sau vẫn cần commit dữ liệu và response idempotency
trong cùng transaction theo BE-0; interceptor hiện tại chưa cung cấp tính nguyên tử đó.

## Bước 1.9 — MQTT TLS

Trong PowerShell tại `coldtrack-be/`, dùng Supabase local DoAnTotNghiep và chứng chỉ bước 0.2.
Sau khi reset DB, chạy theo thứ tự sau.

```powershell
$localStatus = npm.cmd run --silent db:status -- --output json | ConvertFrom-Json
$env:SUPABASE_URL = $localStatus.API_URL
$env:SUPABASE_SECRET_KEY = $localStatus.SECRET_KEY
npm run db:seed
npm run device:provision
npm run svc:provision
npm run mqtt:sync
docker compose up -d --build mosquitto ingest publisher
docker compose restart mosquitto
```

Simulator đọc `secrets/devices/SIM-XX.env`. Compose đọc hai file `secrets/services/svc-*.env`.
Git bỏ qua các file bí mật, `infra/mosquitto/config/passwd` (hash) và `acl` (sinh từ DB).
Sau reset sạch, provisioning dùng lại mật khẩu trong file hiện có. Thu hồi credential bằng cách
đặt `revoked_at` và `active=false`, sau đó chạy `npm run mqtt:sync -- --restart` để ngắt phiên.
Chạy provisioning với `-- --rotate` để thay credential cả nhóm. Sau khi xoay mật khẩu dịch vụ,
chạy `docker compose up -d --force-recreate ingest publisher` để nạp lại env_file.

`npm test` chạy core, seed rồi MQTT tuần tự. Broker chính dùng 8883. Broker kiểm thử bước 0.2
dùng cổng host 8884, mạng Compose riêng và cùng chứng chỉ. Trong container kiểm thử,
`mosquitto-test.conf` đọc `passwd-test` (mount từ `infra/mosquitto/secrets/passwords`) và `acl-test`.

```powershell
docker compose up -d mosquitto-test
docker compose exec -T mosquitto-test sh /mosquitto/scripts/test-tls.sh
```

## Bước 1.8 — Seed demo và kiểu Kysely

Chạy từ `coldtrack-be/` với stack local `DoAnTotNghiep` đang hoạt động. Lấy URL
và secret key từ CLI vào biến môi trường của terminal, tránh in kết quả status
ra màn hình. `DATABASE_URL` lấy từ `.env` gốc hoặc môi trường hiện tại.

```powershell
$localStatus = npm.cmd run --silent db:status -- --output json | ConvertFrom-Json
$env:SUPABASE_URL = $localStatus.API_URL
$env:SUPABASE_SECRET_KEY = $localStatus.SECRET_KEY
npm run db:reset
npm run db:seed
```

Seed tạo 1 admin, 3 khách và 5 tài xế qua Supabase Auth Admin API. Script server
gán vai trò trong `account_access` và tạo 5 xe với các thiết bị `SIM-01` đến
`SIM-04` và `CT-001`, mỗi thiết bị một phân công mở. Credential Mosquitto thuộc
bước 1.9. Đăng ký tự do chỉ tạo danh tính Auth, còn quyền admin đến từ server.

Thông tin đăng nhập demo được lưu trong `.env.local` đã được Git ignore. Seed
thường giữ nguyên mật khẩu các tài khoản đã tồn tại. Chạy
`npm run db:seed -- --reset-passwords` khi cần đổi chúng. Nếu email demo đã bị
đăng ký ngoài script, seed sẽ báo xung đột và yêu cầu xử lý tài khoản đó trước.

`npm run db:types` chạy `kysely-codegen` trên schema `public` và ghi ra
`libs/database/schema.ts`. Khi thay migration, reset DB local và chạy lại lệnh
này, sau đó đưa file kiểu cùng thay đổi migration vào Git.

`npm run db:types:check` dùng `kysely-codegen --verify` để sinh lại kiểu và so sánh
với file trong checkout. Lệnh trả mã lỗi nếu có drift. **Lệnh reset DB local và
xóa dữ liệu demo.** Repo chưa có workflow CI, nên chạy lệnh kiểm tra thủ công
trên `DoAnTotNghiep` với `DATABASE_URL` trỏ về cổng `54322`. Sau kiểm tra có thể
chạy lại seed để tạo dữ liệu demo.

## Bước 1.3 — Lô, chuyến, giao nhận và phiên thiết bị

Migration `../supabase/migrations/*_shipments_trips.sql` thêm đúng bốn bảng
`shipments`, `trips`, `delivery_proofs`, `device_sessions`; giữ nguyên 1.1/1.2.
Dải shipment trong [-25,-15], min < max, rộng **hơn** 1°C (1°C cũng bị từ chối),
hai biên bội 0.5. Shipment bị từ chối phải có lý do khác rỗng.

Bốn partial unique index riêng trên `shipment_id`, `vehicle_id`, `driver_id`,
`device_id` của trips, với predicate `status IN ('scheduled','in_transit')`,
bảo vệ cả trường hợp scheduled lẫn in_transit. Completed/cancelled không giữ
tài nguyên. CHECK buộc timestamp khởi hành/hoàn thành hợp lệ và tổng manual off
trong [0,1200]. `result` mặc định NULL, không tự pass khi complete. FK của
`departure_config_version_id` chưa tạo, dành bước 1.5.

Client chỉ SELECT theo RLS và helper 1.1: admin đọc shipment chưa xóa mềm và
mọi trip/proof; customer chỉ đọc shipment của mình chưa xóa mềm; driver chỉ
đọc trip/proof của mình, không đọc bảng shipment trực tiếp. Customer không đọc
trực tiếp trips/proofs; view dành cho khách ở bước 1.7. Pending/suspended không
đọc các bảng này; anon không có SELECT. Sessions hoàn toàn server-only. Không
có client write grant/policy trên bất kỳ bảng mới nào.

Không có trigger mới, kể cả trigger cập nhật `updated_at`. API bước 2.x chịu
trách nhiệm cập nhật timestamp và đồng bộ trạng thái lô/chuyến trong cùng một
transaction. Bước này chỉ lưu `photo_path` dạng chuỗi đường dẫn object riêng tư;
chưa tạo bucket, URL ảnh hoặc kiểm tra sự tồn tại object trong Storage.

Migration `*_fix_device_sessions_boot_index.sql` cho phép một boot có nhiều
phiên đã đóng, kể cả trên cùng chuyến. Index thường `(device_id, boot_id)` hỗ trợ
tra cứu. Index unique có điều kiện `ended_at IS NULL` giới hạn mỗi thiết bị tối đa
một phiên mở. `trip_id` có thể là NULL. Việc gán mẫu theo thời gian và monotonic
thuộc các bước ingest sau.

`test/shipments-trips.integration.test.ts` dùng PostgreSQL thật qua DATABASE_URL,
fixture server-side trong transaction được rollback. Kiểm tra constraint, từng
unique index, RLS cho nhiều chủ sở hữu/tài xế, soft delete, quyền proof/session,
không ghi client, timestamp UTC, FK trì hoãn và không tự đổi trạng thái/result.
Mục test m của yêu cầu ghi “năm bảng” nhưng liệt kê bốn: test bao phủ đúng bốn
bảng ở trên, không tạo thêm bảng thứ năm.

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
docker compose up -d mosquitto-test
docker compose exec -T mosquitto-test sh /mosquitto/scripts/test-tls.sh
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
- Demo gồm 4 xe mô phỏng và 1 xe gắn thiết bị thật.

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
