# BE-0 — Thiết kế backend ColdTrack MVP

Phiên bản **0.5 rút gọn**, ngày 15/11/2026. Thiết kế hiện hành thay v0.4; chưa phải báo cáo đã triển khai. [Plan BE-1 đến BE-3](BE-1-BE-3-implementation-plan.md). Bản v0.4 được lưu riêng để đối chiếu.

## 1. Phạm vi và thông số

Ba vai trò admin/khách/tài xế; một thiết bị thật, 5–7 xe mô phỏng có nhãn. Chỉ admin cấu hình dải nhiệt và điều khiển tay. Điện thoại tài xế theo dõi chuyến, xác nhận cảnh báo và giao nhận.

| Tham số | Thiết kế MVP |
|---|---|
| Telemetry | Thiết bị thật 15 giây/mẫu, simulator 30 giây/mẫu |
| Dải mục tiêu | −25°C ≤ min < max ≤ −15°C, bước 0,5°C, max−min>1°C nên rộng tối thiểu 1,5°C |
| Dải mặc định khi chưa đọc được cấu hình | −20°C đến −18°C, auto |
| Hysteresis relay | Nhiệt >target_max yêu cầu on; <target_min yêu cầu off; ở giữa hoặc đúng biên giữ trạng thái |
| Khoảng cách đổi relay thực | Ít nhất 45 giây giữa mọi lần đổi tự động hoặc tay |
| Lệnh tay | set_relay_manual, state on/off, duration_seconds mặc định600, từ1 đến1800 giây |
| Tổng tắt tay/chuyến | Không quá1200 giây theo thời lượng lệnh đã cấp, không hoàn |
| Hạn nhận lệnh | 30 giây từ issued_at, tối đa3 lượt publish ứng dụng cùng command_id |
| Giờ thiết bị | GPS hoặc NTP; thiếu thì time_source/time_quality=unknown, giờ đo UTC có thể null |
| Dashboard stale / mất tín hiệu | Không có mẫu cảm biến tươi quá60 giây / không nhận telemetry hợp lệ quá300 giây |
| Cảnh báo nhiệt/cửa | Vi phạm liên tục đủ120 giây |
| Retention ban đầu | Chi tiết7 ngày, tổng hợp phút mục tiêu12 tháng; phải đo dung lượng trước cam kết |

**10 phút mặc định, 30 phút tối đa và tổng 20 phút là giá trị thiết kế phục vụ MVP/demo, không phải kết quả nghiên cứu về thời gian hỏng của hàng.** Phải ghi rõ điều này trong báo cáo và demo.

## 2. Kiến trúc và phân quyền

```text
Web/App ──JWT──> NestJS API ──transaction──> Supabase PostgreSQL
Web/App ──JWT/RLS, chỉ đọc──> view được cấp phép
Thiết bị/Simulator ──MQTT TLS──> Mosquitto ──> Ingest ──> PostgreSQL
API/Ingest ──outbox──> Publisher ──MQTT──> thiết bị
```

Supabase CLI là hệ migration duy nhất, backend dùng Kysely + pg. API/ingest/publisher là process riêng. Kiểm tra JWT rồi account_access active, vai trò/phạm vi/trạng thái nghiệp vụ trong DB. Client không ghi bảng nghiệp vụ/RPC trực tiếp; credential và service role chỉ server.

| Chức năng | Admin | Khách | Tài xế |
|---|---|---|---|
| Lô hàng | Duyệt/từ chối/phân công/hủy đúng trạng thái | Tạo/sửa lô mình draft/pending_review, submit/hủy trước đi | Đọc lô được giao |
| Chuyến/giao nhận | Phân công/quản lý | Đọc chuyến/bằng chứng lô mình | Khởi hành/hoàn thành chuyến được giao, driver_notes, bằng chứng |
| Nhiệt/độ ẩm/cửa | Đọc | Lô mình kể cả sau chuyến | Chuyến được giao |
| GPS | Đọc | Đề xuất chỉ khi in_transit | Chuyến được giao |
| Dải nhiệt | Tạo phiên bản, gửi xuống | Không | Không |
| Relay tay | Gửi on/off | Không | Không, API403 |
| Cảnh báo | Xác nhận/đóng có ghi chú | Đọc theo lô | Xác nhận đã nhận theo chuyến |
| Xe/thiết bị/credential | Quản lý, không xem lại secret | Không | Đọc thông tin vận hành xe được giao |
| Hồ sơ/thông báo | Đúng phạm vi | Của mình | Của mình |

