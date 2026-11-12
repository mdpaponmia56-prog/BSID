import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default function SignUpPage() {
  // Only one administrator credential is authorized (mdpaponmia56@gmail.com).
  // Public account registration is disabled.
  redirect("/sign-in");
}
