# ColdTrack — Plan BE-1 đến BE-3 theo BE-0 v0.4

Ngày: 12/11/2026. Trạng thái: đề xuất để rà soát; chưa bắt đầu code theo plan này.

Đầu vào: [BE-0 v0.4](BE-0-thiet-ke-backend-coldtrack.md) và các bản rà soát A/B/C/D, F1–F15, Q1–Q4 của chủ đồ án. Tên chuẩn đặc tả là BE-0-thiet-ke-backend-coldtrack.md; v0.3 chỉ giữ làm lịch sử. Graph đã được truy vấn: dự án có backend NestJS, `pg`, `kysely`, MQTT và Supabase trong `coldtrack-be/package.json`; đây chỉ là bối cảnh từ graph, chưa phải audit implementation. Khi bắt đầu code phải kiểm tra phần đã có, đối chiếu migration đang áp dụng và bổ sung phần thiếu; không tạo lại schema hoặc rewrite migration đã chạy chỉ vì plan dùng tên logic mới.

## Trình tự trước khi code

1. Rà soát v0.4 cùng bảng đối chiếu A1–A15/B1–B8 ở mục 13.
2. Chủ đồ án chốt D1–D6. Các thông số 10 phút, 180 giây, GPS chỉ in_transit và pending_evaluation đang là đề xuất. D5 đề xuất safety_exit_temp=target_max+2°C; D6 đề xuất tổng manual_off 20 phút/chuyến. Cả hai chưa được duyệt. Công thức/độ phủ 95% cần duyệt cùng D4; các thông tin nghiệp vụ cũ chưa trả lời vẫn giữ mở.
3. Khóa lựa chọn kỹ thuật C1–C8 bên dưới; xác nhận thiết bị có tín hiệu phản hồi máy nén thực hay chỉ GPIO, và phần firmware nằm trong kế hoạch phối hợp với người làm thiết bị.
4. Sau khi được yêu cầu triển khai: query graph cho module liên quan, kiểm kê code/migration hiện có, xác định baseline DB, rồi thực hiện BE-1 → BE-2 → BE-3. Không chạy migration lên môi trường thật trong lượt soạn tài liệu này.

## C1. Mosquitto xác thực thế nào?

**Chọn password file đồng bộ từ DB**, không chọn plugin HTTP gọi backend. Với 6–8 thiết bị, cách này giảm thành phần vận hành và không làm mỗi lần CONNECT phụ thuộc API/DB còn sống.