Pending/suspended không đọc dữ liệu nghiệp vụ. Không lộ hồ sơ tài xế cho khách. Chính sách GPS áp dụng trên view, JSON, lịch sử/realtime, không chỉ ẩn marker. GPS sau chuyến, chính sách đánh giá chất lượng, dữ liệu nhạy cảm, chữ ký và retention vẫn cần rà soát; các thông số điều khiển mục1 đã theo yêu cầu v0.5, không tiếp tục treo quyết định điều khiển cũ.

## 3. Schema tối thiểu

Mặc định id UUID, timestamptz UTC, hiển thị Asia/Ho_Chi_Minh. Không cascade xóa lịch sử nghiệp vụ.

| Nhóm | Bảng và trường chính |
|---|---|
| Tài khoản | profiles(id=auth.users.id, full_name, phone, email); roles/permissions/role_permissions; account_access(user_id unique, role_id, status, activated_by/at); account_invitations(token_hash, role_id, expiry/used_at) |
| Tài nguyên | vehicles(plate unique, temp_capacity_min/max, payload_kg, status, version); devices(device_code unique, vehicle_id nullable, is_simulated, status, last_seen_at, next_config_version_no); device_credentials(hash tương thích broker, active/revoked, provisioning_status); device_assignments(device,vehicle,valid_from/to) |
| Lô | shipments(customer_id, product_type, temp_min/max, warehouse_notes, status, review/reject fields, version, deleted_at) |
| Chuyến | trips(shipment_id,vehicle_id,driver_id,device_id,departure_config_version_id,status,departed_at,completed_at,driver_notes,manual_off_issued_seconds default0,result,evaluation_version/details,version) |
| Giao nhận | delivery_proofs(trip_id unique,photo_path riêng tư,signed_by,received_at,created_by) |
| Cấu hình | temperature_config_versions(device_id,trip_id,config_version_no,target_min/max,status approved/sent/applied/failed/superseded,issued_by/at,applied_at,failure_reason,version) |
| Lệnh | device_commands(command_id unique,device_id,trip_id,type set_target_range/set_relay_manual,payload,config_version_id nullable,state nullable,duration_seconds nullable,issued_at,expires_at,status,issued_by,failure_reason) |
| Gửi/ACK | device_command_attempts(command_id,attempt_no,sent_at,result), unique(command_id,attempt_no); device_command_acks(command_id,ack_id unique theo device,result,reason,retry_after_seconds,received_at,payload) |
| Telemetry | telemetry_readings(message_id unique,device_id,trip_id/session_id nullable,boot_id,sequence_no,monotonic_ms,measured_at_device nullable,time_source gps/ntp/unknown,time_quality good/unknown,received_at,is_backfill,temperature_c,humidity_pct,door_open,GPS,sensor_status,config_version_no,relay_state on/off,control_mode auto/manual,manual_expires_at nullable) |
| Latest/phiên | device_latest_state(device_id PK,active_boot_id,last_sequence_no,last_received_at,last_fresh_sample_at,latest telemetry fields); device_sessions(device_id,boot_id,trip_id nullable,started_at/ended_at,start/end_monotonic_ms nullable) |
| Sự kiện/cảnh báo | device_events(event_id,device_id,trip_id nullable,type,measured_at nullable,received_at,payload); alerts(trip,device,type,status open/acknowledged/resolved,opened/recovered/acknowledged/resolved_at,actor,resolution_note); alert_events |
| Rollup | telemetry_rollups_minute(id,device_id,trip_id/config_version_id nullable,minute_utc,window/covered/missing_seconds,sample_count,valid_sample_count,temp_min/max/avg,humidity_avg,door_open_seconds) |
| Hệ thống | notifications; audit_logs; idempotency_requests(user_id,key,operation,payload_hash,response); outbox_events(topic,payload,status pending/published/failed,attempts,available_at) |

Ràng buộc:

