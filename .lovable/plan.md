

## Floating Hotel Management System — Phase 1: Foundation

### Overview
Build the authentication, role system, multi-tenant boat management, and room/QR code infrastructure. This is the backbone of the entire SaaS.

### Design: Luxury Dark Theme
- Deep dark backgrounds (#0f0d15, #1a1625)
- Gold/amber accents (#d4a853, #c9952b)
- Elegant serif headings, clean sans-serif body text
- Subtle gradients, card-based layouts with soft borders
- Professional hospitality aesthetic

---

### 1. Authentication & Role System
- **Sign up / Login** pages with Supabase Auth (email/password)
- **First registered user becomes Owner** (auto-assigned on first signup)
- **Roles table** with enum: `owner`, `boat_admin`, `receptionist`
- **User management page** (Owner only): invite users, assign roles, assign to boats
- Role-based route protection throughout the app

### 2. Database Schema (Supabase)
Core tables for Phase 1:
- `users` → linked to auth.users
- `profiles` → display name, avatar, language preference
- `user_roles` → role assignments (owner/boat_admin/receptionist)
- `boats` → name, description, owner_id, max_rooms (default 100)
- `rooms` → boat_id, room_number, status, qr_code_data
- `user_boat_assignments` → which users can access which boats
- Row-Level Security on all tables scoped by boat assignment

### 3. Owner Dashboard
- **Boats list**: Create, edit, delete boats
- **User management**: Add users, assign roles, assign to boats
- **Overview stats**: Total boats, rooms, active users

### 4. Boat Admin Dashboard
- **Rooms management**: View all rooms for their assigned boat
- **Room grid view**: Visual 10×10 grid showing room status
- **Add/edit room details**

### 5. QR Code Generation System
- Generate unique QR code per room (encodes boat + room ID)
- **QR Print Page**: A4-optimized layout with adjustable QR size
- Caption under each QR: "Scan to request services" (multilingual-ready)
- Bulk print: generate all QR codes for a boat at once
- Uses `react-qr-code` library

### 6. Navigation & Layout
- **Sidebar navigation** with role-based menu items
- Owner sees: All Boats, Users, Settings
- Boat Admin sees: Rooms, QR Codes, (future: Requests, Reports)
- Receptionist sees: (future: Invoices, Room Status)
- Responsive: collapsible sidebar on mobile

---

### What comes in future phases:
- **Phase 2**: Guest QR Web App + Translation Engine (DeepSeek primary)
- **Phase 3**: Staff Requests Dashboard (real-time)
- **Phase 4**: Billing/Invoice System
- **Phase 5**: Feedback, AI Reports, Analytics

