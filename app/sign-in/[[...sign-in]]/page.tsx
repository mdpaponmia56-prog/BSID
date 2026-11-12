import React, { Suspense } from "react";
import Link from "next/link";
import { SignIn } from "@clerk/nextjs";
import { isClerkConfigured, ADMIN_ALLOWED_EMAIL } from "@/lib/auth";
import { ArrowLeft, KeyRound, ShieldAlert } from "lucide-react";

export const dynamic = "force-dynamic";

export default function SignInPage() {
  const configured = isClerkConfigured();

  return (
    <main className="min-h-screen flex flex-col items-center justify-center bg-slate-100 px-4 py-12">
      <div className="mb-6 text-center max-w-md">
        <div className="inline-flex items-center gap-2 rounded-full bg-emerald-100 text-emerald-800 px-3.5 py-1 text-xs font-semibold mb-3">
          <KeyRound className="w-3.5 h-3.5" />
          Private Administrator Access
        </div>
        <h1 className="text-2xl font-bold text-slate-900">
          BS ID Card Management Portal
        </h1>
        <p className="text-sm text-slate-600 mt-1">
          Authorized exclusively for{" "}
          <span className="font-semibold text-slate-900">
            {ADMIN_ALLOWED_EMAIL}
          </span>
        </p>
      </div>

      {configured ? (
        <Suspense
          fallback={
            <div className="text-sm text-slate-500">Loading sign-in...</div>
          }
        >
          <SignIn
            fallbackRedirectUrl="/admin"
            signUpUrl="/sign-in"
            appearance={{
              elements: {
                rootBox: "mx-auto",
                card: "shadow-xl border border-slate-200 rounded-2xl",
                footerAction: "hidden",
                footer: "hidden",
              },
            }}
          />
        </Suspense>
      ) : (
        <div className="max-w-lg w-full bg-white rounded-2xl border border-amber-200 shadow-sm p-6 space-y-4">
          <div className="flex items-start gap-3 text-amber-800">
            <ShieldAlert className="w-6 h-6 shrink-0 mt-0.5 text-amber-600" />
            <div>
              <h2 className="font-bold text-base">
                Clerk Authentication Keys Required
              </h2>
              <p className="text-sm text-slate-600 mt-1">
                Add your Clerk keys to{" "}
                <code className="bg-slate-100 px-1.5 py-0.5 rounded text-xs">
                  .env.local
                </code>{" "}
                to enable administrator login for{" "}
                <strong>{ADMIN_ALLOWED_EMAIL}</strong>:
              </p>
            </div>
          </div>
          <pre className="bg-slate-900 text-slate-100 rounded-xl p-4 text-xs overflow-x-auto">
{`NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY="pk_test_..."
CLERK_SECRET_KEY="sk_test_..."`}
          </pre>
        </div>
      )}

      <Link
        href="/"
        className="mt-6 inline-flex items-center gap-1.5 text-sm font-medium text-slate-600 hover:text-slate-900"
      >
        <ArrowLeft className="w-4 h-4" />
        Return to Public Application Form
      </Link>
    </main>
  );
}