- shipments.status: draft,pending_review,approved,rejected,scheduled,in_transit,completed,cancelled. trips.status: scheduled,in_transit,completed,cancelled.
- Dải shipment/config trong giới hạn mục1, min/max bội0,5°C và max−min>1°C. Không áp bước này lên số đo cảm biến.
- Unique riêng trên vehicle_id,driver_id,shipment_id,device_id của trips WHERE status IN ('scheduled','in_transit'). Một thiết bị chính/xe, không đổi giữa chuyến đang chạy.
- config_version_no tăng đơn điệu theo thiết bị qua mọi chuyến, cấp dưới khóa devices, unique(device_id,config_version_no). Không reset tại đầu chuyến. version bản ghi dùng chống cập nhật đồng thời, khác phiên bản cấu hình gửi firmware.
- manual_off_issued_seconds integer trong[0,1200], là tổng thời lượng lệnh đã cấp, không phải thời gian tắt thực đo được. Không có bảng quản lý ngân sách riêng.
- Command status: queued,sent,acked_applied,acked_rejected,timed_out,failed. failure_reason nullable CHECK allowlist expired,publish_failed,device_failed,superseded_command,internal_error. Guard rejection lưu ACK reason, không giả thành lỗi hệ thống.
- Rollup unique(device_id,trip_id,config_version_id,minute_utc) NULLS NOT DISTINCT, PostgreSQL>=15. Thêm index(trip_id,minute_utc),(device_id,minute_utc). window∈[0,60], covered+missing=window; phút chia cấu hình tại giây20 có window20+40=60, phút đầu/cuối chỉ tính phần thuộc chuyến.
- Một cảnh báo cùng loại chưa resolved/chuyến; ngoài chuyến chỉ device_events. Session/ACK/audit giữ trong phạm vi đồ án, không client-readable.

## 4. MQTT và firmware

QoS1, TLS, username=device_code, ACL chỉ nhánh thiết bị. Broker buộc username đúng topic; ingest kiểm tra payload-topic. Topic đầy đủ có tiền tố devices/{device_code}/.

| Hậu tố topic | Chiều | Retained |
|---|---|---|
| telemetry,events | Thiết bị → ingest | Không |
| status | Thiết bị → ingest, online/offline Last Will | Có |
| command-acks | Thiết bị → ingest | Không |
| commands | Publisher → thiết bị | Không |
| sync-acks | Publisher → thiết bị, xác nhận dữ liệu commit DB | Không |

Status có boot_id,connection_id,state. Retained online không chứng minh cảm biến còn mới. boot_id UUID mới mỗi reboot, không đổi khi reconnect; sequence_no tăng trong boot, không sắp xếp UUID giữa hai boot.

### 4.1 Dải nhiệt

```json
{
  "schema_version": 1,
  "command_id": "a1b2c3d4-0000-4000-8000-000000000002",
  "type": "set_target_range",
  "config_version_no": 27,
  "target_min": -20.0,
  "target_max": -18.0,
  "issued_at": "2026-11-15T03:00:00Z",
  "expires_at": "2026-11-15T03:00:30Z"
}
```

Chỉ áp config_version_no lớn hơn số đang lưu bền vững. Phiên bản nhỏ bị rejected/stale_config_version; bằng thì không áp lại. Command_id trùng trả ACK đã lưu. Lưu dải/số phiên bản nguyên tử trước ACK. Áp cấu hình mới về auto, reset bộ đếm cảnh báo; đổi relay nếu cần vẫn chịu45 giây. >max bật, <min tắt; ở giữa/đúng biên giữ nguyên.

### 4.2 Relay tay

```json
{
  "schema_version": 1,
  "command_id": "64fafdaa-d4b1-41f8-a3fa-b1714d5a82ef",
  "type": "set_relay_manual",
  "state": "off",
  "duration_seconds": 600,
  "issued_at": "2026-11-15T03:05:00Z",
  "expires_at": "2026-11-15T03:05:30Z"
}
```

Lệnh đặt trạng thái đích. Deadline monotonic bắt đầu khi áp dụng thành công; manual_expires_at là UTC lúc áp dụng+duration_seconds. Retry cùng ID không thực thi/kéo dài hạn. Mỗi thiết bị tối đa một command chưa kết thúc; lệnh mới sau ACK phải dùng ID mới.

- Cần đổi relay mà chưa đủ45 giây: ACK rejected/min_switch_interval/retry_after_seconds; không ngầm đợi lệnh tay hoặc giữ sent mãi. Muốn thử lại tạo lệnh mới. Relay đã đúng state thì có thể áp mode/thời hạn mà không tạo lần đổi giả.
- Hết deadline tay: mode auto, manual_expires_at=null. Tính relay theo hysteresis; cần đổi nhưng guard chưa đủ thì chờ đủ rồi kiểm tra lại nhiệt. Guard không chặn kết thúc chế độ tay.
- Đang manual off mà nhiệt>target_max: yêu cầu bật relay ngay khi đủ45 giây từ lần đổi trước, không chờ server/hết duration. Khi bật, hủy chế độ tay về auto, xóa manual_expires_at; không tự tái áp off cũ. Nếu chưa đủ45 giây, chờ và kiểm tra lại nhiệt trước khi đổi.
- Mọi lần đổi relay thực cập nhật last_relay_changed_monotonic_ms, cách lần trước>=45 giây. Firmware kiểm tra mẫu local, không chờ chu kỳ publish. Nhiệt lỗi báo sensor_error, không coi là bằng chứng quá nhiệt hoặc an toàn.
- Manual on cũng hết hạn về auto. Mất mạng không ảnh hưởng auto/deadline/guard. Reboot về auto, không bắt đầu lại thời lượng tay; guard khởi động45 giây trước lần đổi đầu khi không biết mốc đổi cuối.

