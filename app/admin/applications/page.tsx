"use client";

import React, { Suspense, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  CheckCircle2,
  Download,
  Loader2,
  Search,
  Trash2,
  XCircle,
} from "lucide-react";
import { ApplicationRecord, BLOOD_GROUPS } from "@/lib/types";
import StatusBadge from "@/components/StatusBadge";

function ApplicationsListContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const initialStatus = searchParams.get("status") || "all";

  const [status, setStatus] = useState(initialStatus);
  const [search, setSearch] = useState("");
  const [bloodGroup, setBloodGroup] = useState("all");
  const [sort, setSort] = useState("newest");
  const [applications, setApplications] = useState<ApplicationRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteTarget, setDeleteTarget] = useState<ApplicationRecord | null>(
    null
  );
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    setStatus(searchParams.get("status") || "all");
  }, [searchParams]);

  const fetchApplications = useCallback(async () => {
    setLoading(true);
    try {
      const qs = new URLSearchParams({
        status,
        search,
        blood_group: bloodGroup,
        sort,
      });
      const res = await fetch(`/api/admin/applications?${qs.toString()}`);
      const data = await res.json();
      if (res.ok) {
        setApplications(data.applications || []);
      }
    } finally {
      setLoading(false);
    }
  }, [status, search, bloodGroup, sort]);

  useEffect(() => {
    const t = setTimeout(() => {
      fetchApplications();
    }, 200);
    return () => clearTimeout(t);
  }, [fetchApplications]);

  async function handleConfirmDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/admin/applications/${deleteTarget.id}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error || "Delete failed.");
      }
      setDeleteTarget(null);
      await fetchApplications();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Delete failed.");
    } finally {
      setDeleting(false);
    }
  }

  async function handleStatusAction(
    app: ApplicationRecord,
    nextStatus: "Approved" | "Rejected"
  ) {
    let reason: string | null = null;
    if (nextStatus === "Rejected") {
      reason = prompt(
        `Enter rejection reason for ${app.full_name} (${app.bs_id}):`,
        app.rejection_reason || ""
      );
      if (reason === null) return;
    }

    const res = await fetch(`/api/admin/applications/${app.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        application_status: nextStatus,
        rejection_reason: reason,
        regenerate_card: nextStatus === "Approved",
      }),
    });
    if (res.ok) {
      await fetchApplications();
    } else {
      const d = await res.json();
      alert(d.error || "Failed to update status.");
    }
  }

  const tabs = [
    { key: "all", label: "All" },
    { key: "Pending", label: "Pending" },
    { key: "Approved", label: "Approved" },
    { key: "Rejected", label: "Rejected" },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">
            {status === "all" ? "All Applications" : `${status} Applications`}
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Search, filter, edit, approve, reject, or generate BS ID cards.
          </p>
        </div>
      </div>

      {/* Filters Bar */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 space-y-4 shadow-xs">
        <div className="flex flex-wrap items-center gap-2">
          {tabs.map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => {
                setStatus(t.key);
                router.push(
                  t.key === "all"
                    ? "/admin/applications"
                    : `/admin/applications?status=${t.key}`
                );
              }}
              className={`px-4 py-1.5 rounded-xl text-xs font-semibold transition cursor-pointer ${
                status === t.key
                  ? "bg-slate-900 text-white"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
          <div className="sm:col-span-2 relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
            <input
              type="text"
              placeholder="Search by Name, BS ID, Reference, Email, or Phone..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-xl border border-slate-300 pl-10 pr-4 py-2 text-sm focus:border-emerald-600 focus:outline-none"
            />
          </div>

          <select
            value={bloodGroup}
            onChange={(e) => setBloodGroup(e.target.value)}
            className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"
          >
            <option value="all">All Blood Groups</option>
            {BLOOD_GROUPS.map((bg) => (
              <option key={bg} value={bg}>
                {bg}
              </option>
            ))}
          </select>

          <select
            value={sort}
            onChange={(e) => setSort(e.target.value)}
            className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"
          >
            <option value="newest">Newest First</option>
            <option value="oldest">Oldest First</option>
            <option value="name_asc">Name (A–Z)</option>
            <option value="name_desc">Name (Z–A)</option>
            <option value="bs_id">BS ID (Ascending)</option>
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        {loading ? (
          <div className="p-12 flex items-center justify-center gap-2 text-slate-500">
            <Loader2 className="w-5 h-5 animate-spin" />
            <span>Loading applications...</span>
          </div>
        ) : applications.length === 0 ? (
          <div className="p-12 text-center text-sm text-slate-500">
            No matching applications found.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase text-slate-500 border-b border-slate-200">
                <tr>
                  <th className="px-5 py-3.5">Applicant</th>
                  <th className="px-4 py-3.5">BS ID</th>
                  <th className="px-4 py-3.5">Blood</th>
                  <th className="px-4 py-3.5">Contact &amp; Email</th>
                  <th className="px-4 py-3.5">Submitted</th>
                  <th className="px-4 py-3.5">Status</th>
                  <th className="px-5 py-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {applications.map((app) => (
                  <tr key={app.id} className="hover:bg-slate-50/70">
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-3">
                        <img
                          src={app.photograph_url}
                          alt={app.full_name}
                          className="w-10 h-12 rounded-lg object-cover border border-slate-200 shrink-0"
                        />
                        <div>
                          <p className="font-semibold text-slate-900">
                            {app.full_name}
                          </p>
                          <p className="text-xs text-slate-500 font-mono">
                            {app.application_reference}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3.5 font-semibold text-slate-800">
                      {app.bs_id}
                    </td>
                    <td className="px-4 py-3.5">
                      <span className="inline-flex px-2 py-0.5 rounded bg-red-50 text-red-700 font-semibold text-xs border border-red-200">
                        {app.blood_group}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 text-xs text-slate-600">
                      <p className="font-medium text-slate-800">
                        {app.contact_number}
                      </p>
                      <p className="truncate max-w-[200px]">{app.email}</p>
                    </td>
                    <td className="px-4 py-3.5 text-xs text-slate-500 whitespace-nowrap">
                      {new Date(app.submission_date).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3.5">
                      <StatusBadge status={app.application_status} />
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      <div className="inline-flex items-center gap-1.5">
                        {app.application_status !== "Approved" && (
                          <button
                            type="button"
                            onClick={() => handleStatusAction(app, "Approved")}
                            title="Approve & Generate Card"
                            className="p-1.5 rounded-lg text-emerald-700 hover:bg-emerald-50 cursor-pointer"
                          >
                            <CheckCircle2 className="w-4 h-4" />
                          </button>
                        )}
                        {app.application_status !== "Rejected" && (
                          <button
                            type="button"
                            onClick={() => handleStatusAction(app, "Rejected")}
                            title="Reject Application"
                            className="p-1.5 rounded-lg text-amber-700 hover:bg-amber-50 cursor-pointer"
                          >
                            <XCircle className="w-4 h-4" />
                          </button>
                        )}
                        {app.generated_card_pdf_url && (
                          <a
                            href={`/api/admin/applications/${app.id}/download?format=pdf`}
                            title="Download PDF"
                            className="p-1.5 rounded-lg text-slate-700 hover:bg-slate-100"
                          >
                            <Download className="w-4 h-4" />
                          </a>
                        )}
                        <button
                          type="button"
                          onClick={() => setDeleteTarget(app)}
                          title="Delete Application"
                          className="p-1.5 rounded-lg text-red-600 hover:bg-red-50 cursor-pointer"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                        <Link
                          href={`/admin/applications/${app.id}`}
                          className="ml-1 rounded-lg bg-slate-900 hover:bg-slate-800 text-white px-3 py-1.5 text-xs font-semibold"
                        >
                          Edit &amp; Card
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Delete Confirmation Modal */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-slate-200 space-y-4">
            <h3 className="text-lg font-bold text-slate-900">
              Delete Application?
            </h3>
            <p className="text-sm text-slate-600">
              Are you sure you want to permanently delete the application for{" "}
              <strong>{deleteTarget.full_name}</strong> ({deleteTarget.bs_id})?
              This action is recorded in the audit log and cannot be undone.
            </p>
            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                disabled={deleting}
                onClick={() => setDeleteTarget(null)}
                className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={deleting}
                onClick={handleConfirmDelete}
                className="inline-flex items-center gap-2 rounded-xl bg-red-600 hover:bg-red-700 text-white px-4 py-2 text-sm font-semibold cursor-pointer"
              >
                {deleting && <Loader2 className="w-4 h-4 animate-spin" />}
                Delete Permanently
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function AdminApplicationsPage() {
  return (
    <Suspense
      fallback={
        <div className="p-12 flex items-center justify-center text-slate-500">
          Loading...
        </div>
      }
    >
      <ApplicationsListContent />
    </Suspense>
  );
}
