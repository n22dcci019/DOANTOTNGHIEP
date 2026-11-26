# ColdTrack — Plan BE-1 đến BE-3 theo BE-0 v0.5

Ngày15/11/2026. Đầu vào: [BE-0 v0.5 rút gọn](BE-0-thiet-ke-backend-coldtrack.md). Thay plan v0.4 đã lưu riêng. Lượt này chỉ sửa tài liệu, chưa code/migration/firmware.

## Quyết định hiện hành

NestJS/TypeScript,Kysely+pg, Supabase CLI SQL migrations duy nhất. Mosquitto TLS với credential/ACL từng thiết bị; password file server đồng bộ, thu hồi dùng restart broker có kiểm soát, không coi reload là đã ngắt phiên. API/ingest/publisher/simulator chạy process/container riêng trên máy Compose demo; Supabase DB/Auth/Storage/Realtime. Không cam kết miễn phí24/7; kiểm tra quota/mạng DB trước demo.

Relay theo hysteresis min/max, mọi đổi cách>=45 giây. Chỉ admin cấu hình/gửi tay; lệnh tay mặc định600,tối đa1800 giây; tổng thời lượng off đã cấp<=1200/chuyến, không hoàn. Chỉ GPS/NTP cho UTC, thiếu thì unknown. Auto/deadline monotonic độc lập mạng. relay_state là lệnh firmware, không xác nhận máy nén vật lý.

Còn rà soát GPS khách sau chuyến, pending_evaluation/độ phủ chất lượng, trường nhạy cảm/chữ ký và retention sau đo thực tế. Không mở lại danh sách quyết định điều khiển v0.4 để chặn phạm vi mới đã được yêu cầu.

## BE-1 — Dữ liệu, quyền và môi trường

Trước code, query graph module cần sửa, kiểm kê code/migration đã có và baseline DB. Thêm migration tiến cho môi trường đã apply, không viết lại lịch sử hoặc dựng lại dự án chỉ vì đổi đặc tả.

Công việc:

1. DTO/schema theo BE-0 mục3; pin PostgreSQL>=15 cho NULLS NOT DISTINCT. Config_version_no tăng theo device qua mọi chuyến, counter next_config_version_no; trips.manual_off_issued_seconds default0/check0..1200. Version bản ghi tách phiên bản firmware.
2. Thứ tự migration: roles/permissions → profiles/account_access → RLS helpers → xe/thiết bị/credential/assignments → shipments/trips/sessions/proofs → telemetry/latest/events/rollup → configs/commands/attempts/ACK và FK cấu hình muộn → alerts/events/notifications → audit/idempotency/outbox → views/Storage/publication. departure_config_version_id thêm FK sau bảng config.
3. Bật RLS/revoke client ngay khi tạo bảng. View theo vai trò/chuyến, khách không lộ GPS qua JSON/lịch sử nếu duyệt chỉ in_transit. Tài xế không mutation lệnh hoặc dải nhiệt.
4. Seed tham chiếu/demo tách biệt. Demo local gồm 1 admin, 3 khách, 5 tài xế, 4 xe mô phỏng và 1 xe thiết bị thật, mỗi xe một thiết bị. Script server tạo admin qua Auth Admin API và gán vai trò trong `account_access`. Mật khẩu ngẫu nhiên lưu trong `.env.local` đã được Git ignore. Đăng ký tự do không cấp quyền admin.
5. Dùng `kysely-codegen` sinh kiểu từ DB local đã migrate. `npm run db:types:check` reset và so sánh lại với file kiểu trong repo. Chạy thủ công khi repo chưa có workflow CI. Wire integer trong miền JSON an toàn, bigint/UTC mapping rõ, không mất chính xác âm thầm.
6. Compose/TLS trust/env.example, credential/ACL. Reconnect transport backoff jitter1/2/4/8/16/cap30 giây, báo degraded sau5 phút, vẫn tiếp tục thử; command không được kéo dài hạn theo transport.

Nghiệm thu: reset rỗng/upgrade baseline, unique tài nguyên chuyến, check dải>1°C/bước0,5, config tăng qua chuyến, tổng off0..1200, rollup null không trùng. Thêm index report(trip_id,minute_utc),(device_id,minute_utc). RLS ba vai trò/pending/suspended; client không ghi trực tiếp/RPC. Cấp/revoke credential thử phiên đang mở và reconnect thật; chưa gọi đạt khi chỉ DB đã revoked.