```json
{
  "ack_id": "285a6b0c-603d-4ee1-868a-86a6557ce625",
  "command_id": "64fafdaa-d4b1-41f8-a3fa-b1714d5a82ef",
  "result": "rejected",
  "reason": "min_switch_interval",
  "retry_after_seconds": 20
}
```

ACK result applied/rejected/failed. applied nghĩa firmware đã xử lý yêu cầu relay, không xác nhận máy nén vật lý chạy. ID/ACK đã xử lý lưu bền vững; mất dữ liệu flash thì về auto, báo lỗi lưu trữ, cần admin cấu hình lại, không có giao thức bootstrap điều khiển trong MVP.

### 4.3 Telemetry và giờ

```json
{
  "schema_version": 1,
  "device_code": "CT-001",
  "message_id": "6f1c2a9e-4f0b-4a7e-9d2a-1d3b5c7e8f90",
  "boot_id": "cc785542-51ca-4c29-8ee7-acd9e79920ac",
  "sequence_no": 1042,
  "monotonic_ms": 15630000,
  "measured_at_device": "2026-11-15T03:05:10Z",
  "time_source": "gps",
  "time_quality": "good",
  "is_backfill": false,
  "config_version_no": 27,
  "temperature_c": -19.4,
  "humidity_pct": 62.1,
  "door_open": false,
  "relay_state": "off",
  "control_mode": "manual",
  "manual_expires_at": "2026-11-15T03:15:01Z",
  "gps": { "fix": true, "lat": 10.7769, "lng": 106.7009 },
  "sensor_status": { "temp": "ok" }
}
```

relay_state là trạng thái lệnh relay do thiết bị tính, không phải xác nhận máy nén đang chạy. Mode auto thì manual_expires_at=null. Thiếu GPS/NTP tin cậy: time_source/time_quality=unknown, measured_at_device=null. Thiết bị chưa có giờ tin cậy từ chối lệnh mới cần kiểm tra expires_at bằng reason=clock_unsynced; auto và deadline monotonic đã chạy vẫn tiếp tục. Không lấy giờ nhận server làm giờ đo gửi bù.

## 5. API BE-2 và tổng tắt tay

Prefix /api/v1. JWT và account_access active; mọi mutation có Idempotency-Key. Cùng key/method/path/body trả kết quả đã commit, không thực thi lại; key khác payload409. Cập nhật/approve/reject có version entity đã xem; sai409 VERSION_CONFLICT.

| Endpoint | Quyền và điều kiện |
|---|---|
| PATCH /me; invitation/account | Hồ sơ đúng chủ; mời/kích hoạt/suspend chỉ admin |
| POST/PATCH /shipments; submit/cancel | Khách sở hữu, đúng trạng thái, không tự đổi chủ |
| POST /shipments/:id/approve hoặc reject | Admin, version; reject cần lý do |
| POST /shipments/:id/assign | Admin, kiểm tra tài nguyên và dải xe bao phủ dải lô |
| POST /trips/:id/depart | Tài xế được giao; scheduled, telemetry live trong60 giây, config_version_no khớp cấu hình được phép của chuyến; không chờ config.status=applied/ACK |
| POST /trips/:id/complete; upload proof | Tài xế được giao, in_transit, bằng chứng đúng phạm vi |
| POST /trips/:id/cancel | Admin, scheduled, trả lô approved |
| POST /trips/:id/temperature-configs | Admin, version chuyến; cấp config_version_no, tạo set_target_range |
| POST /trips/:id/commands | Chỉ admin, chỉ set_relay_manual, chuyến in_transit và thiết bị online theo mẫu live trong60 giây; tài xế/khách403 |
| GET /device-commands/:command_id | Theo phạm vi đọc chuyến, trả status/ACK/reason/retry_after_seconds |
| POST /alerts/:id/acknowledge hoặc resolve | Tài xế được giao/admin ACK; chỉ admin resolve có ghi chú |
| POST /notifications/:id/read | Người nhận |

