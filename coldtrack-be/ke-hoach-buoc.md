# Kế hoạch triển khai backend ColdTrack

Nguồn đặc tả: `BE-0-thiet-ke-backend-coldtrack.md` (v0.5) và `BE-1-BE-3-implementation-plan.md`.

## Quyết định đã chốt

1. **Khởi hành chuyến:** không chờ ACK applied. Điều kiện: telemetry tươi trong 60 giây và `config_version_no` khớp.
2. **Ngưỡng đánh giá chuyến:** pass khi độ phủ ≥ 95% và không có khoảng trống (gap) > 300 giây. Thiếu dữ liệu thì giữ `pending`, không tự pass.
3. **GPS cho khách:** xem realtime khi `in_transit`. Sau khi hoàn tất, xem lịch sử trong 7 ngày, chỉ thấy tổng quãng đường và thời gian.
4. **Retention:** telemetry chi tiết 7 ngày. Rollup phút 3–6 tháng (chốt số cụ thể sau khi đo dung lượng). Không xóa dữ liệu chuyến chưa đánh giá.
5. **Firmware:** VS Code + PlatformIO, ESP32, framework ESP-IDF.
6. **Môi trường DB:** Supabase local qua Docker. PostgreSQL 15 trở lên.

## Quy tắc thực hiện

- Mỗi bước: code → test → báo kết quả → chỉ sang bước sau khi test xanh.
- Test DB dùng PostgreSQL thật, không mock.
- Sau mỗi bước sửa code, chạy `graphify update .` theo quy tắc dự án.
- Gặp quyết định ngoài kế hoạch thì dừng và hỏi.

## Các bước

### Giai đoạn 0: Nền tảng
- **0.1** Khung NestJS, Kysely + pg, cấu hình env, lint, test. Health endpoint `/api/v1/health`.
- **0.2** Docker Compose: PostgreSQL, Mosquitto TLS, API, ingest, publisher.

### BE-1: Dữ liệu, quyền, môi trường
- **1.1** Migration baseline: roles, permissions, profiles, account_access, hàm RLS.
- **1.2** Xe, thiết bị, credential, assignments.
- **1.3** Lô hàng, chuyến, device_sessions, bằng chứng giao nhận.
- **1.4** Telemetry, latest state, sự kiện, rollup phút.
- **1.5** Cấu hình nhiệt, lệnh, attempts, ACK, FK muộn.
- **1.6** Cảnh báo, thông báo, audit, idempotency, outbox.
- **1.7** View theo vai trò, Storage, realtime, RLS cho ba vai trò.
- **1.8** Seed demo, bootstrap admin, sinh kiểu Kysely, CI kiểm tra drift.
- **1.9** Mosquitto: TLS, credential và ACL từng thiết bị.

### BE-2: API, giao dịch, publisher
- **2.1** Guard JWT, DTO, Idempotency-Key, version, định dạng lỗi.
- **2.2** Hồ sơ, mời, kích hoạt, tạm ngưng tài khoản.
- **2.3** Lô hàng: tạo, sửa, submit, duyệt, từ chối, phân công, hủy.
- **2.4** Chuyến: khởi hành, hoàn thành, hủy, bằng chứng.
- **2.5** Cấu hình nhiệt (admin): cấp `config_version_no`, outbox `set_target_range`.
- **2.6** Lệnh relay tay: giới hạn 1200 giây/chuyến trong transaction.
- **2.7** Publisher: tối đa 3 lượt, backoff 0/10/20 giây, hết hạn 30 giây.
- **2.8** Cảnh báo và thông báo theo phạm vi.

### BE-3: Ingest, cảnh báo, simulator, demo
- **3.1** Ingest: đối chiếu topic, dedup, commit trước khi gửi sync-ack.
- **3.2** Latest state và device_sessions theo boot_id và sequence.
- **3.3** Gán chuyến cho telemetry (kể cả backfill).
- **3.4** Cảnh báo nhiệt và cửa (120 giây), mất tín hiệu (300 giây), phục hồi.
- **3.5** Rollup phút và độ phủ.
- **3.6** Đánh giá chuyến pass/fail/pending.
- **3.7** Simulator 4 thiết bị mô phỏng, kịch bản xác định.
- **3.8** Realtime chỉ gửi invalidation, dashboard đọc lại mỗi 15 giây.

### Firmware (song song)
- **F1** Lưu cấu hình nguyên tử, chỉ áp `config_version_no` lớn hơn.
- **F2** Relay hysteresis, guard 45 giây, lệnh tay có deadline monotonic.
- **F3** MQTT, SD buffer, ACK, dedup.
- **F4** Nghiệm thu thiết bị thật (thủ công): relay tự bật/tắt đúng ngưỡng; tắt tay hết hạn về auto.
