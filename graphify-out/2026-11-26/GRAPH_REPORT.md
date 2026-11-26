# Graph Report - DoAnTotNghiep  (2026-11-26)

## Corpus Check
- 177 files · ~131,267 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 21 file(s) not represented in the graph (top: (none) 9, .css 7, .example 2)

## Summary
- 1317 nodes · 3223 edges · 75 communities (61 shown, 14 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS · INFERRED: 14 edges (avg confidence: 0.91)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `6dccfbfb`
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
- Development Tool Dependencies
- Driver Implementation Handoff
- BE-0: Đặc tả thiết kế backend ColdTrack
- adminTypes.ts
- Frontend TypeScript Configuration
- Browser Verification Scripts
- Customer Implementation Handoff
- Node TypeScript Configuration
- Authentication Implementation Handoff
- Landing Implementation Handoff
- Admin Implementation Handoff
- Screen Role Mapping
- flows.test.tsx
- AuthPages.tsx
- BE-0-backend-spec-review.md
- CustomerContext.tsx
- Project Setup Guide
- dependencies
- react
- configure-local.mjs
- resources.integration.test.ts
- ColdTrack — Plan BE-1 đến BE-3 theo BE-0 v0.3
- React Lint Rules
- data.ts
- Demo Environment Flags
- Cold Chain Architecture
- 11. Bổ sung thiết kế để triển khai
- 5. Hợp đồng MQTT
- useAuth
- views-storage-realtime.integration.test.ts
- pg
- NguoiDung
- schema.ts
- App
- service.ts
- seed-demo.ts
- HealthController
- AdminService
- Graphify Navigation Rules
- HTML Document Shell
- coldtrack-be/package.json
- TypeScript Project References
- shipments-trips.integration.test.ts
- seed-bootstrap.integration.test.ts
- customer.test.tsx
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
- transport.ts
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
8. `react-router-dom` - 35 edges
9. `Status()` - 34 edges
10. `NguoiDung` - 34 edges

## Surprising Connections (you probably didn't know these)
- `open()` --calls--> `App()`  [EXTRACTED]
  coldtrack-web/src/auth/flows.test.tsx → coldtrack-web/src/App.tsx
- `open()` --calls--> `App()`  [EXTRACTED]
  coldtrack-web/src/auth/routing.test.tsx → coldtrack-web/src/App.tsx
- `AuthContext` --semantically_similar_to--> `AuthContext`  [INFERRED] [semantically similar]
  docs/B0-LANDING-HANDOFF.md → docs/B1-AUTH-HANDOFF.md
- `AuthService` --semantically_similar_to--> `AuthService`  [INFERRED] [semantically similar]
  docs/B0-LANDING-HANDOFF.md → docs/B1-AUTH-HANDOFF.md
- `customerMockConfig` --semantically_similar_to--> `customerMockConfig`  [INFERRED] [semantically similar]
  docs/B0-LANDING-HANDOFF.md → docs/B3-CUSTOMER-HANDOFF.md

## Import Cycles
- None detected.

## Communities (75 total, 14 thin omitted)

### Community 0 - "driverTypes.ts"
Cohesion: 0.14
Nodes (26): MOCK_USERS, DRIVER_HISTORY_OWNERS, DRIVER_MOCK, DRIVER_RESOURCE_IDS, driverMockConfig(), driverRuntime(), initialDriverSettings(), CanhBao (+18 more)

### Community 1 - "Shared Admin Components"
Cohesion: 0.12
Nodes (85): BackLink(), Chart(), DataGate(), DataTable(), ErrorNotice(), Filters(), KeyValues(), PageHeading() (+77 more)

### Community 2 - "BE-0: Đặc tả thiết kế backend ColdTrack"
Cohesion: 0.06
Nodes (34): 0. Giả định và giá trị khởi đầu, 10. Chờ xác nhận, 11.1 Quy ước dữ liệu và giao dịch, 11.2 Hợp đồng HTTP API tối thiểu, 11.3 Thời gian, gửi bù và phân chuyến, 11.4 Tính liên tục và vòng đời cảnh báo, 11.5.1 Thoát manual_off và ưu tiên firmware (F1/F12), 11.5.2 Tổng ngân sách off mỗi chuyến (F2) (+26 more)

### Community 3 - "Status Badges Content"
Cohesion: 0.09
Nodes (50): Badge(), BadgeProps, BadgeVariant, getVariantFromStatus(), variantStyles, landingContent, LANDING_MOCK_OPTIONS, LANDING_TESTIMONIALS (+42 more)

### Community 4 - "ColdTrack — Plan BE-1 đến BE-3 theo BE-0 v0.4"
Cohesion: 0.06
Nodes (32): 1. Phạm vi và thông số, 2. Kiến trúc và phân quyền, 3. Schema tối thiểu, 4.1 Dải nhiệt, 4.2 Relay tay, 4.3 Telemetry và giờ, 4. MQTT và firmware, 5. API BE-2 và tổng tắt tay (+24 more)

### Community 5 - "ColdTrack — Thiết kế backend MVP để duyệt"
Cohesion: 0.05
Nodes (42): Bước 0.1 — API, Bước 0.2 — Docker Compose TLS, Bước 1.1 — Baseline tài khoản, Bước 1.2 — Xe, thiết bị và phân công, Bước 1.3 — Lô, chuyến, giao nhận và phiên thiết bị, Bước 1.8 — Seed demo và kiểu Kysely, Chuẩn bị môi trường local, Chạy các tiến trình (+34 more)

### Community 6 - "Product Interface Rules"
Cohesion: 0.07
Nodes (8): Badge, ColdTrack Web: Quy tắc nghiệp vụ và từ vựng, Drawer, Header, Modal, Sidebar, StatCard, Table

### Community 7 - "adminService.ts"
Cohesion: 0.12
Nodes (27): createAdminMockData(), CUSTOMER_HISTORY_OWNERS, customerMockConfig(), initialCustomerSettings(), Identity(), setup(), createMockAdminService(), setup() (+19 more)

### Community 8 - "Development Tool Dependencies"
Cohesion: 0.06
Nodes (40): dependencies, lucide-react@^1.65.0, react@^19.3.1, react-dom@^19.3.1, react-router-dom@^7.18.5, tailwindcss@^4.3.3, @tailwindcss/vite@^4.3.3, devDependencies (+32 more)

### Community 9 - "Driver Implementation Handoff"
Cohesion: 0.09
Nodes (8): B4 — Tài xế ColdTrack Web, datChuan, DRIVER_HISTORY_OWNERS, DRIVER_RESOURCE_IDS, DriverProvider, DriverRepository, DriverService, trangThaiNhietDo

### Community 10 - "BE-0: Đặc tả thiết kế backend ColdTrack"
Cohesion: 0.14
Nodes (14): 0. Giả định và giá trị khởi đầu, 10. Chờ xác nhận, 12. Quyết định chờ chủ đồ án, 13. Đối chiếu rà soát, 14. Nghiệm thu bổ sung v0.3, 1. Kiến trúc và ranh giới truy cập, 2. ERD, 3. Bảng và ràng buộc chính (+6 more)

### Community 11 - "adminTypes.ts"
Cohesion: 0.18
Nodes (13): ChuyenLichSu, LoHang, MucDoCanhBao, NhatKyHoatDong, TrangThaiLoHang, TrangThaiXe, Xe, AdminData (+5 more)

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

### Community 20 - "flows.test.tsx"
Cohesion: 0.12
Nodes (7): @testing-library/react@^16.3.3, open(), open(), AuthService, authService, AUTH_MOCK, @testing-library/react

### Community 21 - "AuthPages.tsx"
Cohesion: 0.24
Nodes (12): NotFoundPage(), AuthHeading(), AuthLayout(), AuthLogo(), BackToLogin(), AuthFormPage(), ResetExpiredPage(), ResetSuccessPage() (+4 more)

### Community 22 - "BE-0-backend-spec-review.md"
Cohesion: 0.07
Nodes (28): 0. Giả định và giá trị khởi đầu, 10. Chờ xác nhận, 11.1 Quy ước dữ liệu và giao dịch, 11.2 Hợp đồng HTTP API tối thiểu, 11.3 Thời gian, gửi bù và phân chuyến, 11.4 Tính liên tục và vòng đời cảnh báo, 11.5 Lệnh, outbox và cấu hình hiệu lực, 11.6 Hoàn thành chuyến và bằng chứng giao nhận (+20 more)

### Community 23 - "CustomerContext.tsx"
Cohesion: 0.09
Nodes (9): AdminContextValue, DemoState, Telemetry, Value, CustomerService, DriverContext, Value, DriverData (+1 more)

### Community 24 - "Project Setup Guide"
Cohesion: 0.25
Nodes (6): Oxlint, React, React + TypeScript + Vite, SWC, TypeScript, Vite

### Community 25 - "dependencies"
Cohesion: 0.09
Nodes (23): dependencies, class-transformer@0.5.1, class-validator@0.15.1, helmet@8.3.0, jose@6.2.17, kysely@0.29.8, @nestjs/common@12.4.2, @nestjs/config@^12.1.1 (+15 more)

### Community 26 - "react"
Cohesion: 0.28
Nodes (9): FieldProps, Header(), Sidebar(), AppLayout(), AdminContext, useOptionalAdmin(), CustomerContext, useOptionalCustomer() (+1 more)

### Community 27 - "configure-local.mjs"
Cohesion: 0.09
Nodes (15): device, env, mqtt, brokerConfig, databaseAddress, db, deviceFile, envFile (+7 more)

### Community 28 - "resources.integration.test.ts"
Cohesion: 0.31
Nodes (7): derive, hashMosquittoCredential(), MOSQUITTO_HASH_ITERATIONS, asClient(), env, isolated(), rejected()

### Community 29 - "ColdTrack — Plan BE-1 đến BE-3 theo BE-0 v0.3"
Cohesion: 0.14
Nodes (14): BE-1 — Nền dữ liệu, quyền và môi trường, BE-2 — API nghiệp vụ, transaction và lệnh, BE-3 — Ingest, firmware contract, cảnh báo và demo đầu-cuối, C1. Mosquitto xác thực thế nào?, C2. Đồng bộ trạng thái máy nén, C3. Ingest chạy ở đâu, chi phí và rủi ro?, C4. Realtime: bảng, kênh và kết nối, C5. Công cụ truy vấn và chống lệch schema (+6 more)

### Community 30 - "React Lint Rules"
Cohesion: 0.33
Nodes (5): plugins, rules, react/only-export-components, react/rules-of-hooks, $schema

### Community 31 - "data.ts"
Cohesion: 0.24
Nodes (10): ADMIN_MOCK_OPTIONS, MOCK_CANH_BAO, MOCK_LICH_SU, MOCK_LO_HANG, MOCK_NHAT_KY, MOCK_THONG_KE, MOCK_XE, SAN_PHAM_DONG_LANH (+2 more)

### Community 32 - "Demo Environment Flags"
Cohesion: 0.33
Nodes (6): VITE_DEMO, VITE_DEMO, VITE_DEMO, VITE_DEMO, VITE_DEMO, VITE_DEMO

### Community 33 - "Cold Chain Architecture"
Cohesion: 0.33
Nodes (6): Audit log, coi lại giao thức MQTT : mosquitto mqtt, ETA, GPS, MQTT, Proof of Delivery

### Community 34 - "11. Bổ sung thiết kế để triển khai"
Cohesion: 0.20
Nodes (10): 11.1 Quy ước dữ liệu và giao dịch, 11.2 Hợp đồng HTTP API tối thiểu, 11.3 Thời gian, gửi bù và phân chuyến, 11.4 Tính liên tục và vòng đời cảnh báo, 11.5 Lệnh, outbox và cấu hình hiệu lực, 11.6 Hoàn thành chuyến, độ phủ và bằng chứng giao nhận, 11.7 Đọc dữ liệu, RLS và bí mật, 11.8 Tổng hợp, dung lượng và tác vụ nền (+2 more)

### Community 35 - "5. Hợp đồng MQTT"
Cohesion: 0.29
Nodes (7): 5.1 Topic, 5.2 Payload telemetry, 5.3 Sync ACK, 5.4 Lệnh điều khiển, 5.5 Time-sync, 5.6 Quyền ACL (Mosquitto), 5. Hợp đồng MQTT

### Community 36 - "useAuth"
Cohesion: 0.26
Nodes (10): AuthContext, useAuth(), ForbiddenPage(), GuestRoute(), allowedPaths, postLoginDestination(), ProtectedRoute(), ProtectedRouteProps (+2 more)

### Community 37 - "views-storage-realtime.integration.test.ts"
Cohesion: 0.22
Nodes (8): @supabase/supabase-js@2.119.0, asClient(), driverFields, env, isolated(), summaryFields, viewNames, @supabase/supabase-js

### Community 38 - "pg"
Cohesion: 0.16
Nodes (15): dotenv@18.0.10, asClient(), env, isolated(), rejects(), asClient(), env, isolated() (+7 more)

### Community 39 - "NguoiDung"
Cohesion: 0.21
Nodes (4): AuthContextType, NguoiDung, CustomerRepository, DriverRepository

### Community 40 - "schema.ts"
Cohesion: 0.05
Nodes (40): AccountAccess, AlertEvents, Alerts, AuditLogs, CustomerShipmentsView, CustomerTripsView, DB, DeliveryProofs (+32 more)

### Community 41 - "App"
Cohesion: 0.21
Nodes (14): App(), HomeRedirect(), OverviewAlias(), AuthProvider(), DriversPage(), LogsPage(), Identity(), setup() (+6 more)

### Community 42 - "service.ts"
Cohesion: 0.19
Nodes (12): AuthError, createMockAuthService(), RegisterInput, ResetRequest, setup(), AuthFormKind, AuthFormValues, PASSWORD_HELP (+4 more)

### Community 43 - "seed-demo.ts"
Cohesion: 0.29
Nodes (8): accounts, deviceCodes, envPath, localUrl(), readIfPresent(), rootEnvPath, saveCredential(), seed()

### Community 46 - "Graphify Navigation Rules"
Cohesion: 0.67
Nodes (3): graphify, graphify query, graphify update

### Community 47 - "HTML Document Shell"
Cohesion: 0.67
Nodes (3): <!doctype html>, ColdTrack, Inter

### Community 48 - "coldtrack-be/package.json"
Cohesion: 0.08
Nodes (33): devDependencies, eslint@^10.15.0, @eslint/js@^10.0.1, jest@^30.5.2, kysely-codegen@0.20.0, prettier@3.10.1, supabase@3.1.0, tsx@4.23.15 (+25 more)

### Community 50 - "shipments-trips.integration.test.ts"
Cohesion: 0.47
Nodes (4): asClient(), env, isolated(), rejected()

### Community 51 - "seed-bootstrap.integration.test.ts"
Cohesion: 0.22
Nodes (5): authClient(), credentialPath, demoCodes, env, signIn()

### Community 52 - "customer.test.tsx"
Cohesion: 0.36
Nodes (9): CreateShipmentPage(), change(), fillValid(), Identity(), setup(), CustomerHistoryPage(), CustomerSettingsPage(), CustomerShipmentsPage() (+1 more)

### Community 101 - "scripts"
Cohesion: 0.07
Nodes (28): scripts, build, check:local, db:migration, db:reset, db:seed, db:start, db:start:full (+20 more)

### Community 103 - "compilerOptions"
Cohesion: 0.12
Nodes (16): compilerOptions, emitDecoratorMetadata, esModuleInterop, experimentalDecorators, forceConsistentCasingInFileNames, module, moduleResolution, outDir (+8 more)

### Community 105 - "bootstrap.ts"
Cohesion: 0.18
Nodes (10): ApiErrorFilter, bootstrap(), Environment, loadEnvironment(), optionalValue, port, positiveInt, schema (+2 more)

### Community 106 - "Các bước"
Cohesion: 0.20
Nodes (9): BE-1: Dữ liệu, quyền, môi trường, BE-2: API, giao dịch, publisher, BE-3: Ingest, cảnh báo, simulator, demo, Các bước, Firmware (song song), Giai đoạn 0: Nền tảng, Kế hoạch triển khai backend ColdTrack, Quy tắc thực hiện (+1 more)

### Community 107 - "api"
Cohesion: 0.05
Nodes (54): build, depends_on, environment, healthcheck, init, ports, restart, volumes (+46 more)

### Community 108 - "BE-1-BE-3-implementation-plan.md"
Cohesion: 0.20
Nodes (6): BE-1 — Dữ liệu, quyền và môi trường, BE-2 — API, giao dịch và publisher, BE-3 — Firmware contract, ingest, simulator và demo, Bàn giao và giới hạn lượt này, Ghi chú thay đổi, Quyết định hiện hành

### Community 109 - "app.ts"
Cohesion: 0.15
Nodes (12): AppModule, createApi(), DevicesModule, HealthModule, ShipmentsModule, TripsModule, DATABASE, Database (+4 more)

### Community 110 - "tsconfig.build.json"
Cohesion: 0.50
Nodes (3): exclude, extends, ./tsconfig.json

### Community 112 - "tsconfig.test.json"
Cohesion: 0.25
Nodes (7): compilerOptions, outDir, sourceMap, exclude, extends, include, ./tsconfig.json

### Community 113 - "scripts"
Cohesion: 0.25
Nodes (7): name, private, scripts, build, lint, start, test

### Community 130 - "transport.ts"
Cohesion: 0.24
Nodes (6): validateEnvironment(), startTransport(), mqtt@5.16.1, reflect-metadata@0.2.2, mqtt, reflect-metadata

## Knowledge Gaps
- **60 isolated node(s):** `./tsconfig.json`, `./tsconfig.json`, `Vite logo`, `Vite branding asset`, `CUSTOMER_HISTORY_OWNERS` (+55 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 636 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **14 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `react` connect `Shared Admin Components` to `Status Badges Content`, `useAuth`, `adminService.ts`, `Development Tool Dependencies`, `App`, `customer.test.tsx`, `AuthPages.tsx`, `CustomerContext.tsx`, `react`?**
  _High betweenness centrality (0.113) - this node is a cross-community bridge._
- **What connects `./tsconfig.json`, `./tsconfig.json`, `Vite logo` to the rest of the system?**
  _60 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `driverTypes.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.14285714285714285 - nodes in this community are weakly interconnected._
- **Why does `@playwright/test` connect `Browser Verification Scripts` to `Development Tool Dependencies`?**
  _High betweenness centrality (0.093) - this node is a cross-community bridge._
- **Should `Shared Admin Components` be split into smaller, more focused modules?**
  _Cohesion score 0.11853546910755149 - nodes in this community are weakly interconnected._
- **Why does `react-router-dom` connect `Shared Admin Components` to `Status Badges Content`, `useAuth`, `adminService.ts`, `Development Tool Dependencies`, `App`, `customer.test.tsx`, `AuthPages.tsx`, `react`?**
  _High betweenness centrality (0.049) - this node is a cross-community bridge._
- **Should `BE-0: Đặc tả thiết kế backend ColdTrack` be split into smaller, more focused modules?**
  _Cohesion score 0.058823529411764705 - nodes in this community are weakly interconnected._