Body commands chỉ type,state,duration_seconds (thiếu thì600), từ chối trường ngoài hợp đồng. Thời lượng integer1..1800. Off tính tổng chuyến<=1200, on không cộng. Retained status/backfill không đủ chứng minh online.

**Thời điểm tính tổng:** server cấp command off trong transaction của POST /commands, tại issued_at, cộng toàn bộ duration_seconds vào trips.manual_off_issued_seconds. Command/outbox/audit/response idempotency cùng commit; không đợi publish hoặc ACK. Tổng mới>1200 thì rollback,409 OFF_LIMIT_REACHED, không tạo lệnh. Off1800 bị từ chối dù nằm trong giới hạn thời lượng một lệnh. Sau commit không hoàn khi guard rejected, publish lỗi, timeout, kết thúc sớm hoặc quá nhiệt. Response mất rồi replay cùng key không cộng lại; lỗi trước commit không tính như đã cấp. Khóa trip/device để hai request không vượt tổng; không giữ chỗ hoặc đối soát thời gian tắt thực.

HTTP202 trả command_id/queued, chưa có nghĩa thiết bị đã thực hiện. Sau guard ACK rejected, GET trả acked_rejected và “chưa thực hiện, thử lại sau X giây”. Lỗi:400 payload,401 JWT,403 quyền,404 ngoài phạm vi/không tồn tại,409 version/xung đột/command chờ/hạn mức,422 chưa đủ điều kiện khởi hành hoặc bằng chứng.

## 6. Đồng bộ lô/chuyến

| Action trong transaction | shipments.status | trips.status |
|---|---|---|
| Tạo/submit/approve hoặc reject | draft → pending_review → approved hoặc rejected | Chưa tạo |
| assign | approved → scheduled | Tạo scheduled |
| depart | scheduled → in_transit | scheduled → in_transit |
| complete | in_transit → completed | in_transit → completed |
| Hủy chuyến scheduled | scheduled → approved | scheduled → cancelled |
| Hủy toàn lô trước đi | draft/pending_review/approved/scheduled → cancelled | Hủy scheduled liên quan nếu có |

NestJS khóa/cập nhật hai bảng cùng transaction với audit/notification/outbox liên quan; không hai request hoặc trigger bất đồng bộ. Không PATCH status tùy ý; rejected/cancelled/completed của lô là cuối. Complete chấm dứt quyền gửi lệnh mới; thiết bị còn lệnh tay tự hết hạn về auto, không phụ thuộc server gửi thêm khi offline.

## 7. Ingest, cảnh báo và gửi bù

- Mỗi mẫu ghi SD trước publish; chỉ xóa theo sync-acks cho message_id đã commit. MQTT PUBACK không thay sync ACK dữ liệu.
- Trùng ID đúng thiết bị/nội dung: không ghi lại, ACK lại. Khác nội dung/thiết bị: xung đột, không ACK nhầm. Nhiệt ngoài[−30,10]°C lưu out_of_range, không dùng đánh giá nhiệt.
- Latest chỉ tiến sequence trong boot đang hoạt động đã xác nhận; boot cũ/backfill không ghi đè. last_received_at cho đường truyền, last_fresh_sample_at cho mẫu live có giờ tin cậy. Chưa chứng minh độ mới thì chất lượng không xác định, không giả mới.
- Gán trip theo thiết bị chốt/giờ đo trong[departed_at,completed_at), không theo chuyến hiện tại lúc nhận. Không rõ giờ chỉ gán khi đoạn boot/monotonic device_sessions xác định duy nhất; chưa đủ thì trip_id=null, chỉ admin đọc. Cùng boot có thể qua nhiều chuyến.
- Nhiệt high/low ngoài dải đủ120 giây; khoảng mẫu tối đa2 chu kỳ (30 giây thật/60 mô phỏng), lớn hơn/mẫu lỗi reset. Không nối qua gap300 giây. Phục hồi trong[min+0,5;max−0,5] đủ120 giây.
- Cửa mở đủ120 giây cảnh báo, đóng ghi recovered_at. Connection_lost sau>300 giây không telemetry hợp lệ. Gửi bù có thể phục hồi đường truyền, chưa làm cảm biến tươi.
- Phục hồi chỉ ghi mốc/event; admin resolve có ghi chú. Tái diễn trước resolve giữ alert/ghi alert_events. Backfill không tạo alert nhiệt realtime mới; phân tích lịch sử bằng job.

