# Graph Report - DoAnTotNghiep  (2026-11-23)

## Corpus Check
- 157 files · ~109,459 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 20 file(s) not represented in the graph (top: (none) 8, .css 7, .example 2)

## Summary
- 1372 nodes · 3145 edges · 135 communities (74 shown, 61 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 36 edges (avg confidence: 0.93)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `b8bc3f7f`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- App.tsx
- Shared Admin Components
- BE-0: Đặc tả thiết kế backend ColdTrack
- Status Badges Content
- ColdTrack — Plan BE-1 đến BE-3 theo BE-0 v0.4
- ColdTrack — Thiết kế backend MVP để duyệt
- Product Interface Rules
- driverTypes.ts
- Development Tool Dependencies
- Driver Implementation Handoff
- BE-0: Đặc tả thiết kế backend ColdTrack
- ColdTrack — Plan BE-1 đến BE-3 theo BE-0 v0.3
- Frontend TypeScript Configuration
- Browser Verification Scripts
- Customer Implementation Handoff
- Node TypeScript Configuration
- Authentication Implementation Handoff
- Landing Implementation Handoff
- Admin Implementation Handoff
- Screen Role Mapping
- Application Runtime Dependencies
- configure-local.mjs
- BE-0-backend-spec-review.md
- CustomerContext.tsx
- Project Setup Guide
- Notification Settings Screens
- Completed Trip Details
- Desktop Landing Screens
- Public Tracking Screens
- Responsive Landing Screens
- React Lint Rules
- Package Build Scripts
- Demo Environment Flags
- Cold Chain Architecture
- Customer Trip History
- Customer Shipment Lists
- Customer Shipment Details
- Customer Shipment Creation
- Customer Draft Review
- Driver Incident Reports
- Driver Completion Confirmation
- Driver Alert Acknowledgment
- Driver Account Settings
- Driver Temperature Alerts
- Driver Live Monitoring
- Driver Trip History
- Graphify Navigation Rules
- HTML Document Shell
- coldtrack-be/package.json
- TypeScript Project References
- Desktop Admin Account
- Desktop Notification Preferences
- Desktop Temperature Thresholds
- Desktop Alert Management
- Desktop Critical Alert
- Desktop Completed Trip
- Desktop Vehicle Drawer
- Desktop Shipment Details
- Desktop Shipment Assignment
- Desktop Shipment List
- Desktop Pending Requests
- Desktop Activity Log
- Desktop Operations Overview
- Desktop Fleet Monitoring
- Desktop Vehicle Details
- Mobile Admin Account
- Mobile Notification Preferences
- Mobile Temperature Thresholds
- Mobile Alert Management
- Mobile Critical Alert
- Mobile Completed History
- Mobile Completed Trip
- Mobile Shipment Details
- Mobile Shipment Assignment
- Mobile Shipment List
- Mobile Pending Requests
- Mobile Activity Log
- Mobile Operations Overview
- Mobile Fleet Monitoring
- Mobile Vehicle Details
- Desktop Account Login
- Desktop Customer Registration
- Desktop Missing Token
- Desktop Reset Success
- Desktop Invalid Reset
- Desktop Password Reset
- Mobile Account Login
- Mobile Customer Registration
- Mobile Missing Token
- Mobile Reset Success
- Mobile Invalid Reset
- Mobile Password Reset
- Desktop Customer Account
- Desktop Customer Notifications
- Desktop Customer Trip
- Mobile Customer Account
- Lightning Favicon Asset
- Reusable Icon Sprite
- Layered Hero Illustration
- React Branding Asset
- Vite Branding Asset
- scripts
- dependencies
- compilerOptions
- 11. Bổ sung thiết kế để triển khai
- bootstrap.ts
- Các bước
- api
- BE-1-BE-3-implementation-plan.md
- app.ts
- tsconfig.build.json
- .prettierrc.json
- tsconfig.test.json
- scripts
- 5. Hợp đồng MQTT
- HealthController
- check-local.mjs
- vite.config.ts
- check-ui-fixes.mjs
- DatabaseLifecycle
- adminTypes.ts
- NguoiDung
- auth.ts
- adminService.ts
- useAuth
- AdminService
- DriverContext.tsx
- service.ts
- AuthPages.tsx
- transport.ts
- driver.test.tsx
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
9. `NguoiDung` - 34 edges
10. `Status()` - 34 edges

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

## Communities (135 total, 61 thin omitted)

### Community 0 - "App.tsx"
Cohesion: 0.21
Nodes (19): App(), HomeRedirect(), OverviewAlias(), AuthProvider(), NotFoundPage(), DriversPage(), LogsPage(), CreateShipmentPage() (+11 more)

### Community 1 - "Shared Admin Components"
Cohesion: 0.12
Nodes (87): BackLink(), Chart(), DataGate(), DataTable(), ErrorNotice(), Filters(), KeyValues(), PageHeading() (+79 more)

### Community 2 - "BE-0: Đặc tả thiết kế backend ColdTrack"
Cohesion: 0.06
Nodes (34): 0. Giả định và giá trị khởi đầu, 10. Chờ xác nhận, 11.1 Quy ước dữ liệu và giao dịch, 11.2 Hợp đồng HTTP API tối thiểu, 11.3 Thời gian, gửi bù và phân chuyến, 11.4 Tính liên tục và vòng đời cảnh báo, 11.5.1 Thoát manual_off và ưu tiên firmware (F1/F12), 11.5.2 Tổng ngân sách off mỗi chuyến (F2) (+26 more)

### Community 3 - "Status Badges Content"
Cohesion: 0.09
Nodes (49): Badge(), BadgeProps, BadgeVariant, getVariantFromStatus(), variantStyles, landingContent, LANDING_MOCK_OPTIONS, LANDING_TESTIMONIALS (+41 more)

### Community 4 - "ColdTrack — Plan BE-1 đến BE-3 theo BE-0 v0.4"
Cohesion: 0.06
Nodes (31): 1. Phạm vi và thông số, 2. Kiến trúc và phân quyền, 3. Schema tối thiểu, 4.1 Dải nhiệt, 4.2 Relay tay, 4.3 Telemetry và giờ, 4. MQTT và firmware, 5. API BE-2 và tổng tắt tay (+23 more)

### Community 5 - "ColdTrack — Thiết kế backend MVP để duyệt"
Cohesion: 0.05
Nodes (38): Bước 0.1 — API, Bước 0.2 — Docker Compose TLS, Chuẩn bị môi trường local, Chạy các tiến trình, ColdTrack Backend, Công nghệ, Cấu trúc, Kiểm tra và migration (+30 more)

### Community 6 - "Product Interface Rules"
Cohesion: 0.07
Nodes (8): Badge, ColdTrack Web: Quy tắc nghiệp vụ và từ vựng, Drawer, Header, Modal, Sidebar, StatCard, Table

### Community 7 - "driverTypes.ts"
Cohesion: 0.16
Nodes (24): DRIVER_HISTORY_OWNERS, DRIVER_MOCK, DRIVER_RESOURCE_IDS, driverMockConfig(), driverRuntime(), initialDriverSettings(), LoHang, TemperatureConfig (+16 more)

### Community 8 - "Development Tool Dependencies"
Cohesion: 0.13
Nodes (20): devDependencies, jsdom@^29.1.1, oxlint@^1.89.0, @testing-library/user-event@^14.6.8, @types/node@^24.19.2, @types/react@^19.3.0, @types/react-dom@^19.3.0, typescript@~7.0.2 (+12 more)

### Community 9 - "Driver Implementation Handoff"
Cohesion: 0.09
Nodes (8): B4 — Tài xế ColdTrack Web, datChuan, DRIVER_HISTORY_OWNERS, DRIVER_RESOURCE_IDS, DriverProvider, DriverRepository, DriverService, trangThaiNhietDo

### Community 10 - "BE-0: Đặc tả thiết kế backend ColdTrack"
Cohesion: 0.14
Nodes (14): 0. Giả định và giá trị khởi đầu, 10. Chờ xác nhận, 12. Quyết định chờ chủ đồ án, 13. Đối chiếu rà soát, 14. Nghiệm thu bổ sung v0.3, 1. Kiến trúc và ranh giới truy cập, 2. ERD, 3. Bảng và ràng buộc chính (+6 more)

### Community 11 - "ColdTrack — Plan BE-1 đến BE-3 theo BE-0 v0.3"
Cohesion: 0.14
Nodes (14): BE-1 — Nền dữ liệu, quyền và môi trường, BE-2 — API nghiệp vụ, transaction và lệnh, BE-3 — Ingest, firmware contract, cảnh báo và demo đầu-cuối, C1. Mosquitto xác thực thế nào?, C2. Đồng bộ trạng thái máy nén, C3. Ingest chạy ở đâu, chi phí và rủi ro?, C4. Realtime: bảng, kênh và kết nối, C5. Công cụ truy vấn và chống lệch schema (+6 more)

### Community 12 - "Frontend TypeScript Configuration"
Cohesion: 0.10
Nodes (19): compilerOptions, allowArbitraryExtensions, allowImportingTsExtensions, erasableSyntaxOnly, jsx, lib, module, moduleDetection (+11 more)

### Community 13 - "Browser Verification Scripts"
Cohesion: 0.16
Nodes (6): @playwright/test@^1.64.1, problems, problems, problems, problems, @playwright/test

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

### Community 20 - "Application Runtime Dependencies"
Cohesion: 0.20
Nodes (10): dependencies, lucide-react@^1.65.0, react@^19.3.1, react-dom@^19.3.1, react-router-dom@^7.18.5, tailwindcss@^4.3.3, @tailwindcss/vite@^4.3.3, react-dom (+2 more)

### Community 21 - "configure-local.mjs"
Cohesion: 0.18
Nodes (8): brokerConfig, databaseAddress, db, deviceFile, envFile, passwordPath, root, status

### Community 22 - "BE-0-backend-spec-review.md"
Cohesion: 0.07
Nodes (28): 0. Giả định và giá trị khởi đầu, 10. Chờ xác nhận, 11.1 Quy ước dữ liệu và giao dịch, 11.2 Hợp đồng HTTP API tối thiểu, 11.3 Thời gian, gửi bù và phân chuyến, 11.4 Tính liên tục và vòng đời cảnh báo, 11.5 Lệnh, outbox và cấu hình hiệu lực, 11.6 Hoàn thành chuyến và bằng chứng giao nhận (+20 more)

### Community 23 - "CustomerContext.tsx"
Cohesion: 0.10
Nodes (6): AdminContextValue, DemoState, Value, CustomerService, Value, DriverService

### Community 24 - "Project Setup Guide"
Cohesion: 0.25
Nodes (6): Oxlint, React, React + TypeScript + Vite, SWC, TypeScript, Vite

### Community 25 - "Notification Settings Screens"
Cohesion: 0.33
Nodes (6): Email SMS and temperature alerts, Mobile customer notification settings, Email SMS and temperature alerts, Driver notification settings, Email SMS and temperature alerts, Mobile driver notification settings

### Community 26 - "Completed Trip Details"
Cohesion: 0.33
Nodes (6): Compliant trip CT-2026-0301, Mobile customer completed trip drawer, Compliant trip CT-2026-0301, Driver completed trip drawer, Compliant trip CT-2026-0301, Mobile driver completed trip drawer

### Community 27 - "Desktop Landing Screens"
Cohesion: 0.33
Nodes (6): Cold chain monitoring service, ColdTrack landing page 1024, Cold chain monitoring service, ColdTrack landing page 1280, Cold chain monitoring service, ColdTrack landing page 1440

### Community 28 - "Public Tracking Screens"
Cohesion: 0.33
Nodes (6): ColdTrack desktop hero viewport, Shipment CT-2026-0901 demonstration, ColdTrack mobile hero viewport, Shipment CT-2026-0901 demonstration, Public shipment tracking result, Shipment CT-2026-0901 demonstration

### Community 29 - "Responsive Landing Screens"
Cohesion: 0.33
Nodes (6): ColdTrack landing page 320, Responsive cold chain landing page, ColdTrack landing page 390, Responsive cold chain landing page, ColdTrack landing page 768, Responsive cold chain landing page

### Community 30 - "React Lint Rules"
Cohesion: 0.33
Nodes (5): plugins, rules, react/only-export-components, react/rules-of-hooks, $schema

### Community 31 - "Package Build Scripts"
Cohesion: 0.33
Nodes (6): scripts, build, dev, lint, preview, test

### Community 32 - "Demo Environment Flags"
Cohesion: 0.33
Nodes (6): VITE_DEMO, VITE_DEMO, VITE_DEMO, VITE_DEMO, VITE_DEMO, VITE_DEMO

### Community 33 - "Cold Chain Architecture"
Cohesion: 0.33
Nodes (6): Audit log, coi lại giao thức MQTT : mosquitto mqtt, ETA, GPS, MQTT, Proof of Delivery

### Community 34 - "Customer Trip History"
Cohesion: 0.50
Nodes (4): Completed trips and temperature compliance, Customer shipment history, Completed trips and temperature compliance, Mobile customer shipment history

### Community 35 - "Customer Shipment Lists"
Cohesion: 0.50
Nodes (4): Customer shipments table, Shipment lifecycle filtering, Mobile customer shipment table, Shipment lifecycle filtering

### Community 36 - "Customer Shipment Details"
Cohesion: 0.50
Nodes (4): Critical shipment CT-2026-0156, Customer shipment status drawer, Critical shipment CT-2026-0156, Mobile customer shipment status drawer

### Community 37 - "Customer Shipment Creation"
Cohesion: 0.50
Nodes (4): Cold chain shipment requirements, Customer shipment creation, Cold chain shipment requirements, Mobile customer shipment creation

### Community 38 - "Customer Draft Review"
Cohesion: 0.50
Nodes (4): Dispatch approval request, Customer draft review drawer, Dispatch approval request, Mobile customer draft review

### Community 39 - "Driver Incident Reports"
Cohesion: 0.50
Nodes (4): Driver incident reporting modal, Incident report with location, Mobile driver incident report, Incident report with location

### Community 40 - "Driver Completion Confirmation"
Cohesion: 0.50
Nodes (4): Driver completion confirmation modal, Noncompliant delivery requires reason, Mobile driver completion modal, Noncompliant delivery requires reason

### Community 41 - "Driver Alert Acknowledgment"
Cohesion: 0.50
Nodes (4): Critical temperature alert acknowledgment, Driver alert acknowledgment modal, Critical temperature alert acknowledgment, Mobile driver alert acknowledgment

### Community 42 - "Driver Account Settings"
Cohesion: 0.50
Nodes (4): Driver profile editing, Driver account settings, Driver profile editing, Mobile driver account settings

### Community 43 - "Driver Temperature Alerts"
Cohesion: 0.50
Nodes (4): Critical temperature threshold breach, Driver trip alerts table, Critical temperature threshold breach, Mobile driver trip alerts

### Community 44 - "Driver Live Monitoring"
Cohesion: 0.50
Nodes (4): Driver current trip dashboard, Live cold chain monitoring, Mobile driver current trip, Live cold chain monitoring

### Community 45 - "Driver Trip History"
Cohesion: 0.50
Nodes (4): Driver assigned completed trips, Driver trip history, Driver assigned completed trips, Mobile driver trip history

### Community 46 - "Graphify Navigation Rules"
Cohesion: 0.67
Nodes (3): graphify, graphify query, graphify update

### Community 47 - "HTML Document Shell"
Cohesion: 0.67
Nodes (3): <!doctype html>, ColdTrack, Inter

### Community 48 - "coldtrack-be/package.json"
Cohesion: 0.09
Nodes (31): devDependencies, eslint@^10.15.0, @eslint/js@^10.0.1, jest@^30.5.2, prettier@3.10.1, supabase@3.1.0, tsx@4.23.15, @types/express@5.0.6 (+23 more)

### Community 101 - "scripts"
Cohesion: 0.08
Nodes (25): scripts, build, check:local, db:migration, db:reset, db:start, db:start:full, db:status (+17 more)

### Community 102 - "dependencies"
Cohesion: 0.09
Nodes (23): dependencies, class-transformer@0.5.1, class-validator@0.15.1, helmet@8.3.0, jose@6.2.17, kysely@0.29.8, @nestjs/common@12.4.2, @nestjs/core@12.4.2 (+15 more)

### Community 103 - "compilerOptions"
Cohesion: 0.12
Nodes (16): compilerOptions, emitDecoratorMetadata, esModuleInterop, experimentalDecorators, forceConsistentCasingInFileNames, module, moduleResolution, outDir (+8 more)

### Community 104 - "11. Bổ sung thiết kế để triển khai"
Cohesion: 0.20
Nodes (10): 11.1 Quy ước dữ liệu và giao dịch, 11.2 Hợp đồng HTTP API tối thiểu, 11.3 Thời gian, gửi bù và phân chuyến, 11.4 Tính liên tục và vòng đời cảnh báo, 11.5 Lệnh, outbox và cấu hình hiệu lực, 11.6 Hoàn thành chuyến, độ phủ và bằng chứng giao nhận, 11.7 Đọc dữ liệu, RLS và bí mật, 11.8 Tổng hợp, dung lượng và tác vụ nền (+2 more)

### Community 105 - "bootstrap.ts"
Cohesion: 0.19
Nodes (10): ApiErrorFilter, bootstrap(), Environment, loadEnvironment(), optionalValue, port, positiveInt, schema (+2 more)

### Community 106 - "Các bước"
Cohesion: 0.20
Nodes (9): BE-1: Dữ liệu, quyền, môi trường, BE-2: API, giao dịch, publisher, BE-3: Ingest, cảnh báo, simulator, demo, Các bước, Firmware (song song), Giai đoạn 0: Nền tảng, Kế hoạch triển khai backend ColdTrack, Quy tắc thực hiện (+1 more)

### Community 107 - "api"
Cohesion: 0.05
Nodes (54): build, depends_on, environment, healthcheck, init, ports, restart, volumes (+46 more)

### Community 108 - "BE-1-BE-3-implementation-plan.md"
Cohesion: 0.22
Nodes (5): BE-1 — Dữ liệu, quyền và môi trường, BE-2 — API, giao dịch và publisher, BE-3 — Firmware contract, ingest, simulator và demo, Bàn giao và giới hạn lượt này, Quyết định hiện hành

### Community 109 - "app.ts"
Cohesion: 0.14
Nodes (13): AppModule, createApi(), DevicesModule, HealthModule, ShipmentsModule, TripsModule, DATABASE, Database (+5 more)

### Community 110 - "tsconfig.build.json"
Cohesion: 0.50
Nodes (3): exclude, extends, ./tsconfig.json

### Community 112 - "tsconfig.test.json"
Cohesion: 0.25
Nodes (7): compilerOptions, outDir, sourceMap, exclude, extends, include, ./tsconfig.json

### Community 113 - "scripts"
Cohesion: 0.25
Nodes (7): name, private, scripts, build, lint, start, test

### Community 114 - "5. Hợp đồng MQTT"
Cohesion: 0.29
Nodes (7): 5.1 Topic, 5.2 Payload telemetry, 5.3 Sync ACK, 5.4 Lệnh điều khiển, 5.5 Time-sync, 5.6 Quyền ACL (Mosquitto), 5. Hợp đồng MQTT

### Community 116 - "check-local.mjs"
Cohesion: 0.25
Nodes (5): dotenv@18.0.10, device, env, mqtt, dotenv

### Community 117 - "vite.config.ts"
Cohesion: 0.22
Nodes (5): vite@^8.3.5, @vitejs/plugin-react@^6.1.2, checkoutKey, vite, @vitejs/plugin-react

### Community 120 - "adminTypes.ts"
Cohesion: 0.14
Nodes (18): ADMIN_MOCK_OPTIONS, MOCK_CANH_BAO, MOCK_LICH_SU, MOCK_LO_HANG, MOCK_NHAT_KY, MOCK_XE, SAN_PHAM_DONG_LANH, THOI_GIAN_HIEN_THI (+10 more)

### Community 121 - "NguoiDung"
Cohesion: 0.20
Nodes (4): NguoiDung, Settings, CustomerRepository, DriverRepository

### Community 123 - "auth.ts"
Cohesion: 0.12
Nodes (8): @testing-library/react@^16.3.3, open(), open(), AuthService, authService, AUTH_MOCK, MOCK_THONG_KE, @testing-library/react

### Community 124 - "adminService.ts"
Cohesion: 0.12
Nodes (28): createAdminMockData(), CUSTOMER_HISTORY_OWNERS, customerMockConfig(), initialCustomerSettings(), MOCK_USERS, adminService, createMockAdminService(), setup() (+20 more)

### Community 125 - "useAuth"
Cohesion: 0.21
Nodes (13): AuthContext, AuthContextType, useAuth(), ForbiddenPage(), GuestRoute(), allowedPaths, postLoginDestination(), ProtectedRoute() (+5 more)

### Community 127 - "DriverContext.tsx"
Cohesion: 0.25
Nodes (10): FieldProps, Header(), Sidebar(), AppLayout(), AdminContext, useOptionalAdmin(), CustomerContext, useOptionalCustomer() (+2 more)

### Community 128 - "service.ts"
Cohesion: 0.19
Nodes (12): AuthError, createMockAuthService(), RegisterInput, ResetRequest, setup(), AuthFormKind, AuthFormValues, PASSWORD_HELP (+4 more)

### Community 129 - "AuthPages.tsx"
Cohesion: 0.24
Nodes (11): AuthHeading(), AuthLayout(), AuthLogo(), BackToLogin(), AuthFormPage(), ResetExpiredPage(), ResetSuccessPage(), ForgotPasswordPage() (+3 more)

### Community 130 - "transport.ts"
Cohesion: 0.20
Nodes (8): validateEnvironment(), startTransport(), mqtt@5.16.1, pg@8.23.1, reflect-metadata@0.2.2, mqtt, pg, reflect-metadata

### Community 131 - "driver.test.tsx"
Cohesion: 0.47
Nodes (8): Identity(), setup(), DriverAlertsPage(), DriverCurrentPage(), DriverGate(), DriverHistoryPage(), DriverSettingsPage(), DriverProvider()

## Knowledge Gaps
- **191 isolated node(s):** `./tsconfig.json`, `./tsconfig.json`, `Vite logo`, `Vite branding asset`, `CUSTOMER_HISTORY_OWNERS` (+186 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 694 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **61 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `react` connect `Shared Admin Components` to `App.tsx`, `AuthPages.tsx`, `Status Badges Content`, `driver.test.tsx`, `Development Tool Dependencies`, `Application Runtime Dependencies`, `useAuth`, `DriverContext.tsx`?**
  _High betweenness centrality (0.067) - this node is a cross-community bridge._
- **What connects `./tsconfig.json`, `./tsconfig.json`, `Vite logo` to the rest of the system?**
  _191 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Shared Admin Components` be split into smaller, more focused modules?**
  _Cohesion score 0.11582670203359859 - nodes in this community are weakly interconnected._
- **Why does `@playwright/test` connect `Browser Verification Scripts` to `Development Tool Dependencies`, `check-ui-fixes.mjs`?**
  _High betweenness centrality (0.046) - this node is a cross-community bridge._
- **Should `BE-0: Đặc tả thiết kế backend ColdTrack` be split into smaller, more focused modules?**
  _Cohesion score 0.058823529411764705 - nodes in this community are weakly interconnected._
- **Why does `react-router-dom` connect `Shared Admin Components` to `App.tsx`, `AuthPages.tsx`, `driver.test.tsx`, `Status Badges Content`, `Development Tool Dependencies`, `Application Runtime Dependencies`, `useAuth`, `DriverContext.tsx`?**
  _High betweenness centrality (0.030) - this node is a cross-community bridge._
- **Should `Status Badges Content` be split into smaller, more focused modules?**
  _Cohesion score 0.08852459016393442 - nodes in this community are weakly interconnected._