Mosquitto hỗ trợ password file và ACL; tài liệu xác nhận reload password file không ảnh hưởng client đã kết nối. Vì vậy không được coi reload là đã ngắt phiên credential bị thu hồi. [Mosquitto configuration](https://mosquitto.org/man/mosquitto-conf-5.html).

Thiết kế cấp/thu hồi đề xuất:

- Broker chỉ mở MQTT TLS, `allow_anonymous=false`. Server xuất ACL đúng username=device_code và đúng topic ở đặc tả; ingest/publisher có user riêng.
- Server sinh secret, dùng công cụ/thư viện tương thích phiên bản Mosquitto đã pin để tạo chuỗi hash dùng cho password file. Không giả định hash bcrypt bất kỳ trong DB được Mosquitto đọc. `device_credentials.secret_hash` là hash theo định dạng đã chọn, chỉ DB service/provisioner được đọc. Không truyền secret trên command line hoặc ghi vào log.
- Thêm credential `provisioning_status` (`pending`, `applied`, `error`), `broker_applied_at` và version bản cấu hình broker. `status=active` là trạng thái mong muốn; chưa applied thì API chưa báo thiết bị sẵn sàng. Secret chỉ trả một lần sau cấp thành công; mất secret thì rotate, không có API xem lại.
- Giao dịch ghi trạng thái mong muốn + audit + tác vụ provisioning. Provisioner chỉ chạy trên host broker, serialize các thay đổi, xuất password/ACL file tạm từ DB, kiểm tra và atomic replace, giữ bản cấu hình trước nếu kiểm tra thất bại. Không xuất plaintext qua outbox client-readable hoặc commit file chứa secret.
- Khi thu hồi: DB chuyển revoked, ingest từ chối dữ liệu thiết bị đó ngay khi kiểm tra trạng thái. Provisioner bỏ user khỏi file và **restart broker có kiểm soát** để ngắt cả phiên đang mở. Đây là đánh đổi được chọn cho demo: mọi thiết bị, ingest/publisher đều reconnect; thiết bị tiếp tục ghi SD và gửi bù. Không mô tả đây là ngắt riêng một client.
- Endpoint trả `202 revocation_pending` cho tới khi broker restart thành công và xác nhận cấu hình đã áp dụng; chỉ lúc đó ghi applied/audit. Nếu host broker không hoạt động, DB có thể revoked nhưng không cam kết phiên broker đã bị ngắt: giữ pending/error, báo admin, chặn dữ liệu tại ingest và retry tác vụ. Theo dõi backlog provisioning riêng với outbox lệnh.
- Thử thu hồi với một phiên đang publish và một client cố reconnect; cả hai phải bị chặn sau applied. Broker khởi động không được quay về file cũ còn chứa credential revoked; startup phải đối soát version DB hoặc giữ listener chưa sẵn sàng khi chưa thể xác định cấu hình.

Không chọn Dynamic Security cho v0.4 để giữ đúng hai phương án được hỏi; có thể đổi bằng quyết định kiến trúc sau nếu cần ngắt riêng client mà không restart cả broker. Không cài đồng thời hai cơ chế rồi giả định chúng tự đồng bộ.

## C2. Đồng bộ trạng thái máy nén

**Có báo `compressor_state` trong telemetry** (`on`, `off`, `unknown`) cùng `control_mode`, `last_applied_command_id`, `last_applied_control_seq` và `config_version_id`.

- ACK xác nhận thiết bị đã xử lý command; không thay bằng chứng trạng thái thực. Server lưu ACK ở device_command_acks, cập nhật acked_applied, sau đó chỉ ghi confirmed_at khi telemetry mới đúng boot/seq phản ánh command và trạng thái/mode tương ứng.
- Set_target_range xác nhận config_version_id hiệu lực. Off xác nhận manual_off và compressor_state=off. On nghĩa là hủy manual_off, trở lại auto: xác nhận control_mode=auto và seq mới, trạng thái thực còn tùy nhiệt/guard; không yêu cầu máy nén phải chạy dù đã đủ lạnh.
- Nếu chỉ có GPIO mà chưa có cảm biến dòng/tiếp điểm phản hồi, compressor_state=unknown. **Không dùng relay_commanded_state trong contract BE-3**. Payload/bảng không có trường này; compressor_state chỉ unknown nếu chưa có feedback phần cứng. Không gắn GPIO thành trạng thái vật lý đã xác nhận. Demo phải ghi rõ hạn chế phần cứng này; cần chốt khả năng thiết bị trước nghiệm thu C2.
- ACK tới trước telemetry/telemetry tới trước ACK đều được lưu; reconciliation kết hợp hai nguồn, không hồi lùi seq hoặc config. Nếu không có phản hồi trạng thái thì hiển thị “đã nhận lệnh, chưa xác nhận trạng thái”, không báo thành công vật lý giả.
- Đề xuất cửa sổ đối soát 60 giây sau expires_at cần duyệt kỹ thuật cùng contract: ACK rồi nhưng chưa có telemetry xác nhận thì config chuyển failed với failure_reason=confirmation_timeout (cột có check ở config và command, ghi audit), không tự thay cấu hình đang có. Command vẫn giữ trạng thái ACK đã nhận và confirmed_at null; không sửa ACK thành chưa từng nhận. “Chưa xác nhận” là nhãn hiển thị, không thêm enum unconfirmed vào schema.
- Off tự hết thời hạn khi offline bằng monotonic; sau reboot không biết giờ thì trở về auto. Guard vật lý luôn ở firmware, không chỉ API.

## C3. Ingest chạy ở đâu, chi phí và rủi ro?

**Chọn máy đồ án có sẵn chạy Docker Compose trong giờ thử nghiệm/demo**, cùng mạng với thiết bị: Mosquitto TLS, NestJS, ingest, publisher/provisioner và simulator. Supabase Free là DB/Auth/Storage/Realtime bên ngoài. Ingest là tiến trình Node chạy lâu dài kết nối MQTT và PostgreSQL với pool nhỏ, không đặt vào Edge Function hoặc dịch vụ HTTP tự ngủ. API và ingest là process riêng dù dùng chung package/type.

| Thành phần | Chi phí đề xuất | Điều kiện/rủi ro |
|---|---|---|
| Máy sẵn có, Compose, Mosquitto, các process Node | Không thuê thêm compute | Vẫn có điện/internet; sleep, mất điện, restart Windows làm dừng service |
| Supabase Free | Mục tiêu 0 USD/tháng trong quota | Có giới hạn DB/Storage/Realtime, không cam kết đủ 12 tháng rollup |
| TLS mạng nội bộ | CA nội bộ, không mua domain | Firmware phải tin CA; không tắt verify certificate |
| Demo ngoài LAN hoặc chạy 24/7 | Chưa chọn nhà cung cấp/gói trả phí | Cần host luôn bật, route MQTT TLS và HTTPS phù hợp; không cam kết miễn phí 24/7 |

Supabase nêu Free có thể pause do ít hoạt động trong 7 ngày; đây là rủi ro cần kiểm tra trước demo. [Production checklist](https://supabase.com/docs/guides/deployment/going-into-prod).

Chạy thử DB connectivity từ đúng host (direct hoặc pooler phù hợp mạng/IPv4/IPv6), pin cấu hình kết nối, giữ tổng pool trong giới hạn dự án. DB lỗi thì không sync ACK; broker/ingest phục hồi thiết bị gửi lại SD. Máy host dừng không có server gửi cảnh báo, nên không hứa giám sát liên tục khi laptop tắt. Trước demo khởi động dự án cloud, test TLS, credential, time-sync, DB write và gửi bù.

## C4. Realtime: bảng, kênh và kết nối

**Chọn Postgres Changes cho thông báo cá nhân; không dùng Broadcast trong BE-1 đến BE-3.** Không cần tạo cả hai hệ realtime để phục vụ vài client.

Chỉ đưa `notifications` vào publication cho client, subscribe INSERT với filter user_id và RLS active+owner. Payload realtime tối thiểu: notification id, mã sự kiện chung, created_at; không có GPS, tên tài xế, dữ liệu nhạy cảm hoặc nội dung nghiệp vụ chi tiết trong title/body. Sau invalidation, client đọc lại dữ liệu qua view có RLS hoặc API, lấy quyền hiện tại. Với tài khoản cũ còn giữ WebSocket sau suspended, invalidation cũ không được mang dữ liệu nghiệp vụ; các lần đọc lại phải bị từ chối.

Không publish raw telemetry, device_latest_state, credentials, audit hoặc outbox ra subscription client. Dashboard polling view trạng thái theo chuyến mỗi 15 giây khi màn hình đang mở; độ trễ hiển thị có thể thêm tới một chu kỳ polling và phải ghi trong UX. Cảnh báo/đổi trạng thái chỉ ghi notification theo sự kiện, không mỗi mẫu. Khách có vị trí chỉ trong dữ liệu đọc lại khi in_transit theo đề xuất D3. Chưa có kênh Broadcast; nếu thêm sau này phải có private channel, authorization và cơ chế thu hồi rõ ràng, không coi tên channel chứa trip_id là đủ bảo mật.

Supabase Postgres Changes kiểm tra quyền dữ liệu theo subscriber; dùng filter không thay thế RLS. [Postgres Changes](https://supabase.com/docs/guides/realtime/postgres-changes).

Ước lượng demo: 1 tab admin + 2 tab customer + 2 app driver = 5 WebSocket Realtime. Hai tab admin thành 6, dự trù tối đa 10 client hoạt động đồng thời. Thiết bị/simulator nối Mosquitto nên không cộng vào Realtime cloud. Với 7 simulator + 1 thật, MQTT khoảng 8 device + ingest + publisher = 10 kết nối nền, cộng probe khi test; không nhầm hai loại kết nối. Poll HTTP không tạo thêm WebSocket.

Theo tài liệu tra cứu ngày **12/11/2026**, Free công bố 200 peak Realtime connections và 2 triệu messages/tháng; đây không phải cam kết quota của dự án, **cần kiểm tra lại trên Dashboard trước demo**; không xem số lượng kết nối nhỏ là bảo đảm mọi quota khác đều đủ. [Peak connections](https://supabase.com/docs/guides/platform/manage-your-usage/realtime-peak-connections), [billing](https://supabase.com/docs/guides/platform/billing-on-supabase).

## C5. Công cụ truy vấn và chống lệch schema

**Chọn Kysely + pg.** SQL gần PostgreSQL giúp thể hiện transaction, khóa hàng, partial unique, RLS, outbox và truy vấn ingest; graph cũng cho thấy backend đã có hai dependency này. Không thêm Prisma/Drizzle cùng lúc.

Supabase CLI SQL migrations là nguồn schema duy nhất. Không dùng Kysely Migrator hoặc schema builder để thay đổi DB lúc app startup. Kysely có cơ chế migration riêng nhưng plan chủ động không dùng. [Kysely migrations](https://kysely.dev/docs/migrations).

BE-1 chọn/pin công cụ introspect sinh type Kysely từ DB local đã apply migration (ví dụ kysely-codegen, cần kiểm tra khả năng hỗ trợ types thực tế trước tích hợp); không tự giả định Supabase-generated types dùng thẳng cho Kysely. CI khởi tạo DB rỗng → apply toàn bộ migration/seed test → generate types → kiểm tra diff và typecheck. CI phải phát hiện sửa DB hoặc type mà không có migration. JSON, enum, numeric, bigint và timestamptz cần mapping thống nhất. Wire contract v1 dùng integer JSON trong miền 0..9007199254740991 cho sequence_no/monotonic_ms/control_seq; DB bigint phải parse/validate trước serialize. Vượt miền thì từ chối v1, chỉ encode chuỗi ở schema_version tương lai đã thống nhất.

Migration đã chạy ở môi trường dùng chung chỉ sửa bằng migration mới. RLS/SQL function/trigger/index cũng là schema quản lý bởi CLI, không tạo bằng Dashboard rồi bỏ quên trong repo.

## C6. Simulator chạy và kiểm thử thế nào?

Chạy Node process/container riêng trên máy Compose, tạo 5–7 thiết bị ảo, mỗi thiết bị credential/UUID boot/sequence riêng, MQTT TLS/ACL giống thiết bị thật. Nhãn mô phỏng lấy từ devices.is_simulated do server quản lý, không tin payload tự nhận là thiết bị thật.

Simulator có seed ngẫu nhiên cố định, đồng hồ điều khiển được cho unit/integration và journal bền vững trong volume. Ghi mẫu vào journal trước publish; chỉ xóa khi sync ACK DB tương ứng. MQTT PUBACK không làm xóa journal. File scenario và kết quả mong đợi là artifact kiểm thử, không chỉ chuyển động ngẫu nhiên trên bản đồ.

| Kịch bản | Cách mô phỏng | Kỳ vọng |
|---|---|---|
| Bình thường | 30 giây/mẫu, nhiệt trong dải | Latest tăng đúng, không alert |
| Vượt nhiệt | 119 giây, đủ 120 giây; phục hồi hysteresis | Mở/phục hồi đúng biên có mẫu chứng minh |
| Cửa | true liên tục đủ 120 giây rồi false | Mở và recovered; admin resolve |
| Mất sóng | Chặn socket thiết bị bằng điều khiển simulator, vẫn đo/ghi journal | Dashboard stale >60 giây, mất tín hiệu >300 giây |
| Gửi bù | Kết nối lại, drain journal xen với mẫu live, đảo thứ tự và gửi trùng | ACK đúng commit, latest không lùi, không alert nhiệt realtime từ backlog |
| Reboot | Giữ journal, tạo boot UUID mới, sequence reset | Boot cũ chỉ lịch sử; off không được kéo dài qua reboot |
| Lệnh | Bỏ ACK, gửi ACK trùng/muộn, command hết hạn, seq cũ | Retry không đổi command_id, không thực thi lại, không ghi đè trạng thái mới |
| Đồng hồ | UTC nhảy tới/lùi, monotonic giữ; boot unsynced | Deadline off không kéo dài, lệnh chưa đồng bộ bị từ chối |
| Qua hai chuyến | Cùng boot qua ranh giới chuyến, gửi bù sau đó | Gán bằng đoạn phiên hoặc giữ null khi thiếu bằng chứng |
| Thu hồi | Revoke khi đang publish, reconnect bằng secret cũ | Sau broker applied không publish/reconnect được |
| Guard | Gửi on/off gần nhau, off seq cũ tới sau on mới | Rejected có min_switch_interval/retry_after_seconds, không retry command đã từ chối |
| Online nhưng stale | Giữ MQTT socket/keepalive và retained online, dừng đo/publish mẫu mới; biến thể chỉ phát lại mẫu SD cũ | last_fresh_sample_at không tiến, stale >60 giây; không mẫu >300 giây mới connection_lost, backlog không làm latest tươi |
| Safety exit + admin on | Đang off, nhiệt vượt safety_exit_temp đúng tick nhận on; lặp khi offline | Một lần về auto, reason=safety_exit, không đúp thời gian off; guard/trạng thái vật lý hiển thị thật |
| Off budget | Dùng hết hạn mức, gửi off đồng thời hoặc replay key, bỏ ACK | Không vượt reserve+charged; timeout không được hoàn giả |
| Mất flash seq | Xóa vùng lưu seq giả lập nhưng giữ credential; inject bootstrap/command cũ | Chỉ auto tới recovery đúng boot/request/baseline, từ chối seq cũ |

Các test đồng hồ ảo rút ngắn thời gian chờ, nhưng nghiệm thu thiết bị thật phải có ít nhất một vòng 120/300 giây thực, mất mạng và off tự hết hạn. Không dùng kết quả simulator để tuyên bố phần cứng đã đạt.

## C7. Pass/fail và một con số độ phủ chung

Chọn công thức mục 11.6 đặc tả làm nguồn duy nhất. Diễn giải: mỗi mẫu nhiệt hợp lệ đại diện tối đa đúng một chu kỳ P, bị cắt tại mẫu kế tiếp, cuối chuyến và ranh giới cấu hình; hợp khoảng không cộng chồng. Không lấy sample_count/expected_count làm độ phủ vì mẫu gửi trùng hoặc dồn gần nhau sẽ làm sai.

| Dataset chuyến 600 giây, P=15 | Covered | Coverage | Kết quả đề xuất nếu nhiệt không vi phạm |
|---|---:|---:|---|
| Mẫu 0,15,...,585 | 600 giây | 100% | pass |
| Bỏ mẫu 300,315,330,345 | 540 giây | 90% | pending_evaluation |
| Bỏ mẫu 300,315 | 570 giây | 95% | pass nếu mọi điều kiện khác đạt |
| Chỉ mẫu 0 và 120 | 30 giây | 5% | pending, không chứng minh vượt nhiệt liên tục |
| Gửi trùng đủ bộ mẫu hai lần | 600 giây | 100% | Không tăng độ phủ |

Điều kiện pass đề xuất: độ phủ >=95%, không gap >300 giây, mẫu tốt trong 60 giây cuối, cấu hình hiệu lực xác định, không vi phạm nhiệt liên tục >=120 giây. Fail cần bằng chứng nhiệt vi phạm đủ thời gian, có thể kết luận dù độ phủ thấp; thiếu dữ liệu đơn thuần giữ pending. Chỉ đánh giá chuỗi vi phạm giữa mẫu hợp lệ cách nhau tối đa 2P theo 11.4, không suy 120 giây từ hai mẫu xa nhau. Dữ liệu chưa có giờ tin cậy không cộng vào covered_seconds dù có trip_id qua session.

Lưu T, covered_seconds, gap lớn nhất, mẫu cuối, P và phiên bản thuật toán để hai bên tính lại. Backfill kích hoạt đánh giá lại có version/audit; không tự khóa pass trước khi xử lý bằng chứng đến muộn. Chưa có TTL tự biến pending thành fail. Các ngưỡng này cần duyệt cùng D4 trước code.

## C8. Thứ tự migration không sai phụ thuộc

Tên dưới là nhóm logic, file thật do `supabase migration new` sinh timestamp. BE-1 phải đối chiếu migration hiện có; nếu đã apply thì thêm migration sửa tiến, không thay lịch sử.

| Thứ tự | Nội dung và phụ thuộc |
|---|---|
| 01 | Enum/kiểu dùng chung, roles, permissions, role_permissions và seed tham chiếu ổn định |
| 02 | profiles → account_access/invitations/sensitive; Auth trigger không tin vai trò metadata |
| 03 | Hàm RLS role/active tránh đệ quy, policy hồ sơ; fixed search_path cho hàm đặc quyền |
| 04 | vehicles → devices → credentials/time_anchors/assignments/control_recoveries; control_seq_state/next_control_seq và check một thiết bị chính |
| 05 | shipments (enum đủ/check dải) → trips → delivery_proofs/device_sessions/trip_off_budgets; unique xe/tài xế/lô/thiết bị; departure_config_version_id chưa FK config |
| 06 | telemetry/latest/events/rollup gồm control_seq_unknown/safety flags và window/covered seconds; config_version_id chưa FK, các FK device/trip/session đã có; report index Q4 |
| 07 | configs (safety_exit_temp, max_manual_off_seconds_per_trip, failure_reason) → requests (version) → commands (budget/failure_reason) → attempts/acks/manual_off_periods; sau đó FK config cho telemetry/rollup/trips departure pointer |
| 08 | alerts → alert_events/notifications; unique alert chưa resolve |
| 09 | audit/idempotency/outbox/provisioning fields hoặc tasks; nghiệp vụ function/trigger có tham chiếu bảng này chỉ tạo sau nhóm 09 |
| 10 | Views/projection, policy đầy đủ, Storage policy, grants tối thiểu, publication chỉ notifications; khóa quyền RPC không public |
| Sau migration | supabase/seed.sql chỉ local/test; bootstrap admin qua server/Auth riêng |

Ngay migration tạo bảng phải bật RLS và revoke quyền client mặc định, kể cả khi policy cho phép đọc chưa có đến nhóm 10. Không để database mở dữ liệu trong khoảng triển khai giữa hai file. DDL chạy transaction ở nơi PostgreSQL cho phép; failure không bỏ lại object mở quyền. Kiểm tra PostgreSQL >=15 trước unique NULLS NOT DISTINCT; không để seed phụ thuộc view/trigger chưa tạo.

Nhóm 04 tạo devices trước device_control_recoveries, sau đó mới thêm FK devices.active_control_recovery_id để tránh vòng phụ thuộc. Nhóm 07 thêm retry_after_seconds vào ACK và ràng buộc guard refusal; recovery bootstrap phải đồng bộ cả ngân sách bảo thủ, không reset hạn mức sau mất flash.

Chạy database reset local từ rỗng và chạy migration sửa trên bản sao schema trước đó. Test RLS bằng JWT/DB role thật tương ứng, không kiểm bằng service role bỏ qua RLS. Test migration gồm null rollup, auth trigger, FK muộn, seed demo và việc anon/authenticated không execute function nghiệp vụ.

## BE-1 — Nền dữ liệu, quyền và môi trường

Đầu vào: v0.4 được duyệt, D1–D6 chốt, xác định DB baseline và khả năng phần cứng.

Công việc: kiểm kê schema/code đã có; khóa DTO/enums; pin PostgreSQL/toolchain; viết migration bổ sung theo C8; DB role ingest/publisher/API/provisioner; RLS/view/Storage policy và cấu trúc notification tối thiểu; seed local/bootstrapping; Compose/TLS/password-file provisioning; Kysely types và kiểm tra drift. Thiết lập cấu hình N/guard từ giá trị đã duyệt, không hardcode số minh họa.

Đầu ra review: SQL migration và sơ đồ cập nhật, ma trận quyền áp dụng, OpenAPI/contract sơ bộ, env.example không secret, hướng dẫn local và bảng kết quả test. Chưa nối frontend vào dữ liệu thật nếu quyền chưa đạt.

Nghiệm thu: reset DB từ rỗng; upgrade baseline hiện tại; chặn version Postgres không hỗ trợ; RLS đủ ba vai trò và pending/suspended; unique phân công, nullable rollup, FK/session; types khớp DB; bootstrap không tự cấp admin từ metadata; client không ghi DB/RPC nghiệp vụ; provisioning/revoke ngắt phiên thật trên local.

## BE-2 — API nghiệp vụ, transaction và lệnh

Phụ thuộc BE-1 đạt. Công việc: JWT verification + DB access guard, allowlist DTO; idempotency và version conflict; hồ sơ/mời/kích hoạt; shipment review/assign; trip depart/complete/cancel; upload proof; temp request/config; commands với quyền off chỉ admin, ngân sách reserve nguyên tử/409 OFF_LIMIT_REACHED; control_seq/bootstrap và preemption; depart theo telemetry, approve/reject version; outbox publisher/retry; notification/audit nguyên tử.

Đầu ra review: OpenAPI hoàn chỉnh, ví dụ request/response/lỗi, implementation theo contract, test integration cho giao dịch/race và log có request_id. API commands trả 202 queued; không báo thiết bị thực thi chỉ vì HTTP thành công.

Nghiệm thu: hai request phân tài nguyên chỉ một thành công; cùng idempotency key chỉ một mutation; payload khác key cũ bị 409; version sai bị 409; driver off bị 403 tại API; chủ thể ngoài phạm vi không đọc/sửa; complete ghi proof/trạng thái nguyên tử, thiếu telemetry giữ pending theo D4; command seq không lùi, retry <=3 lần trong 30 giây và ACK muộn không đổi lệnh mới; notification payload không lộ GPS/PII.

## BE-3 — Ingest, firmware contract, cảnh báo và demo đầu-cuối

Phụ thuộc BE-1/BE-2. Công việc: schema MQTT, dedup hash/message, commit-before-sync-ACK, boot/session/anchor, live/backfill/latest; telemetry phản hồi control; evaluator nhiệt/cửa/mất tín hiệu; alert_events và resolve note; rollup/upsert/retention, job đánh giá pass/fail; simulator có journal/scenario; polling và invalidation client tối thiểu theo C4; đo dung lượng và kịch bản demo.

Phần firmware cần phối hợp rõ: SD journal, stable boot UUID, sequence/monotonic, flash command dedup/seq, off deadline/guard/safety_exit, ngân sách trip bền vững, seq bootstrap khi hỏng flash và compressor feedback. Nếu chưa có code firmware trong phạm vi repo, xuất contract + test harness và ghi rõ phần thiết bị chưa nghiệm thu, không thay bằng kết quả simulator.

Đầu ra review: test report đầu-cuối, dữ liệu độ phủ có thể tính lại, scenario simulator, runbook demo/khôi phục mạng, bảng đo rows/index/storage sau chạy thử và quyết định retention thực tế. Không xóa chi tiết chưa tổng hợp hoặc chuyến pending để ép vừa quota.

Nghiệm thu: đầy đủ AC-01–AC-15 và mục 14 đặc tả; test clock/reboot/off offline/safety_exit, hai lệnh dùng hết budget và lần kế bị chặn, seq recovery, guard ACK từ chối có thời gian thử lại, depart không ACK nhưng telemetry đúng; ACK/publish crash; backfill hai chuyến cùng boot; cửa/nhiệt đúng 120 giây và mất tín hiệu >300 giây; nullable rollup không trùng; suspend/GPS sau complete không rò dữ liệu; ít nhất một thiết bị thật đạt các kịch bản thời gian thực. Ghi riêng kết quả chưa đạt do thiếu phần cứng hoặc thông số chưa duyệt.

## Q1. On của admin trùng thời điểm vượt ngưỡng an toàn

Firmware ưu tiên điều kiện safety_exit khi còn manual_off, kết thúc off một lần và lưu lý do an toàn, sau đó xử lý on hợp lệ theo control_seq và ACK trạng thái auto. Không tự tăng seq vì sự kiện an toàn cục bộ, không cho off cũ retry tái kích hoạt, không trừ ngân sách hai lần. Nếu on đã hủy off ở tick trước thì mẫu quá nhiệt tới sau không tạo thêm một khoảng off kết thúc. Khi quá ngưỡng hoặc chưa có mẫu nhiệt local mới thì từ chối off mới; nhiệt hợp lệ <=target_max mới bỏ safety block. API không phải nơi duy nhất kiểm tra nhiệt.

Về yêu cầu “tự bật bất kể lệnh off”: v0.4 hủy ý muốn tắt và yêu cầu auto làm lạnh ngay, nhưng đề xuất vẫn giữ guard vật lý. Nếu muốn bypass guard để bật vật lý ngay phải chốt cùng D2/D5 và phần cứng; chưa tự coi hai yêu cầu đối lập này đã được giải quyết bằng một số ngưỡng. Không có feedback thì vẫn báo trạng thái thực unknown.

## Q2. Ingest/publisher khi broker restart

Tách reconnect transport khỏi retry từng command. Cả hai process có reconnect exponential backoff với jitter, các mốc cơ sở 1,2,4,8,16,30 giây rồi cap 30 giây. Cho jitter trong [0, mốc cơ sở], đặt sàn 0,5 giây tránh vòng lặp nóng. Sau một phút ổn định reset backoff. Không giới hạn tổng số lần reconnect transport vì đây là service chạy lâu dài; sau 5 phút chưa hồi phục báo degraded/metric và tiếp tục retry cap, không process crash loop. Các con số này là cấu hình vận hành đề xuất, không thay hạn 30 giây của lệnh.

- Publisher chỉ lấy việc lệnh khi socket đã sẵn sàng. Trước mỗi publish kiểm tra expires_at và command chưa terminal. Mất mạng không kéo dài issued/expires hoặc deadline off. Tối đa 3 application publish attempts/command, đã lưu bền vững; reserve attempt trước thao tác mạng để crash không tự cho thêm lượt. SDK/MQTT QoS1 vẫn có thể phát lại packet, nên firmware dedup command_id. Hết hạn khi broker còn down chuyển timed_out/failure_reason=expired mà không gửi sau reconnect. ACK rejected không retry command đó.
- Outbox giữ pending trong DB, worker lease có thời hạn tránh giữ khóa mãi; chỉ ghi published theo xác nhận publish đã chọn, không suy physical applied từ PUBACK. Crash sau publish có thể phát lại cùng command_id nhưng không quá ngân sách attempt mới; không hứa exactly-once transport.
- Ingest reconnect và subscribe lại đúng topic trước báo ready; DB pool/worker không cần restart theo broker. Chưa commit thì không sync ACK; sau broker lên thiết bị phát lại journal, dedup và ACK lại mẫu đã commit. DB commit nhưng ACK chưa gửi có thể giữ sync ACK ở outbox; mất nó vẫn an toàn vì thiết bị gửi lại. DB lỗi backoff riêng và không xóa SD dựa trên MQTT PUBACK.
- Provisioner serialize thay đổi và batch restart một lần khi có thể, chờ broker health trước báo applied. Broker không lên thì credential revocation vẫn pending/error như C1; không gán applied vì file đã ghi. Dữ liệu SD/metrics cho thấy mất giám sát trong cửa sổ restart. Giới hạn thử một tác vụ khởi động tự động: tối đa 3 lần, backoff 1/2/4 giây rồi báo lỗi cho admin; reconnect client vẫn tiếp tục cap. Restart tác vụ và reconnect transport là hai ngân sách khác nhau.

## Q3. Simulator tái tạo “dữ liệu cũ nhưng online”

Có. Scenario giữ socket MQTT với keepalive và retained status online, dừng sensor/publish telemetry nhưng không DISCONNECT. Sau 60 giây dashboard phải stale dù status broker online, sau hơn 300 giây không telemetry thì connection_lost. Scenario thứ hai phát liên tục mẫu SD cũ: last_received_at có thể mới nên đường truyền không lost, nhưng last_fresh_sample_at vẫn cũ, latest không lùi và dashboard vẫn stale. Cần kiểm tra cả hai, không dùng riêng scenario ngắt socket vì nó không tái tạo lỗi này.

## Q4. Index báo cáo cho telemetry_rollups_minute

Có, unique index với NULLS NOT DISTINCT dùng chống trùng, không thay mọi index báo cáo. Chọn thêm B-tree `(trip_id, minute_utc)` cho báo cáo một chuyến và `(device_id, minute_utc)` cho đồ thị thiết bị theo khoảng giờ. Unique `(device_id, trip_id, config_version_id, minute_utc)` vẫn giữ để upsert; không kỳ vọng phần minute ở cuối phục vụ tối ưu truy vấn chỉ device+time không có trip/config.

Đây là lựa chọn thiết kế dựa trên quy tắc cột đầu của multicolumn B-tree trong [PostgreSQL 15](https://www.postgresql.org/docs/15/indexes-multicolumn.html), cần xác nhận bằng EXPLAIN (ANALYZE, BUFFERS) trên dataset đại diện khi BE-3, không coi là benchmark đã chạy. Chưa thêm mọi biến thể/include/BRIN vì quota index cũng chiếm dung lượng; chỉ bổ sung theo truy vấn thực.

Rollup lưu window_seconds và covered_seconds: mỗi hàng tối đa 60 giây; một phút đủ thuộc chuyến chia config tại giây20 thành window20+40=60, missing nằm trong từng window. Phút đầu/cuối chuyến có thể tổng <60. Đây là partition thời gian, không cam kết sample coverage luôn 60 giây.

## Bổ sung nghiệm thu F1–F15

BE-1: check dải >1°C/bước0,5 cho ba bảng; enum shipment đủ; failure_reason allowlist/cột; request.version; budgets/recovery/periods/FK/index; RLS tách GPS và nhiệt/cửa; link tên file chuẩn. BE-2: approve/reject race version, depart không đợi ACK/applied, off reserve concurrent/idempotent/limit, GET command rejected có retry_after_seconds. BE-3: safety_exit offline/cùng tick admin on, ngân sách/flash recovery, reconnect broker và hai scenario online-stale, rollup split20+40, không có relay_commanded_state trong DTO/schema.

Tham số D5/D6, tương tác guard D2/D5 và các đề xuất kỹ thuật mới phải được rà soát cùng v0.4. Chưa bắt đầu BE-1 cho đến khi v0.4 đạt và chủ đồ án chốt D1–D6.

## Ranh giới hoàn thành

BE-0 ở lượt này là bộ tài liệu để chủ đồ án rà soát. BE-1 đến BE-3 là kế hoạch có tiêu chí nghiệm thu, chưa phải báo cáo đã thực hiện. Chưa deploy, chưa thay schema môi trường thật, chưa chốt D1–D6 thay người dùng. Khi có thay đổi phạm vi/ngưỡng, sửa cả đặc tả, DTO, simulator và tiêu chí tương ứng trước khi triển khai.
