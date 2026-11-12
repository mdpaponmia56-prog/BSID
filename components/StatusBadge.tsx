import React from "react";
import { ApplicationStatus } from "@/lib/types";

export default function StatusBadge({ status }: { status: ApplicationStatus }) {
  const styles: Record<ApplicationStatus, string> = {
    Pending: "bg-amber-100 text-amber-800 border-amber-200",
    Approved: "bg-emerald-100 text-emerald-800 border-emerald-200",
    Rejected: "bg-red-100 text-red-800 border-red-200",
  };

  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border ${
        styles[status] || styles.Pending
      }`}
    >
      {status}
    </span>
  );
}