## BE-2 — API, giao dịch và publisher

Công việc:

1. JWT+account_access guard, allowlist DTO, Idempotency-Key/version/lỗi chuẩn. Approve/reject gửi version entity đã xem, stale409 VERSION_CONFLICT.
2. Hồ sơ/invitation/activation/suspend; shipment draft/submit/review/assign; trip depart/complete/cancel/proof. Cập nhật shipments.status/trips.status cùng transaction theo bảng mục6 BE-0 với audit/notification/outbox liên quan.
3. Depart dùng telemetry live trong60 giây đúng device/config_version_no được phép, không chờ applied/ACK; retained online/backfill không đủ. Complete vận hành và đánh giá nhiệt tách riêng theo chính sách được duyệt.
4. Endpoint admin POST /trips/:id/temperature-configs cấp config_version_no dưới khóa devices, tạo set_target_range. Không có thao tác đổi dải/yêu cầu đổi dải từ điện thoại tài xế trong MVP.
5. POST /trips/:id/commands chỉ admin, chỉ set_relay_manual; tài xế/khách403. Check in_transit, online theo mẫu live, state on/off,duration integer1..1800 default600. Không nhận set_target_range ở endpoint này.
6. Off: khóa trip/device, cộng toàn bộ duration vào manual_off_issued_seconds tại lúc cấp/issued_at; command/outbox/audit/response idempotency cùng commit. Tổng>1200 rollback/409 OFF_LIMIT_REACHED. Sau commit không hoàn khi timeout/rejected/kết thúc sớm/publish lỗi. On không cộng.
7. Publisher tối đa3 application attempts dự kiến0/10/20 giây trong30 giây. Reserve attempt bền vững trước gửi để crash không tự thêm lượt; đây chỉ là đếm lần publish, không giữ chỗ thời gian off. MQTT QoS1 có thể trùng packet, firmware dedup ID. Broker down không kéo expiry, hết hạn thì không gửi khi reconnect. ACK rejected dừng retry command; thử lại cần command mới, off tính thêm.
8. GET command trả status/ACK/reason/retry_after_seconds; HTTP202 chưa hứa relay đã đổi. ACK muộn chỉ lịch sử, không ghi đè command mới; không đối soát máy nén vật lý.

Nghiệm thu:

- Hai request phân cùng tài nguyên chỉ một thành công; lô/chuyến không nửa chừng, version sai409.
- Driver on/off/đổi dải403; admin sai trạng thái/offline từ chối; payload ngoài contract400.
- Off600+600=1200, off tiếp409; off900+600 bị409; off1800 bị409 dù giới hạn lệnh30 phút. On1800 hợp lệ nếu điều kiện khác đạt.
- Replay cùng key chỉ một command/một lần cộng; hai request đồng thời không vượt tổng; timeout/guard rejection không hoàn, rollback trước commit không cộng.
- Config_version_no tăng qua hai chuyến; ACK applied không bị diễn giải là máy nén chạy.
- Guard rejection có retry_after_seconds, GET hiển thị chưa thực hiện, không retry command đã rejected hoặc giữ sent mãi.

## BE-3 — Firmware contract, ingest, simulator và demo

Firmware:

- Lưu dải/config_version_no nguyên tử, chỉ áp số lớn hơn. >max bật,<min tắt, ở giữa/đúng biên giữ; guard45 giây mọi đổi thực. Cấu hình mới về auto và vẫn tuân guard.
- set_relay_manual on/off có duration; deadline monotonic từ lúc áp thành công, không kéo dài bởi retry/reconnect/UTC đổi. Hết hạn về auto/manual_expires_at=null, relay theo nhiệt/guard. Đang manual off mà nhiệt>max thì bật khi đủ45 giây, hủy tay về auto.
- Lệnh tay cần đổi mà guard chưa đủ: ACK rejected/min_switch_interval/retry_after_seconds, không ngầm xếp lịch. Mode đổi mà relay đã đúng không tạo lần đổi giả. Reboot auto/guard khởi động45 giây nếu mất mốc cuối.
- Thiếu GPS/NTP: giờ unknown, không suy UTC từ giờ nhận; từ chối lệnh mới cần kiểm expiry. Đo/auto/SD tiếp tục. relay_state không hứa máy nén vật lý chạy.

