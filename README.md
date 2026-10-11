# Nexus Project

Nền tảng quản lý dự án chuyên nghiệp cho doanh nghiệp, đội nhóm và cá nhân — quản lý dự án, công việc, nhân sự, tiến độ, tài liệu và hiệu suất trên một hệ thống thống nhất.

**Tech stack:** React 18 · TypeScript · Vite · Tailwind CSS · React Router · Recharts · dnd-kit · React Hook Form + Zod · Supabase (PostgreSQL + Auth + Storage)

## Tính năng

- **Tổng quan (Dashboard):** lời chào, KPI, biểu đồ tiến độ 14 ngày, phân bổ trạng thái, dự án gần đây, nhiệm vụ sắp đến hạn, hoạt động nhóm, workload thành viên.
- **Dự án:** CRUD, lưu trữ/xóa (có xác nhận), Grid/List view, lọc theo trạng thái/ưu tiên/quản lý, tìm kiếm, sắp xếp, phân trang, theo dõi ngân sách, tiến độ tự động.
- **Nhiệm vụ:** Kanban kéo thả (dnd-kit), Table view (sắp xếp, lọc, chọn nhiều + thao tác hàng loạt), Công việc của tôi (nhóm Quá hạn/Hôm nay/Sắp đến hạn/Hoàn thành), Task Detail Drawer (mô tả, checklist, phụ thuộc, bình luận, đính kèm, lịch sử).
- **Lịch:** xem Tháng/Tuần/Ngày, lọc theo dự án/trạng thái, tạo nhanh nhiệm vụ từ ô ngày.
- **Timeline (Gantt):** scale Ngày/Tuần/Tháng, thanh tiến độ, tô nổi bật quá hạn, đường phụ thuộc.
- **Nhóm & Nhân sự:** danh sách, workload, mời thành viên, phân quyền (Owner/Admin/Manager/Member/Viewer).
- **Thông báo:** theo sự kiện (giao việc, sắp đến hạn, quá hạn, nhắc tên...), đánh dấu đã đọc.
- **Báo cáo:** KPI + biểu đồ từ dữ liệu thật, lọc theo thời gian/dự án/thành viên, xuất CSV.
- **Tài liệu:** CRUD, liên kết dự án.
- **Tìm kiếm toàn cục:** `Ctrl/Cmd + K` tìm dự án/nhiệm vụ/thành viên/tài liệu.
- **Tạo nhanh:** nút "Tạo mới" cho dự án/nhiệm vụ/thành viên/tài liệu.
- **Giao diện:** Light/Dark mode, sidebar thu gọn, responsive, tiếng Việt.

## Chạy ứng dụng

Yêu cầu: Node.js 18+.

```bash
npm install
npm run dev      # chạy dev tại http://localhost:5173
npm run build    # build production
npm run preview  # xem bản build
```

### Chế độ demo (mặc định)

Khi chưa cấu hình Supabase, app tự chạy **chế độ demo** với dữ liệu mẫu đầy đủ (5 dự án, 26 nhiệm vụ, 8 thành viên, bình luận, thông báo...) lưu trên `localStorage` của trình duyệt. Mọi CRUD đều hoạt động và giao diện cập nhật ngay.

- Đăng nhập: bấm **"Dùng tài khoản demo"**, hoặc dùng email `minhanh@nexus.vn` + mật khẩu bất kỳ (≥ 4 ký tự).
- Khôi phục dữ liệu mẫu: **Cài đặt → Dữ liệu → Khôi phục dữ liệu demo**.

## Kết nối Supabase (backend thật)

1. Tạo project tại [supabase.com](https://supabase.com), lấy **Project URL** và **anon key** (Project Settings → API).
2. Chạy migration: `supabase db push` (thư mục `supabase/migrations/`), hoặc dán 2 file SQL vào SQL Editor theo thứ tự:
   - `20261011000000_init.sql` (schema)
   - `20261011000001_rls.sql` (Row Level Security + Storage bucket)
3. Tạo file `.env` từ `.env.example` và điền:
   ```
   VITE_SUPABASE_URL=https://xxx.supabase.co
   VITE_SUPABASE_ANON_KEY=eyJ...
   ```
4. Bật **Email Auth** trong Authentication → Providers. Sau khi user đăng ký, tạo dòng tương ứng trong `profiles` (dùng Database Webhook hoặc tạo thủ công).
5. Chạy lại `npm run dev` — app sẽ dùng Supabase thay vì demo (kiểm tra `src/lib/supabase.ts`).

> Lưu ý: lớp truy cập dữ liệu Supabase (hooks thay cho store demo) là bước tiếp theo trong roadmap — schema, RLS và client đã sẵn sàng.

## Cấu trúc project

```
src/
  components/ui/        # Button, Card, Badge, Dialog, Dropdown, Avatar...
  components/layout/    # Sidebar, Header, AppShell, SearchOverlay, QuickCreate
  features/             # dashboard, projects, tasks, calendar, timeline,
                        # team, documents, reports, notifications, settings, auth
  store/AppContext.tsx  # state toàn cục (reducer + localStorage)
  data/seed.ts          # dữ liệu demo
  lib/                  # utils, format ngày giờ (vi), supabase client
  types.ts              # data model
supabase/migrations/    # schema + RLS policies
```

## Phân quyền (khi dùng Supabase)

RLS đã cấu hình theo workspace/dự án/vai trò: Viewer chỉ đọc; Member tạo/sửa nhiệm vụ; Manager trở lên quản lý dự án; Admin/Owner quản trị workspace. Xem chi tiết trong `20261011000001_rls.sql`.

## Roadmap

- [x] UI + luồng demo đầy đủ (CRUD, Kanban, Gantt, báo cáo, xuất CSV)
- [x] Schema Supabase + RLS + Storage
- [ ] Lớp data hooks Supabase thay store demo (khi cấu hình backend)
- [ ] Supabase Auth thật + bảo vệ route theo vai trò
- [ ] Realtime notifications/subscriptions
- [ ] Xuất PDF báo cáo
