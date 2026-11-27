# Graph Report - DoAnTotNghiep  (2026-11-27)

## Corpus Check
- 195 files · ~142,261 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 21 file(s) not represented in the graph (top: (none) 8, .css 7, .example 2)

## Summary
- 1524 nodes · 3738 edges · 87 communities (71 shown, 16 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 26 edges (avg confidence: 0.88)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `3074dff8`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- driverTypes.ts
- Shared Admin Components
- BE-0: Đặc tả thiết kế backend ColdTrack
- Status Badges Content
- ColdTrack — Plan BE-1 đến BE-3 theo BE-0 v0.4
- ColdTrack — Thiết kế backend MVP để duyệt
- Product Interface Rules
- adminService.ts
- coldtrack-web/package.json
- Driver Implementation Handoff
- BE-0: Đặc tả thiết kế backend ColdTrack
- data.ts
- Frontend TypeScript Configuration
- Browser Verification Scripts
- Customer Implementation Handoff
- Node TypeScript Configuration
- Authentication Implementation Handoff
- Landing Implementation Handoff
- Admin Implementation Handoff
- Screen Role Mapping
- mqtt-local.ts
- DriverContext.tsx
- BE-0-backend-spec-review.md
- UpdateProfileDto
- Project Setup Guide
- profiles-invitations.integration.test.ts
- GuardFixtureController
- configure-local.mjs
- resources.integration.test.ts
- email-sender.ts
- React Lint Rules
- mqtt-credentials.integration.test.ts
- Demo Environment Flags
- Cold Chain Architecture
- ApiRequest
- 11. Bổ sung thiết kế để triển khai
- BE-0-thiet-ke-backend-coldtrack.md
- MutationDto
- ref_node_crypto
- NguoiDung
- schema.ts
- 5. Hợp đồng MQTT
- service.ts
- seed-demo.ts
- HealthController
- DemoState
- Graphify Navigation Rules
- HTML Document Shell
- coldtrack-be/package.json
- TypeScript Project References
- AdminService
- App.tsx
- types.ts
- App
- driver.test.tsx
- services
- x-app
- mosquitto-test
- environment
- driver.test.tsx
- mosquitto
- 4. MQTT và firmware
- publisher
- ingest
- seed-bootstrap.integration.test.ts
- ref_node_child_process
- Lightning Favicon Asset
- Reusable Icon Sprite
- Layered Hero Illustration
- React Branding Asset
- Vite Branding Asset
- scripts
- compilerOptions
- bootstrap.ts
- Các bước
- api
- BE-1-BE-3-implementation-plan.md
- app.ts
- tsconfig.build.json
- .prettierrc.json
- tsconfig.test.json
- scripts
- DatabaseLifecycle
- gen-certs.sh script
- test-tls.sh

## God Nodes (most connected - your core abstractions)
1. `react` - 48 edges
2. `App()` - 43 edges
3. `StatePanel()` - 40 edges
4. `numberVi()` - 39 edges
5. `temperatureVi()` - 38 edges
6. `ColdTrack Web: Quy tắc nghiệp vụ và từ vựng` - 37 edges
7. `rangeVi()` - 36 edges
8. `scripts` - 35 edges
9. `react-router-dom` - 35 edges
10. `Status()` - 34 edges

## Surprising Connections (you probably didn't know these)
- `Bước 2.1 — Guard API` --references--> `assertVersion()`  [INFERRED]
  coldtrack-be/README.md → coldtrack-be/libs/api/errors.ts
- `configureApi()` --indirect_call--> `requestId()`  [INFERRED]
  coldtrack-be/libs/api/api.module.ts → coldtrack-be/libs/api/errors.ts
- `open()` --calls--> `App()`  [EXTRACTED]
  coldtrack-web/src/auth/flows.test.tsx → coldtrack-web/src/App.tsx
- `open()` --calls--> `App()`  [EXTRACTED]
  coldtrack-web/src/auth/routing.test.tsx → coldtrack-web/src/App.tsx
- `AuthContext` --semantically_similar_to--> `AuthContext`  [INFERRED] [semantically similar]
  docs/B0-LANDING-HANDOFF.md → docs/B1-AUTH-HANDOFF.md

## Import Cycles
- None detected.

## Communities (87 total, 16 thin omitted)

### Community 0 - "driverTypes.ts"
Cohesion: 0.15
Nodes (24): createAdminMockData(), MOCK_USERS, DRIVER_HISTORY_OWNERS, DRIVER_MOCK, DRIVER_RESOURCE_IDS, driverMockConfig(), driverRuntime(), initialDriverSettings() (+16 more)

### Community 1 - "Shared Admin Components"
Cohesion: 0.10
Nodes (92): Chart(), DataGate(), DataTable(), ErrorNotice(), Filters(), KeyValues(), PageHeading(), Panel() (+84 more)

### Community 2 - "BE-0: Đặc tả thiết kế backend ColdTrack"
Cohesion: 0.14
Nodes (14): 0. Giả định và giá trị khởi đầu, 10. Chờ xác nhận, 12. Quyết định chờ chủ đồ án, 13. Đối chiếu rà soát, 14. Nghiệm thu bổ sung v0.4, 1. Kiến trúc và ranh giới truy cập, 2. ERD, 3. Bảng và ràng buộc chính (+6 more)

### Community 3 - "Status Badges Content"
Cohesion: 0.08
Nodes (51): Badge(), BadgeProps, BadgeVariant, getVariantFromStatus(), variantStyles, landingContent, LANDING_MOCK_OPTIONS, LANDING_TESTIMONIALS (+43 more)

### Community 4 - "ColdTrack — Plan BE-1 đến BE-3 theo BE-0 v0.4"
Cohesion: 0.11
Nodes (19): BE-1 — Nền dữ liệu, quyền và môi trường, BE-2 — API nghiệp vụ, transaction và lệnh, BE-3 — Ingest, firmware contract, cảnh báo và demo đầu-cuối, Bổ sung nghiệm thu F1–F15, C1. Mosquitto xác thực thế nào?, C2. Đồng bộ trạng thái máy nén, C3. Ingest chạy ở đâu, chi phí và rủi ro?, C4. Realtime: bảng, kênh và kết nối (+11 more)

### Community 5 - "ColdTrack — Thiết kế backend MVP để duyệt"
Cohesion: 0.04
Nodes (45): Bước 0.1 — API, Bước 0.2 — Docker Compose TLS, Bước 1.1 — Baseline tài khoản, Bước 1.2 — Xe, thiết bị và phân công, Bước 1.3 — Lô, chuyến, giao nhận và phiên thiết bị, Bước 1.8 — Seed demo và kiểu Kysely, Bước 1.9 — MQTT TLS, Bước 2.1 — Guard API (+37 more)

### Community 6 - "Product Interface Rules"
Cohesion: 0.07
Nodes (8): Badge, ColdTrack Web: Quy tắc nghiệp vụ và từ vựng, Drawer, Header, Modal, Sidebar, StatCard, Table

### Community 7 - "adminService.ts"
Cohesion: 0.14
Nodes (24): CUSTOMER_HISTORY_OWNERS, customerMockConfig(), initialCustomerSettings(), createMockAdminService(), setup(), AdminError, vehicleIssue(), createCustomerService() (+16 more)

### Community 8 - "coldtrack-web/package.json"
Cohesion: 0.06
Nodes (41): dependencies, lucide-react@^1.65.0, react@^19.3.1, react-dom@^19.3.1, react-router-dom@^7.18.5, tailwindcss@^4.3.3, @tailwindcss/vite@^4.3.3, devDependencies (+33 more)

### Community 9 - "Driver Implementation Handoff"
Cohesion: 0.09
Nodes (8): B4 — Tài xế ColdTrack Web, datChuan, DRIVER_HISTORY_OWNERS, DRIVER_RESOURCE_IDS, DriverProvider, DriverRepository, DriverService, trangThaiNhietDo

### Community 10 - "BE-0: Đặc tả thiết kế backend ColdTrack"
Cohesion: 0.04
Nodes (45): 0. Giả định và giá trị khởi đầu, 10. Chờ xác nhận, 11.1 Quy ước dữ liệu và giao dịch, 11.2 Hợp đồng HTTP API tối thiểu, 11.3 Thời gian, gửi bù và phân chuyến, 11.4 Tính liên tục và vòng đời cảnh báo, 11.5 Lệnh, outbox và cấu hình hiệu lực, 11.6 Hoàn thành chuyến, độ phủ và bằng chứng giao nhận (+37 more)

### Community 11 - "data.ts"
Cohesion: 0.21
Nodes (11): ADMIN_MOCK_OPTIONS, MOCK_CANH_BAO, MOCK_LICH_SU, MOCK_LO_HANG, MOCK_NHAT_KY, MOCK_XE, SAN_PHAM_DONG_LANH, THOI_GIAN_HIEN_THI (+3 more)

### Community 12 - "Frontend TypeScript Configuration"
Cohesion: 0.10
Nodes (19): compilerOptions, allowArbitraryExtensions, allowImportingTsExtensions, erasableSyntaxOnly, jsx, lib, module, moduleDetection (+11 more)

### Community 13 - "Browser Verification Scripts"
Cohesion: 0.11
Nodes (7): @playwright/test@^1.64.1, problems, problems, problems, problems, errors, @playwright/test

### Community 14 - "Customer Implementation Handoff"
Cohesion: 0.11
Nodes (5): B3 — Khách hàng ColdTrack Web, CUSTOMER_HISTORY_OWNERS, CustomerProvider, CustomerService, ShipmentSummary

### Community 15 - "Node TypeScript Configuration"
Cohesion: 0.12
Nodes (16): compilerOptions, allowImportingTsExtensions, erasableSyntaxOnly, lib, module, moduleDetection, noEmit, noFallthroughCasesInSwitch (+8 more)

### Community 16 - "Authentication Implementation Handoff"
Cohesion: 0.13
Nodes (8): AuthContext, AuthService, AuthContext, AuthError, AuthService, B1 — Xác thực ColdTrack Web, createMockAuthService, MOCK_USERS

### Community 17 - "Landing Implementation Handoff"
Cohesion: 0.13
Nodes (6): B0 — Landing ColdTrack và bổ sung chuyển hướng B1, customerMockConfig, GuestRoute, LandingService, Public tracking, customerMockConfig

### Community 18 - "Admin Implementation Handoff"
Cohesion: 0.13
Nodes (6): AdminProvider, AdminService, B2 — Điều phối ColdTrack Web, createMockAdminService, CSV, GPS

### Community 19 - "Screen Role Mapping"
Cohesion: 0.15
Nodes (6): AD-TongQuan, AUTH-DangNhap, Cold Chain Logistics Portal, ColdTrack Web: Ánh xạ màn hình Stitch, KH-LoHangCuaToi, TX-ChuyenHienTai

### Community 20 - "mqtt-local.ts"
Cohesion: 0.22
Nodes (16): derive, hashMosquittoCredential(), matchesMosquittoHash(), assertSim(), atomicWrite(), config, createSecret(), Entry (+8 more)

### Community 21 - "DriverContext.tsx"
Cohesion: 0.50
Nodes (7): Header(), Sidebar(), AppLayout(), AdminContext, useOptionalAdmin(), useOptionalCustomer(), useOptionalDriver()

### Community 22 - "BE-0-backend-spec-review.md"
Cohesion: 0.07
Nodes (28): 0. Giả định và giá trị khởi đầu, 10. Chờ xác nhận, 11.1 Quy ước dữ liệu và giao dịch, 11.2 Hợp đồng HTTP API tối thiểu, 11.3 Thời gian, gửi bù và phân chuyến, 11.4 Tính liên tục và vòng đời cảnh báo, 11.5 Lệnh, outbox và cấu hình hiệu lực, 11.6 Hoàn thành chuyến và bằng chứng giao nhận (+20 more)

### Community 23 - "UpdateProfileDto"
Cohesion: 0.12
Nodes (7): AcceptInvitationDto, InviteDto, UpdateProfileDto, AccountsService, invitationHash(), isUniqueConflict(), asService()

### Community 24 - "Project Setup Guide"
Cohesion: 0.25
Nodes (6): Oxlint, React, React + TypeScript + Vite, SWC, TypeScript, Vite

### Community 25 - "profiles-invitations.integration.test.ts"
Cohesion: 0.07
Nodes (17): AccountsModule, AppModule, createApi(), DevicesModule, HealthModule, ShipmentsModule, TripsModule, ApiModule (+9 more)

### Community 27 - "configure-local.mjs"
Cohesion: 0.18
Nodes (8): brokerConfig, databaseAddress, db, deviceFile, envFile, passwordPath, root, status

### Community 28 - "resources.integration.test.ts"
Cohesion: 0.47
Nodes (5): MOSQUITTO_HASH_ITERATIONS, asClient(), env, isolated(), rejected()

### Community 29 - "email-sender.ts"
Cohesion: 0.13
Nodes (8): EMAIL_SENDER, EmailMessage, EmailModule, EmailSender, MailpitEmailSender, NoopEmailSender, nodemailer@^10.6.1, nodemailer

### Community 30 - "React Lint Rules"
Cohesion: 0.33
Nodes (5): plugins, rules, react/only-export-components, react/rules-of-hooks, $schema

### Community 31 - "mqtt-credentials.integration.test.ts"
Cohesion: 0.14
Nodes (14): as(), ca, clients, db, delivered(), deniedWrite(), login(), marker() (+6 more)

### Community 32 - "Demo Environment Flags"
Cohesion: 0.33
Nodes (6): VITE_DEMO, VITE_DEMO, VITE_DEMO, VITE_DEMO, VITE_DEMO, VITE_DEMO

### Community 33 - "Cold Chain Architecture"
Cohesion: 0.33
Nodes (6): Audit log, coi lại giao thức MQTT : mosquitto mqtt, ETA, GPS, MQTT, Proof of Delivery

### Community 34 - "ApiRequest"
Cohesion: 0.31
Nodes (4): AccountsController, RequirePermission(), ApiRequest, IDEMPOTENT

### Community 35 - "11. Bổ sung thiết kế để triển khai"
Cohesion: 0.15
Nodes (13): 11.1 Quy ước dữ liệu và giao dịch, 11.2 Hợp đồng HTTP API tối thiểu, 11.3 Thời gian, gửi bù và phân chuyến, 11.4 Tính liên tục và vòng đời cảnh báo, 11.5.1 Thoát manual_off và ưu tiên firmware (F1/F12), 11.5.2 Tổng ngân sách off mỗi chuyến (F2), 11.5.3 Phục hồi control_seq khi hỏng flash/thay thiết bị (F10), 11.5 Lệnh, outbox và cấu hình hiệu lực (+5 more)

### Community 36 - "BE-0-thiet-ke-backend-coldtrack.md"
Cohesion: 0.18
Nodes (9): 1. Phạm vi và thông số, 2. Kiến trúc và phân quyền, 3. Schema tối thiểu, 5. API BE-2 và tổng tắt tay, 6. Đồng bộ lô/chuyến, 7. Ingest, cảnh báo và gửi bù, 8. Đánh giá, tổng hợp và vận hành, 9. Nghiệm thu v0.5 (+1 more)

### Community 38 - "ref_node_crypto"
Cohesion: 0.06
Nodes (35): validateEnvironment(), dotenv@18.0.10, pg@8.23.1, @supabase/supabase-js@2.119.0, asClient(), env, profileIds(), asClient() (+27 more)

### Community 39 - "NguoiDung"
Cohesion: 0.18
Nodes (5): AuthContextType, LoHang, NguoiDung, CustomerRepository, DriverRepository

### Community 40 - "schema.ts"
Cohesion: 0.05
Nodes (40): AccountAccess, AccountInvitations, AlertEvents, Alerts, AuditLogs, CustomerShipmentsView, CustomerTripsView, DeliveryProofs (+32 more)

### Community 41 - "5. Hợp đồng MQTT"
Cohesion: 0.29
Nodes (7): 5.1 Topic, 5.2 Payload telemetry, 5.3 Sync ACK, 5.4 Lệnh điều khiển, 5.5 Time-sync, 5.6 Quyền ACL (Mosquitto), 5. Hợp đồng MQTT

### Community 42 - "service.ts"
Cohesion: 0.19
Nodes (12): AuthError, createMockAuthService(), RegisterInput, ResetRequest, setup(), AuthFormKind, AuthFormValues, PASSWORD_HELP (+4 more)

### Community 43 - "seed-demo.ts"
Cohesion: 0.29
Nodes (8): accounts, deviceCodes, envPath, localUrl(), readIfPresent(), rootEnvPath, saveCredential(), seed()

### Community 45 - "DemoState"
Cohesion: 0.10
Nodes (7): DemoState, CustomerContext, Value, CustomerData, CustomerService, Value, DriverService

### Community 46 - "Graphify Navigation Rules"
Cohesion: 0.67
Nodes (3): graphify, graphify query, graphify update

### Community 47 - "HTML Document Shell"
Cohesion: 0.67
Nodes (3): <!doctype html>, ColdTrack, Inter

### Community 48 - "coldtrack-be/package.json"
Cohesion: 0.05
Nodes (55): dependencies, class-transformer@0.5.1, class-validator@0.15.1, helmet@8.3.0, jose@6.2.17, kysely@0.29.8, @nestjs/common@12.4.2, @nestjs/config@^12.1.1 (+47 more)

### Community 51 - "App.tsx"
Cohesion: 0.24
Nodes (12): NotFoundPage(), AuthHeading(), AuthLayout(), AuthLogo(), BackToLogin(), AuthFormPage(), ResetExpiredPage(), ResetSuccessPage() (+4 more)

### Community 52 - "types.ts"
Cohesion: 0.19
Nodes (14): HomeRedirect(), AuthContext, useAuth(), ForbiddenPage(), GuestRoute(), allowedPaths, postLoginDestination(), ProtectedRoute() (+6 more)

### Community 53 - "App"
Cohesion: 0.17
Nodes (20): App(), OverviewAlias(), AuthProvider(), BackLink(), setup(), ApprovalPage(), DriversPage(), LogsPage() (+12 more)

### Community 54 - "driver.test.tsx"
Cohesion: 0.35
Nodes (9): Identity(), setup(), DriverAlertsPage(), DriverCurrentPage(), DriverHistoryPage(), DriverContext, DriverProvider(), createDriverService() (+1 more)

### Community 55 - "services"
Cohesion: 0.22
Nodes (8): image, ports, restart, name, services, mailpit, volumes, mqtt-data

### Community 56 - "x-app"
Cohesion: 0.20
Nodes (10): depends_on, mosquitto, depends_on, condition, depends_on, x-app, depends_on, init (+2 more)

### Community 57 - "mosquitto-test"
Cohesion: 0.20
Nodes (10): command, image, networks, ports, profiles, volumes, networks, tls-test (+2 more)

### Community 58 - "environment"
Cohesion: 0.42
Nodes (9): environment, DATABASE_URL, MQTT_CA_FILE, MQTT_URL, NODE_ENV, PORT, environment, environment (+1 more)

### Community 59 - "driver.test.tsx"
Cohesion: 0.12
Nodes (8): @testing-library/react@^16.3.3, open(), open(), AuthService, authService, AUTH_MOCK, MOCK_THONG_KE, @testing-library/react

### Community 60 - "mosquitto"
Cohesion: 0.40
Nodes (5): image, ports, restart, volumes, mosquitto

### Community 61 - "4. MQTT và firmware"
Cohesion: 0.50
Nodes (4): 4.1 Dải nhiệt, 4.2 Relay tay, 4.3 Telemetry và giờ, 4. MQTT và firmware

### Community 62 - "publisher"
Cohesion: 0.24
Nodes (10): build, context, target, build, build, env_file, init, restart (+2 more)

### Community 63 - "ingest"
Cohesion: 0.40
Nodes (5): env_file, init, restart, volumes, ingest

### Community 64 - "seed-bootstrap.integration.test.ts"
Cohesion: 0.22
Nodes (5): authClient(), credentialPath, demoCodes, env, signIn()

### Community 65 - "ref_node_child_process"
Cohesion: 0.33
Nodes (3): device, env, mqtt

### Community 101 - "scripts"
Cohesion: 0.06
Nodes (35): scripts, build, check:local, db:migration, db:reset, db:seed, db:start, db:start:full (+27 more)

### Community 103 - "compilerOptions"
Cohesion: 0.12
Nodes (16): compilerOptions, emitDecoratorMetadata, esModuleInterop, experimentalDecorators, forceConsistentCasingInFileNames, module, moduleResolution, outDir (+8 more)

### Community 105 - "bootstrap.ts"
Cohesion: 0.13
Nodes (15): ApiErrorFilter, bootstrap(), Environment, loadEnvironment(), optionalValue, port, positiveInt, schema (+7 more)

### Community 106 - "Các bước"
Cohesion: 0.20
Nodes (9): BE-1: Dữ liệu, quyền, môi trường, BE-2: API, giao dịch, publisher, BE-3: Ingest, cảnh báo, simulator, demo, Các bước, Firmware (song song), Giai đoạn 0: Nền tảng, Kế hoạch triển khai backend ColdTrack, Quy tắc thực hiện (+1 more)

### Community 107 - "api"
Cohesion: 0.18
Nodes (11): healthcheck, init, ports, restart, volumes, interval, retries, start_period (+3 more)

### Community 108 - "BE-1-BE-3-implementation-plan.md"
Cohesion: 0.25
Nodes (6): BE-1 — Dữ liệu, quyền và môi trường, BE-2 — API, giao dịch và publisher, BE-3 — Firmware contract, ingest, simulator và demo, Bàn giao và giới hạn lượt này, Ghi chú thay đổi, Quyết định hiện hành

### Community 109 - "app.ts"
Cohesion: 0.12
Nodes (20): AuthGuard, PERMISSIONS, PUBLIC, Public(), ApiError, assertVersion(), ErrorCode, messages (+12 more)

### Community 110 - "tsconfig.build.json"
Cohesion: 0.50
Nodes (3): exclude, extends, ./tsconfig.json

### Community 112 - "tsconfig.test.json"
Cohesion: 0.25
Nodes (7): compilerOptions, outDir, sourceMap, exclude, extends, include, ./tsconfig.json

### Community 113 - "scripts"
Cohesion: 0.25
Nodes (7): name, private, scripts, build, lint, start, test

## Knowledge Gaps
- **60 isolated node(s):** `./tsconfig.json`, `./tsconfig.json`, `Vite logo`, `Vite branding asset`, `CUSTOMER_HISTORY_OWNERS` (+55 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 719 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **16 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `react` connect `Shared Admin Components` to `Status Badges Content`, `coldtrack-web/package.json`, `DemoState`, `App.tsx`, `types.ts`, `DriverContext.tsx`, `App`, `driver.test.tsx`?**
  _High betweenness centrality (0.090) - this node is a cross-community bridge._
- **What connects `./tsconfig.json`, `./tsconfig.json`, `Vite logo` to the rest of the system?**
  _60 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `driverTypes.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.14962121212121213 - nodes in this community are weakly interconnected._
- **Why does `@playwright/test` connect `Browser Verification Scripts` to `coldtrack-web/package.json`?**
  _High betweenness centrality (0.069) - this node is a cross-community bridge._
- **Should `Shared Admin Components` be split into smaller, more focused modules?**
  _Cohesion score 0.10464516129032259 - nodes in this community are weakly interconnected._
- **Why does `react-router-dom` connect `Shared Admin Components` to `Status Badges Content`, `coldtrack-web/package.json`, `App.tsx`, `types.ts`, `App`, `DriverContext.tsx`, `driver.test.tsx`?**
  _High betweenness centrality (0.052) - this node is a cross-community bridge._
- **Should `BE-0: Đặc tả thiết kế backend ColdTrack` be split into smaller, more focused modules?**
  _Cohesion score 0.14285714285714285 - nodes in this community are weakly interconnected._