## 8. Đánh giá, tổng hợp và vận hành

Đề xuất pending_evaluation/pass/fail tách complete vận hành khỏi đánh giá nhiệt. Đủ bằng chứng giao nhận có thể complete; thiếu dữ liệu giữ pending, không tự pass. Chính sách chất lượng này còn để rà soát, không suy từ thời hạn lệnh relay.

Độ phủ: mẫu nhiệt hợp lệ đúng chuyến/cấu hình/giờ tại t đại diện[t,min(t+P,t_next,completed_at)), P15/30 giây, cắt theo chuyến/cấu hình. Mẫu lỗi kế tiếp chặn khoảng cũ, không tạo khoảng hợp lệ. Covered là hợp khoảng không trùng; coverage=100*covered/T. Đề xuất pass cần>=95%, không gap>300 giây, mẫu tốt60 giây cuối, biết cấu hình và không vi phạm nhiệt đủ120 giây; có bằng chứng vi phạm thì fail, thiếu thì pending. Backfill đánh giá lại có version/audit. Ví dụ chuyến600 giây,P15,mẫu0,15,…585 phủ100%; thiếu300/315/330/345 còn540/600=90%.

Rollup upsert theo phút/chuyến/config, không cộng lặp backfill, tạo cả phút thiếu hoàn toàn. Chỉ xóa chi tiết đã tổng hợp và không còn cần cho pending; mẫu không rõ giờ không gán phút nhận. Retention/ảnh chữ ký/dữ liệu nhạy cảm cần xác nhận theo phạm vi, chưa tự thêm trường cá nhân.

Compose local cho API/ingest/publisher/Mosquitto/simulator, Supabase DB/Auth/Storage. Credential file/ACL server đồng bộ, revoke restart broker có kiểm soát cho demo và ngắt mọi client. Reconnect backoff jitter cap30 giây tiếp tục khi service chạy; command riêng vẫn hết hạn30 giây/tối đa3 lượt publish, không gửi muộn khi broker phục hồi. Không ACK dữ liệu chưa commit.

Realtime tối giản notifications INSERT có RLS, payload invalidation không GPS/PII; dashboard đọc lại view mỗi15 giây. Không publish raw telemetry/credential/outbox. Không cam kết24/7 hoặc vừa quota miễn phí; đo dung lượng/kiểm tra Dashboard trước demo.

## 9. Nghiệm thu v0.5

1. Reset DB rỗng/upgrade baseline; RLS ba vai trò/pending/suspended; phân công đồng thời và client ghi trực tiếp bị chặn.
2. Driver gửi on/off hoặc đổi dải403. Admin sai trạng thái chuyến/offline bị từ chối. Endpoint commands không nhận set_target_range, cấu hình đi endpoint admin riêng.
3. Off600+600 đạt1200, off sau409; off900+600 bị chặn. Guard rejection/timeout không hoàn tổng; replay không cộng trùng, request đồng thời không vượt tổng.
4. Config mới lớn hơn mới áp; cũ/bằng không áp lại, reboot/qua chuyến vẫn giữ phiên bản.
5. Auto đúng hysteresis, mọi đổi cách>=45 giây; lệnh sớm rejected/min_switch_interval/retry_after_seconds. Quá nhiệt lúc manual off bật khi đủ45 giây và về auto; hết duration về auto, guard vẫn được giữ.
6. Mất mạng auto tiếp tục; deadline tay không kéo dài khi reconnect/UTC đổi; thiếu GPS/NTP giờ unknown và không nhận lệnh mới cần kiểm hạn.
7. Backfill/trùng/đảo thứ tự đúng chuyến/latest; stale dù broker online; cảnh báo120/300 giây, rollup chia phút/độ phủ tính lại được.
8. **Thiết bị thật:** ít nhất một lần relay tự bật và tự tắt đúng ngưỡng/45 giây, cùng ít nhất một lần tắt tay hết hạn về auto. Lưu nhiệt,mốc monotonic,config_version_no,relay_state/control_mode,ACK. Chọn nhiệt không vượt max sớm để lần thử hết hạn không bị quá nhiệt hủy trước; không lấy simulator thay bằng chứng thật.
9. Báo cáo ghi rõ10/30/20 phút là giá trị thiết kế, không phải nghiên cứu thời gian hỏng hàng; relay_state không xác nhận máy nén chạy. Chưa thực hiện kiểm thử runtime trong lượt soạn tài liệu.
