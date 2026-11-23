# ColdTrack

## Cấu trúc dự án

```text
DoAnTotNghiep/
├── coldtrack-web/     # Frontend web: React + TypeScript + Vite
├── coldtrack-be/      # Backend: khung API, ingest, worker và Supabase local
├── docs/              # Tài liệu thiết kế và bàn giao dùng chung
├── graphify-out/      # Knowledge graph của dự án
└── AGENTS.md          # Hướng dẫn làm việc với codebase
```

Frontend và backend có thư mục riêng. Mỗi phần quản lý dependency, cấu hình môi trường và lệnh chạy trong thư mục của mình.

## Chạy frontend web

```powershell
cd D:\DoAnTotNghiep\coldtrack-web
npm.cmd run dev
```

Kiểm tra build: `npm.cmd run build` trong `coldtrack-web/`.

## Backend

Thư mục [coldtrack-be](coldtrack-be/README.md) dành riêng cho backend, đã cài dependency và có hướng dẫn chạy API, ingest, worker, Supabase và MQTT local. Nghiệp vụ được triển khai ở bước tiếp theo.

Thiết kế để duyệt: [BE-SYSTEM-DESIGN.md](docs/BE-SYSTEM-DESIGN.md), gồm ERD, phân quyền, MQTT, SD, simulator và các giai đoạn triển khai.
