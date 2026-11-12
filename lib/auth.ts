import { auth, currentUser } from "@clerk/nextjs/server";
import { getSql } from "./db";

export const ADMIN_ALLOWED_EMAIL = (
  process.env.ADMIN_ALLOWED_EMAIL || "mdpaponmia56@gmail.com"
)
  .trim()
  .toLowerCase();

export function isClerkConfigured(): boolean {
  const pk = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY?.trim() || "";
  const sk = process.env.CLERK_SECRET_KEY?.trim() || "";
  return pk.startsWith("pk_") && sk.startsWith("sk_");
}

export class AdminAuthError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

export interface AuthorizedAdmin {
  id: string;
  name: string;
  email: string;
  role: string;
  clerkUserId: string;
}

export type AdminSessionCheck =
  | { status: "unconfigured" }
  | { status: "unauthenticated" }
  | { status: "forbidden"; userEmail: string | null }
  | { status: "authorized"; admin: AuthorizedAdmin };

export async function getAdminSession(): Promise<AdminSessionCheck> {
  if (!isClerkConfigured()) {
    return { status: "unconfigured" };
  }

  const { userId } = await auth();
  if (!userId) {
    return { status: "unauthenticated" };
  }

  const user = await currentUser();
  if (!user) {
    return { status: "unauthenticated" };
  }

  const verifiedEmails = user.emailAddresses
    .filter((e) => e.verification?.status === "verified")
    .map((e) => e.emailAddress.trim().toLowerCase());

  const primaryEmail =
    user.emailAddresses
      .find((e) => e.id === user.primaryEmailAddressId)
      ?.emailAddress.trim()
      .toLowerCase() ??
    verifiedEmails[0] ??
    null;

  if (!verifiedEmails.includes(ADMIN_ALLOWED_EMAIL)) {
    return { status: "forbidden", userEmail: primaryEmail };
  }

  const sql = getSql();
  const rows = (await sql`
    SELECT id, name, email, role, account_status, clerk_user_id
    FROM administrators
    WHERE LOWER(email) = ${ADMIN_ALLOWED_EMAIL}
    LIMIT 1
  `) as Array<{
    id: string;
    name: string;
    email: string;
    role: string;
    account_status: string;
    clerk_user_id: string | null;
  }>;

  const adminRow = rows[0];
  if (!adminRow || adminRow.account_status !== "Active") {
    return { status: "forbidden", userEmail: ADMIN_ALLOWED_EMAIL };
  }

  if (adminRow.clerk_user_id !== user.id) {
    await sql`
      UPDATE administrators
      SET clerk_user_id = ${user.id}, updated_date = NOW()
      WHERE id = ${adminRow.id}::uuid
    `;
  }

  return {
    status: "authorized",
    admin: {
      id: adminRow.id,
      name: adminRow.name,
      email: adminRow.email,
      role: adminRow.role,
      clerkUserId: user.id,
    },
  };
}

export async function requireAdmin(): Promise<AuthorizedAdmin> {
  const session = await getAdminSession();
  if (session.status === "unconfigured") {
    throw new AdminAuthError(
      "Authentication provider is not configured. Configure Clerk environment keys.",
      503
    );
  }
  if (session.status === "unauthenticated") {
    throw new AdminAuthError("Authentication required.", 401);
  }
  if (session.status === "forbidden") {
    throw new AdminAuthError(
      "Access denied. Only the authorized administrator (mdpaponmia56@gmail.com) may access this resource.",
      403
    );
  }
  return session.admin;
}
