import React, { Suspense } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { SignOutButton } from "@clerk/nextjs";
import { ADMIN_ALLOWED_EMAIL, getAdminSession } from "@/lib/auth";
import AdminSidebar from "@/components/AdminSidebar";
import { AlertTriangle, KeyRound, ShieldAlert } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getAdminSession();

  if (session.status === "unconfigured") {
    return (
      <main className="min-h-screen flex items-center justify-center bg-slate-100 p-4">
        <div className="max-w-lg w-full bg-white rounded-2xl border border-amber-200 shadow-lg p-7 space-y-4">
          <div className="flex items-start gap-3">
            <KeyRound className="w-6 h-6 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <h1 className="text-lg font-bold text-slate-900">
                Clerk Authentication Setup Required
              </h1>
              <p className="text-sm text-slate-600 mt-1">
                Administrator login is protected by Clerk and restricted to{" "}
                <strong>{ADMIN_ALLOWED_EMAIL}</strong>. Add your Clerk keys to{" "}
                <code className="bg-slate-100 px-1.5 py-0.5 rounded text-xs">
                  .env.local
                </code>{" "}
                and restart the server.
              </p>
            </div>
          </div>
          <pre className="bg-slate-900 text-slate-100 rounded-xl p-4 text-xs overflow-x-auto">
{`NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY="pk_test_..."
CLERK_SECRET_KEY="sk_test_..."`}
          </pre>
          <div className="pt-2">
            <Link
              href="/"
              className="text-sm font-semibold text-emerald-700 hover:underline"
            >
              ← Return to Public Application Form
            </Link>
          </div>
        </div>
      </main>
    );
  }

  if (session.status === "unauthenticated") {
    redirect("/sign-in");
  }

  if (session.status === "forbidden") {
    return (
      <main className="min-h-screen flex items-center justify-center bg-slate-100 p-4">
        <div className="max-w-md w-full bg-white rounded-2xl border border-red-200 shadow-lg p-7 text-center space-y-4">
          <div className="w-14 h-14 rounded-full bg-red-100 text-red-600 flex items-center justify-center mx-auto">
            <ShieldAlert className="w-7 h-7" />
          </div>
          <h1 className="text-xl font-bold text-slate-900">Access Denied</h1>
          <p className="text-sm text-slate-600">
            You are signed in as{" "}
            <strong className="text-slate-900">
              {session.userEmail || "an unauthorized account"}
            </strong>
            .
          </p>
          <div className="flex items-start gap-2.5 text-left rounded-xl bg-amber-50 border border-amber-200 p-3.5 text-xs text-amber-900">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-amber-600" />
            <span>
              Administrator access is strictly restricted to{" "}
              <strong>{ADMIN_ALLOWED_EMAIL}</strong>.
            </span>
          </div>
          <div className="flex items-center justify-center gap-3 pt-2">
            <SignOutButton redirectUrl="/sign-in">
              <button
                type="button"
                className="rounded-xl bg-red-600 hover:bg-red-700 text-white text-sm font-semibold px-5 py-2.5 cursor-pointer"
              >
                Sign Out &amp; Switch Account
              </button>
            </SignOutButton>
            <Link
              href="/"
              className="rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-sm font-semibold px-4 py-2.5"
            >
              Public Form
            </Link>
          </div>
        </div>
      </main>
    );
  }

  return (
    <div className="min-h-screen flex flex-col lg:flex-row bg-slate-100">
      <Suspense fallback={<div className="w-68 bg-slate-950" />}>
        <AdminSidebar
          adminEmail={session.admin.email}
          adminName={session.admin.name}
        />
      </Suspense>
      <main className="flex-1 min-w-0 p-4 sm:p-6 lg:p-8">{children}</main>
    </div>
  );
}