Ingest/báo cáo:

Commit trước sync ACK, dedup ID/nội dung, SD không xóa theo PUBACK. Tách freshness/connectivity, boot/sequence không lùi latest, backfill đúng chuyến hoặc null. Alert nhiệt/cửa đủ120 giây, connection_lost>300; realtime chỉ mẫu live có chất lượng giờ phù hợp. Rollup upsert không đếm trùng/không bỏ phút thiếu; giữ chi tiết chưa tổng hợp/còn cần pending. Công thức độ phủ theo BE-0 mục8 sau duyệt, có version/audit khi đánh giá lại. Đo rows/index/storage trước chốt12 tháng. Notifications chỉ invalidation không GPS/PII, dashboard đọc lại15 giây.

Simulator chạy process riêng cho 4 thiết bị mô phỏng. Mỗi thiết bị có credential, boot và sequence riêng, dùng TLS và journal bền vững. Scenario/seed xác định, mẫu30 giây; guard kiểm theo monotonic độc lập tick publish. Clock ảo cho integration, thời gian thực cho nghiệm thu thiết bị.

| Kịch bản | Kỳ vọng |
|---|---|
| Auto quanh min/max | Hysteresis đúng, mọi đổi cách>=45 giây |
| Quá nhiệt lúc tắt tay | Đợi đủ45 giây nếu cần, bật và về auto, không chờ server/hết duration |
| Tay hết hạn | Auto đúng deadline, relay vẫn theo nhiệt/guard, retry không gia hạn |
| Mất mạng khi auto | Điều khiển local/SD tiếp tục, stale/lost đúng mốc, reconnect backfill không lùi latest |
| Hai lệnh off vượt20 phút | Off900 được cấp, off600 kế409,tổng vẫn900; dùng clock ảo/điều kiện nhiệt để thực hiện kịch bản |
| Dùng hết tổng | Hai off600 đã cấp, off sau409 kể cả trước đó timeout/rejected |
| Online nhưng stale | Giữ keepalive, dừng đo hoặc chỉ phát backlog; retained online không làm mới cảm biến |
| Config cũ | Config27 tới sau28 không áp; reboot giữ28 |
| Guard/tin trùng | Lệnh sớm rejected có thời gian thử lại; command trùng chỉ ACK lại |
| Dữ liệu thiếu/giờ unknown | Không giả giờ đo, không tự pass/gán chuyến hiện tại cho backfill |

Nghiệm thu thiết bị thật bắt buộc:

1. Ít nhất một lần relay tự bật và tự tắt đúng ngưỡng/cách>=45 giây. Lưu nhiệt,monotonic,config_version_no,relay_state; không gọi đây là máy nén vật lý chạy.
2. Ít nhất một lần tắt tay600 giây hết hạn về auto trên thiết bị thật. Giữ nhiệt không vượt max sớm để không bị quá nhiệt hủy trước; kiểm tra mode auto và guard tại hạn. Muốn thấy relay bật đúng lúc hết hạn thì tạo nhiệt yêu cầu bật tại thời điểm đó/guard đủ, không nhận kịch bản bật sớm do quá nhiệt thành hết hạn.
3. Simulator không thay hai bằng chứng trên. Ghi riêng test chưa chạy/chưa đạt do firmware/thiết bị, không báo đạt đầu-cuối chỉ từ API test.
4. Báo cáo/demo ghi **10/30/20 phút là giá trị thiết kế, không phải kết quả nghiên cứu thời gian hỏng của hàng**; ghi cả giới hạn relay_state.

## Bàn giao và giới hạn lượt này

Mỗi giai đoạn bàn giao code/migration bổ sung, contract/OpenAPI, test report và runbook. Sau sửa code chạy graphify update . theo quy tắc dự án. Lượt v0.5 chỉ soạn tài liệu, chưa BE-1/apply schema môi trường thật/nghiệm thu thiết bị; không mở lại quyết định điều khiển cũ đã được yêu cầu thay thế.

## Ghi chú thay đổi

- 26/11/2026 — Chốt seed bước 1.8, bootstrap admin qua Auth Admin API và kiểm tra drift bằng `kysely-codegen`. Simulator bước 3.7 chạy 4 thiết bị mô phỏng.
