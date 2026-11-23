# Graph Report - DoAnTotNghiep  (2026-11-10)

## Corpus Check
- 116 files · ~55,173 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 8 file(s) not represented in the graph (top: .css 7, (none) 1)

## Summary
- 903 nodes · 2565 edges · 103 communities (46 shown, 57 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 35 edges (avg confidence: 0.94)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- Application Routing Authentication
- Shared Admin Components
- CreateShipmentPage.tsx
- Status Badges Content
- Mock Service Factories
- Shared Mock Datasets
- Product Interface Rules
- Driver Mock State
- Development Tool Dependencies
- Driver Implementation Handoff
- Authentication Service Contracts
- AdminService
- Frontend TypeScript Configuration
- Browser Verification Scripts
- Customer Implementation Handoff
- Node TypeScript Configuration
- Authentication Implementation Handoff
- Landing Implementation Handoff
- Admin Implementation Handoff
- Screen Role Mapping
- Application Runtime Dependencies
- Vite Build Configuration
- DemoState
- Driver Service Contracts
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
- Shared Form Fields
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
- AuthService
- check-ui-fixes.mjs

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
- `AuthContext` --semantically_similar_to--> `AuthContext`  [INFERRED] [semantically similar]
  docs/B0-LANDING-HANDOFF.md → docs/B1-AUTH-HANDOFF.md
- `AuthService` --semantically_similar_to--> `AuthService`  [INFERRED] [semantically similar]
  docs/B0-LANDING-HANDOFF.md → docs/B1-AUTH-HANDOFF.md
- `customerMockConfig` --semantically_similar_to--> `customerMockConfig`  [INFERRED] [semantically similar]
  docs/B0-LANDING-HANDOFF.md → docs/B3-CUSTOMER-HANDOFF.md
- `Email SMS and temperature alerts` --semantically_similar_to--> `Email SMS and temperature alerts`  [INFERRED] [semantically similar]
  coldtrack-web/artifacts/driver/1440-tx-cai-dat-tab-notifications.png → coldtrack-web/artifacts/customer/390-kh-cai-dat-tab-notifications.png
- `Email SMS and temperature alerts` --semantically_similar_to--> `Email SMS and temperature alerts`  [INFERRED] [semantically similar]
  coldtrack-web/artifacts/driver/390-tx-cai-dat-tab-notifications.png → coldtrack-web/artifacts/customer/390-kh-cai-dat-tab-notifications.png

## Import Cycles
- None detected.

## Communities (103 total, 57 thin omitted)

### Community 0 - "Application Routing Authentication"
Cohesion: 0.06
Nodes (76): App(), HomeRedirect(), OverviewAlias(), AuthContext, AuthContextType, AuthProvider(), useAuth(), open() (+68 more)

### Community 1 - "Shared Admin Components"
Cohesion: 0.11
Nodes (83): AuthFormKind, AuthFormValues, PASSWORD_HELP, validateEmail(), Chart(), DataGate(), DataTable(), ErrorNotice() (+75 more)

### Community 2 - "CreateShipmentPage.tsx"
Cohesion: 0.23
Nodes (13): CreateForm(), CreateShipmentPage(), CustomerGate(), useCustomer(), input(), CustomerData, emptyShipmentForm(), ShipmentForm (+5 more)

### Community 3 - "Status Badges Content"
Cohesion: 0.09
Nodes (49): Badge(), BadgeProps, BadgeVariant, getVariantFromStatus(), variantStyles, landingContent, LANDING_MOCK_OPTIONS, LANDING_TESTIMONIALS (+41 more)

### Community 4 - "Mock Service Factories"
Cohesion: 0.18
Nodes (16): createAdminMockData(), CUSTOMER_HISTORY_OWNERS, customerMockConfig(), initialCustomerSettings(), createMockAdminService(), setup(), AdminError, vehicleIssue() (+8 more)

### Community 5 - "Shared Mock Datasets"
Cohesion: 0.12
Nodes (26): ADMIN_MOCK_OPTIONS, MOCK_CANH_BAO, MOCK_LICH_SU, MOCK_LO_HANG, MOCK_NHAT_KY, MOCK_XE, SAN_PHAM_DONG_LANH, THOI_GIAN_HIEN_THI (+18 more)

### Community 6 - "Product Interface Rules"
Cohesion: 0.07
Nodes (8): Badge, ColdTrack Web: Quy tắc nghiệp vụ và từ vựng, Drawer, Header, Modal, Sidebar, StatCard, Table

### Community 7 - "Driver Mock State"
Cohesion: 0.15
Nodes (23): DRIVER_HISTORY_OWNERS, DRIVER_MOCK, DRIVER_RESOURCE_IDS, driverMockConfig(), driverRuntime(), initialDriverSettings(), adminService, TemperatureConfig (+15 more)

### Community 8 - "Development Tool Dependencies"
Cohesion: 0.12
Nodes (21): devDependencies, jsdom@^29.1.1, oxlint@^1.89.0, @testing-library/react@^16.3.3, @testing-library/user-event@^14.6.8, @types/node@^24.19.2, @types/react@^19.3.0, @types/react-dom@^19.3.0 (+13 more)

### Community 9 - "Driver Implementation Handoff"
Cohesion: 0.09
Nodes (8): B4 — Tài xế ColdTrack Web, datChuan, DRIVER_HISTORY_OWNERS, DRIVER_RESOURCE_IDS, DriverProvider, DriverRepository, DriverService, trangThaiNhietDo

### Community 10 - "Authentication Service Contracts"
Cohesion: 0.22
Nodes (3): NguoiDung, CustomerRepository, DriverRepository

### Community 12 - "Frontend TypeScript Configuration"
Cohesion: 0.10
Nodes (19): compilerOptions, allowArbitraryExtensions, allowImportingTsExtensions, erasableSyntaxOnly, jsx, lib, module, moduleDetection (+11 more)

### Community 13 - "Browser Verification Scripts"
Cohesion: 0.13
Nodes (7): @playwright/test@^1.64.1, problems, problems, problems, problems, problems, @playwright/test

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

### Community 21 - "Vite Build Configuration"
Cohesion: 0.22
Nodes (5): vite@^8.3.5, @vitejs/plugin-react@^6.1.2, checkoutKey, vite, @vitejs/plugin-react

### Community 22 - "DemoState"
Cohesion: 0.20
Nodes (3): DemoState, Value, CustomerService

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

## Knowledge Gaps
- **189 isolated node(s):** `Vite logo`, `Vite branding asset`, `CUSTOMER_HISTORY_OWNERS`, `CustomerProvider`, `CustomerService` (+184 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 403 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **57 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `react` connect `Application Routing Authentication` to `Shared Admin Components`, `CreateShipmentPage.tsx`, `Status Badges Content`, `Development Tool Dependencies`, `Shared Form Fields`, `Application Runtime Dependencies`?**
  _High betweenness centrality (0.051) - this node is a cross-community bridge._
- **What connects `Vite logo`, `Vite branding asset`, `CUSTOMER_HISTORY_OWNERS` to the rest of the system?**
  _189 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Application Routing Authentication` be split into smaller, more focused modules?**
  _Cohesion score 0.060719640179910044 - nodes in this community are weakly interconnected._
- **Why does `@playwright/test` connect `Browser Verification Scripts` to `Development Tool Dependencies`, `check-ui-fixes.mjs`?**
  _High betweenness centrality (0.028) - this node is a cross-community bridge._
- **Should `Shared Admin Components` be split into smaller, more focused modules?**
  _Cohesion score 0.11154791154791155 - nodes in this community are weakly interconnected._
- **Why does `react-router-dom` connect `Application Routing Authentication` to `Shared Admin Components`, `CreateShipmentPage.tsx`, `Status Badges Content`, `Development Tool Dependencies`, `Application Runtime Dependencies`?**
  _High betweenness centrality (0.023) - this node is a cross-community bridge._
- **Should `Status Badges Content` be split into smaller, more focused modules?**
  _Cohesion score 0.09096045197740113 - nodes in this community are weakly interconnected._