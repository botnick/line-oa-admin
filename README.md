<div align="center">

# 💬 LINE OA Admin

**ระบบจัดการ LINE OA แบบ Self-hosted — เร็ว ลื่น ทำใช้เอง**

Next.js 16 · React 19 · tRPC 11 · Prisma 7 · PostgreSQL 16 · Redis 7

MIT License

</div>

---

## ทำไมถึงมีโปรเจกต์นี้?

แฟนทำ [💐สังกัด Flower แอป Mico Live✨](https://www.instagram.com/flower.union/) ต้องใช้ LINE OA คุยกับ VJ คนใหม่ ๆ ทุกวัน แชทเยอะมาก

ปัญหาคือ **ข้อความย้อนหลังหาย** — LINE OA แพ็กเกจฟรีเก็บแชทได้ไม่นาน จะอ่านข้อความเก่าก็ไม่ได้แล้ว แถมแอป LINE OA Manager ก็ช้า หน่วง เปิดทีรอนาน

ก็เลยทำระบบตอบแชทใหม่ขึ้นมาเอง เก็บแชทถาวร ย้อนดูได้ตลอด ใช้ได้ทั้งคอมและมือถือ ทำเสร็จก็ปล่อยเป็น Open Source ให้ใช้ฟรี

---

## หน้าตาคร่าว ๆ

### Desktop

| Inbox (ตอบแชท) | Contacts (รายชื่อ) |
| :---: | :---: |
| ![Inbox](docs/screenshots/desktop-02-inbox-chat.png) | ![Contacts](docs/screenshots/desktop-03-contacts.png) |

| Settings (ตั้งค่า) | Quick Replies (ข้อความด่วน) |
| :---: | :---: |
| ![Settings](docs/screenshots/desktop-04-settings.png) | ![Quick Replies](docs/screenshots/desktop-05-quick-replies.png) |

### Mobile (PWA — เซฟเป็นแอปมือถือได้)

| Login | Inbox | Contacts | Settings |
| :---: | :---: | :---: | :---: |
| <img src="docs/screenshots/mobile-01-login.png" width="180"> | <img src="docs/screenshots/mobile-02-inbox-chat.png" width="180"> | <img src="docs/screenshots/mobile-03-contacts.png" width="180"> | <img src="docs/screenshots/mobile-04-settings.png" width="180"> |

---

## ฟีเจอร์ที่มี

| ฟีเจอร์ | รายละเอียด |
|---------|-----------|
| **Inbox** | ตอบแชท Realtime ผ่าน SSE ส่งข้อความ รูป สติกเกอร์ ไฟล์ได้ |
| **Search** | ค้นหาข้อความ + รายชื่อ กดจากผลค้นหากระโดดไปข้อความนั้นได้เลย ใช้ PostgreSQL Full-Text Search |
| **Contacts** | รายชื่อลูกค้า ติด Tag กรอง Follow/Unfollow |
| **Overview** | สรุปสถิติ 7 วัน + Activity Feed (infinite scroll) |
| **Quick Replies** | ข้อความตอบด่วน กดจิ้มส่ง ไม่ต้องพิมพ์ซ้ำ |
| **Tags** | สร้าง tag สีต่าง ๆ ติดลูกค้าเพื่อจัดกลุ่ม |
| **Labels** | ติด label ให้ conversation แยกแชทเรื่องต่าง ๆ |
| **Notes** | จดโน้ตภายในแต่ละ conversation (ลูกค้าไม่เห็น) |
| **Multi-LINE Account** | เพิ่ม LINE OA ได้หลายบัญชี สลับดูจาก Workspace Switcher |
| **Multi-Admin** | เพิ่มแอดมินหลายคน กำหนดสิทธิ์เข้าถึงแต่ละ Channel |
| **Push Notifications** | แจ้งเตือน Web Push เมื่อมีแชทใหม่ |
| **In-App Notifications** | กระดิ่งแจ้งเตือนในแอป + claim notification |
| **PWA** | ใช้บนมือถือเหมือนแอป เซฟหน้าจอได้เลย |
| **Dark Mode** | สลับ Light/Dark ใน Settings |
| **Broadcast** | ส่งข้อความหาลูกค้าหลายคนพร้อมกัน (backend พร้อม, UI มี) |
| **Audit Log** | บันทึกการกระทำทุกอย่างของ admin |

---

## เครื่องมือที่ต้องมีก่อน

| อะไร | เวอร์ชัน | หมายเหตุ |
|------|---------|---------|
| **Node.js** | 20+ | รันโปรเจกต์ |
| **pnpm** | 9+ | package manager (ระบบใช้ pnpm workspace) |
| **Docker** | ล่าสุด | รัน PostgreSQL + Redis |
| **LINE Developers Account** | — | ฟรี สมัครที่ [developers.line.biz](https://developers.line.biz) |
| **Cloudflare Account** | — | ใช้ R2 Object Storage เก็บรูป/ไฟล์ (ฟรี 10GB/เดือน) |

---

## วิธีติดตั้ง (ทำตามทีละขั้น)

### 1. Clone & Install

```bash
git clone https://github.com/botnick/line-oa-admin.git
cd line-oa-admin
pnpm install
```

### 2. เปิด Database + Redis

```bash
docker compose up -d
```

ได้ PostgreSQL 16 (port `5432`) + Redis 7 (port `6379`) พร้อมใช้  
Credentials: `postgres` / `postgres` / DB: `line_oa_admin`

### 3. ตั้งค่า `.env`

```bash
cp .env.example .env
```

เปิด `.env` แก้ค่านี้:

```env
# Database + Redis — ค่า default ใช้ได้เลยไม่ต้องแก้
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/line_oa_admin"
REDIS_URL="redis://localhost:6379/1"

# ⚠️ ต้องแก้! ใส่ข้อความมั่ว ๆ ยาว 32 ตัวขึ้นไป
# สร้างง่าย ๆ: openssl rand -base64 32
SESSION_SECRET="เปลี่ยนตรงนี้!"
```

ค่าอื่น ๆ (`NODE_ENV`, `PORT`, `LOG_LEVEL`) ปล่อย default ได้  
LINE Login + R2 Storage จะตั้งค่าผ่าน **Setup Wizard** ในขั้นถัดไป ไม่ต้องใส่ใน `.env`

### 4. สร้าง Database & รันเซิร์ฟเวอร์

```bash
pnpm db:generate   # สร้าง Prisma Client
pnpm db:migrate    # สร้างตาราง
pnpm dev           # เปิดเซิร์ฟเวอร์ที่ http://localhost:3000
```

### 5. Setup Wizard (ทำครั้งแรกครั้งเดียว)

เปิด `http://localhost:3000/setup` ระบบจะพาตั้งค่า **3 ขั้น** (ข้ามไม่ได้):

---

#### ขั้นที่ 1: ข้อมูลระบบ

ตั้งชื่อแอป เช่น `LINE OA ค้าบเตง` — ชื่อนี้จะโชว์บน title bar + PWA

---

#### ขั้นที่ 2: LINE Login

ใช้สำหรับล็อกอินเข้าระบบ ไม่เกี่ยวกับ Messaging API

1. ไป [LINE Developers Console](https://developers.line.biz) → สร้าง Channel ประเภท **LINE Login**
2. แท็บ **Basic settings** → ก็อป 2 ค่านี้มากรอก:

| ค่า | หน้าตา | อยู่ไหน |
|-----|-------|--------|
| **Channel ID** | ตัวเลข 10 หลัก | Basic settings |
| **Channel Secret** | ตัวอักษร 32 ตัว | Basic settings |

3. แท็บ **LINE Login** → ตั้ง **Callback URL**:

```
https://<โดเมน>/api/auth/callback/line
```

> ⚠️ **ต้องเป็น HTTPS เท่านั้น** — LINE บังคับ  
> ตอน dev บน localhost → ใช้ `ngrok http 3000` หรือ Cloudflare Tunnel ทำ HTTPS ให้

---

#### ขั้นที่ 3: Cloudflare R2 Storage

ใช้เก็บรูป/วิดีโอ/ไฟล์ที่ลูกค้าส่งมา

1. ไป [Cloudflare Dashboard](https://dash.cloudflare.com) → **R2 Object Storage** → สร้าง Bucket ใหม่
2. ก็อปค่าเหล่านี้:

| ค่า | หน้าตา | อยู่ไหน |
|-----|-------|--------|
| **Account ID** | ตัวอักษร 32 ตัว | มุมขวาบนของ Dashboard |
| **Access Key ID** | — | กด Manage R2 API Tokens → สร้าง token (permission: Object Read & Write) |
| **Secret Access Key** | — | สร้าง token แล้วจะโชว์ **ครั้งเดียว** ก็อปเก็บไว้! |
| **Bucket Name** | ชื่อ bucket ที่สร้าง | — |
| **Public URL** (optional) | URL ของ bucket | Bucket → Settings → Public access → เปิด R2.dev subdomain |

> 💡 แนะนำเปิด **Public URL** เพื่อโหลดรูปได้ถาวร  
> ถ้าไม่เปิด → ระบบจะใช้ Presigned URL แทน (หมดอายุ 1 ชม.)

---

กดบันทึก → ระบบแสดงหน้า "ตั้งค่าเสร็จ" → กดไปหน้า Inbox → ล็อกอินด้วย LINE

> **คนแรกที่ล็อกอิน** จะเป็น Super Admin อัตโนมัติ

---

### 6. เพิ่ม LINE Account (Messaging API)

ล็อกอินแล้วไปที่ **Settings > จัดการ LINE Accounts** (ต้องเป็น Super Admin)

ไป [LINE Developers Console](https://developers.line.biz) สร้าง Channel ประเภท **Messaging API**:

| ค่า | หน้าตา | อยู่ไหน |
|-----|-------|--------|
| **Channel ID** | ตัวเลข 10 หลัก | Basic settings |
| **Channel Secret** | ตัวอักษร 32 ตัว | Basic settings |
| **Channel Access Token** | ตัวอักษรยาว ~170 ตัว | แท็บ Messaging API → กดปุ่ม Issue |

ตั้ง **Webhook URL** ที่แท็บ Messaging API:

```
https://<โดเมน>/api/webhook/line
```

เปิด **Use webhook** → ✅ ON  
ปิด **Auto-reply messages** → ❌ OFF (ไม่งั้นจะตอบซ้ำกัน 2 อัน)

> ตอน dev → ใช้ `ngrok http 3000` ยิง HTTPS มาหา localhost ได้

---

## วิธีใช้งาน

ล็อกอินแล้วจะเจอเมนูหลัก:

### Desktop (SideNav ซ้ายมือ)

| เมนู | ทำอะไร |
|------|--------|
| **Inbox** | ตอบแชทลูกค้า ข้อความเด้งมาเอง (SSE Realtime) |
| **Search** | ค้นข้อความ + รายชื่อ กดจากผลค้นหาไปที่แชทนั้นได้เลย |
| **Contacts** | ดูรายชื่อ ติด Tag จัดกลุ่ม กรองตาม Follow/Unfollow |
| **Overview** | สถิติแชท 7 วัน (กราฟ) + Recent Activity |
| **Settings** | ตั้งค่าทุกอย่าง |

### Mobile (BottomNav ด้านล่าง)

4 เมนู: Inbox, Contacts, Overview, Settings

### Settings ย่อย

| เมนู | ใครเปิดได้ | ทำอะไร |
|------|-----------|--------|
| **LINE Accounts** | Super Admin | เพิ่ม/แก้/ลบ LINE OA + ดู Webhook status |
| **จัดการผู้ใช้งาน** | Super Admin | อนุมัติ/ลบ admin + กำหนดสิทธิ์เข้า channel |
| **Quick Replies** | ทุกคน | จัดการข้อความตอบด่วน |
| **Notifications** | ทุกคน | ตั้งค่า Web Push |
| **Theme** | ทุกคน | สลับ Light/Dark Mode |

### Workspace Switcher

เพิ่ม LINE Account มากกว่า 1 → จะมี switcher ให้เลือกดูแต่ละบัญชี หรือเลือก "ทุกบัญชี" ดูรวม

### ใช้บนมือถือ

เปิดเว็บ → กด "Add to Home Screen" → ได้แอปเต็มจอ (PWA)

---

## สิ่งที่ระบบทำให้อัตโนมัติ

- **เก็บรูป/วิดีโอ/ไฟล์ลง R2** → ลูกค้าส่งรูปมา ระบบก็อปไปเก็บใน Cloudflare R2 ทันที (BullMQ job queue) เปิดดูได้ถาวร ไม่หมดอายุ
- **สร้าง Contact อัตโนมัติ** → ลูกค้าทักมาครั้งแรก ระบบสร้าง contact + conversation ให้เลย
- **อัปเดต Follow/Unfollow** → ลูกค้า follow/unfollow LINE OA ระบบจับ event อัปเดตสถานะให้
- **คนแรก = Super Admin** → ไม่ต้องตั้ง admin ด้วยมือ ล็อกอินคนแรกได้เป็น Super Admin เลย
- **Notification แจ้งเตือน** → มีแชทใหม่ ระบบส่ง in-app + Web Push ให้ admin ทุกคน

---

## ข้อจำกัด 

### จากฝั่ง LINE (ควบคุมไม่ได้)

| เรื่อง | รายละเอียด |
|--------|-----------|
| **โควต้าข้อความ** | แพ็กเกจฟรี (Communication) ส่งได้ **200 ข้อความ/เดือน** นับเฉพาะขาออก (Push/Reply) ถ้าแชทเยอะต้องอัปเกรดแพ็กเกจฝั่ง LINE |
| **Content หมดอายุ** | รูป/วิดีโอ/ไฟล์ที่ลูกค้าส่ง ดาวน์โหลดจาก LINE API ได้แค่ **~14 วัน** ระบบนี้เลยก๊อปไป R2 ให้อัตโนมัติ |
| **Webhook ต้อง HTTPS** | LINE บังคับ HTTPS ทั้ง Webhook URL และ LINE Login Callback ตอน dev ใช้ ngrok/Cloudflare Tunnel |
| **ไม่มี Read Receipt API** | ดูไม่ได้ว่าลูกค้าอ่านข้อความหรือยัง (LINE ไม่เปิดให้) |
| **LINE Login ต้อง HTTPS** | Callback URL ต้อง HTTPS เท่านั้น localhost ธรรมดาใช้ไม่ได้ |
| **Sticker Content Agreement** | สติกเกอร์บางตัวแสดงไม่ได้ถ้าไม่ได้ยอมรับ Content Agreement ใน LINE Developers Console |

### ของตัวระบบเอง

| เรื่อง | รายละเอียด |
|--------|-----------|
| **Self-hosted เท่านั้น** | ต้องมีเซิร์ฟเวอร์รันเอง (VPS, Docker, etc.) ไม่มีบริการ hosted |
| **ต้องมี Cloudflare R2** | ถ้าไม่ตั้ง R2 จะเปิดรูป/ไฟล์เก่าไม่ได้หลัง 14 วัน |
| **Rich Menu จัดการไม่ได้** | ไม่มี UI สร้าง/แก้ Rich Menu ต้องไปทำผ่าน LINE OA Manager |
| **Flex Message ส่งไม่ได้** | รับ Flex ที่ลูกค้าส่งมาได้ แต่ไม่มี UI สำหรับสร้าง Flex ส่งกลับ |
| **ไม่มี Role แบบละเอียด** | มีแค่ 2 สิทธิ์: `SUPER_ADMIN` กับ `ADMIN` ไม่มี role ย่อยแบบ viewer/editor |
| **Single instance** | ออกแบบให้รันเครื่องเดียว ยังไม่มี horizontal scaling |
| **ไม่มี i18n** | UI เป็นภาษาไทยอย่างเดียว ยังไม่มีระบบเปลี่ยนภาษา |
| **ไม่มี 2FA** | ล็อกอินด้วย LINE Login อย่างเดียว ไม่มี 2-factor authentication เพิ่ม |
| **Image optimization อยู่ฝั่ง server** | รูปโดน optimize ด้วย Sharp ตอนอัปโหลด ยังไม่มี CDN resize on-the-fly |

---

## Deploy Production

```bash
pnpm build        # build Next.js
pnpm start         # รันเซิร์ฟเวอร์ production
```

การตั้งค่าก่อนใช้งานจริง:
- การทำงานหลักของ PostgreSQL และ Redis (สามารถใช้งานได้ด้วย Docker )
- โดเมน + SSL (HTTPS) สำหรับ URL ของ Webhook และ URL ของ CALLBACK ที่ใช้สำหรับการเข้าสู่ระบบ Line
- ค่า NODE_ENV คือ "production"
- ค่า SESSION_SECRET  

---

## คำสั่งที่มี

| คำสั่ง | ทำอะไร |
|--------|--------|
| `pnpm dev` | เปิด dev server (port 3000) |
| `pnpm build` | build production |
| `pnpm lint` | Lint ทุก package |
| `pnpm test` | รัน test (Vitest) |
| `pnpm db:generate` | สร้าง Prisma Client |
| `pnpm db:migrate` | รัน migration |
| `pnpm db:push` | Push schema ตรง ๆ (dev only) |
| `pnpm db:studio` | เปิด Prisma Studio ดูข้อมูล |
| `pnpm clean` | ลบ build cache + node_modules |

---

## โครงสร้างโปรเจกต์

```
line-oa-admin/
├── apps/
│   └── web/              ← Next.js 16 App (frontend + backend)
│       ├── src/
│       │   ├── app/          ← Pages + API routes
│       │   ├── components/   ← UI Components
│       │   ├── server/       ← tRPC routers + LINE service
│       │   └── lib/          ← Utilities + helpers
│       └── public/           ← PWA assets + icons
├── packages/
│   ├── db/               ← Prisma schema + client
│   ├── config/           ← Shared config
│   └── shared/           ← Shared types + constants
├── docs/screenshots/     ← Screenshots สำหรับ README
├── docker-compose.yml    ← PostgreSQL 16 + Redis 7
├── turbo.json            ← Turborepo config
└── .env.example          ← ตัวอย่าง environment variables
```

---

## Tech Stack

| ส่วน | เทคโนโลยี | เวอร์ชัน |
|------|----------|---------|
| Framework | Next.js (App Router) | 16 |
| UI | React + Framer Motion + Lucide Icons | 19 |
| API Layer | tRPC + TanStack React Query | 11 / 5 |
| Database | PostgreSQL + Prisma ORM | 16 / 7 |
| Realtime | SSE (Server-Sent Events) + Redis Pub/Sub | — |
| Storage | Cloudflare R2 (S3-compatible) + Sharp | — |
| Queue | BullMQ + Redis | 5 / 7 |
| Auth | LINE Login + jose (JWT) | — |
| Validation | Zod | 4 |
| Build | Turborepo + pnpm Workspaces | — |
| Charts | Recharts | 3 |
| Toast | Sonner | 2 |

---

## License

MIT — ใช้ฟรี แก้ได้ เอาไปทำอะไรก็ได้

---

<div align="center">

ทำขึ้นมาเพราะอยากช่วยแฟน แล้วก็อยากให้คนอื่นใช้ด้วย

</div>
