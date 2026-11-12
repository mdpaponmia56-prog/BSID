# BS ID Card Generator & Management System

> Production-ready Bangladesh Scouts ID Card Generation and Administration Portal built with Next.js 16, TypeScript, Tailwind CSS, Neon PostgreSQL, and Clerk Authentication.
> **Build by Md Nazmul Miah (BS ID: ZM0914)**

---

## 🌟 Key Features

1. **Public Application Portal (`/`)**
   - High-fidelity Scout ID Card application form with real-time field validation.
   - Dual-side live rendering preview (Front & Back) updated interactively as users type.
   - Front template features expiry date: `31-12-2029`.
   - Back template features issue date: `15-11-2026`.
   - Fully mobile-responsive layout designed mobile-first with touch-friendly controls.

2. **Secure Administration Dashboard (`/admin`)**
   - Strict single-admin Clerk authentication locked exclusively to `mdpaponmia56@gmail.com`.
   - Unauthenticated or unauthorized visitors are blocked and redirected to sign-in.
   - Application management: approve, reject, review, and filter applicant records.
   - Automated ID card generation engine creating high-resolution front & back PNG cards and print-ready PDFs.
   - Bulk download ZIP export and printable sheet layout.
   - Template management and system audit logs.

3. **Backend & Architecture**
   - **Framework:** Next.js 16 (App Router) + React 19.
   - **Database:** Neon Serverless PostgreSQL with connection pooling (`@neondatabase/serverless`).
   - **Auth:** Clerk (`@clerk/nextjs`) with middleware protection and server-side email verification.
   - **Card Rendering:** High-resolution server-side card canvas renderer (`@napi-rs/canvas` / `sharp` fallback) with official Bangladesh Scouts color schemes and typography.

---

## ⚙️ Environment Variables

Copy `.env.example` to `.env.local` and configure your credentials:

```bash
# Neon PostgreSQL Connection String
DATABASE_URL="postgresql://user:password@endpoint-pooler.region.neon.tech/neondb?sslmode=require"

# Restricted Admin Email
ADMIN_ALLOWED_EMAIL="mdpaponmia56@gmail.com"

# Clerk Authentication Keys
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY="pk_..."
CLERK_SECRET_KEY="sk_..."

# Clerk Routes
NEXT_PUBLIC_CLERK_SIGN_IN_URL="/sign-in"
NEXT_PUBLIC_CLERK_SIGN_UP_URL="/sign-up"
NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL="/admin"
NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL="/admin"
```

---

## 🚀 Local Development

```bash
# Install dependencies
npm install

# Run development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) for the public application form or [http://localhost:3000/admin](http://localhost:3000/admin) for the admin portal.

---

## 📦 Deployment on Vercel

1. Push this repository to GitHub:
   ```bash
   git remote add origin https://github.com/mdpaponmia56-prog/BSID.git
   git branch -M main
   git push -u origin main
   ```
2. Import the repository in [Vercel](https://vercel.com/new).
3. Add the environment variables (`DATABASE_URL`, `ADMIN_ALLOWED_EMAIL`, `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY`, etc.) in Project Settings > Environment Variables.
4. Deploy with zero configuration.
