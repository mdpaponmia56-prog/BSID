"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import {
  CheckCircle2,
  Clock,
  Download,
  ExternalLink,
  FileText,
  IdCard,
  Loader2,
  Sparkles,
  Users,
  XCircle,
} from "lucide-react";
import { ApplicationRecord } from "@/lib/types";
import StatusBadge from "@/components/StatusBadge";

interface DashboardStats {
  total: number;
  pending: number;
  approved: number;
  rejected: number;
  generated_cards: number;
}

export default function AdminOverviewPage() {
  const [applications, setApplications] = useState<ApplicationRecord[]>([]);
  const [stats, setStats] = useState<DashboardStats>({
    total: 0,
    pending: 0,
    approved: 0,
    rejected: 0,
    generated_cards: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  async function loadDashboard() {
    try {
      setError(null);
      const res = await fetch("/api/admin/applications?sort=newest");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load dashboard.");
      setApplications(data.applications || []);
      setStats(data.stats || stats);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load data.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadDashboard();
  }, []);

  async function handleQuickApproveAndGenerate(id: string) {
    setBusyId(id);
    try {
      const res = await fetch(`/api/admin/applications/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          application_status: "Approved",
          regenerate_card: true,
        }),
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error || "Failed to approve.");
      }
      await loadDashboard();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Action failed.");
    } finally {
      setBusyId(null);
    }
  }

  const cards = [
    {
      label: "Total Applications",
      value: stats.total,
      icon: Users,
      accent: "bg-slate-900 text-white",
      href: "/admin/applications",
    },
    {
      label: "Pending Applications",
      value: stats.pending,
      icon: Clock,
      accent: "bg-amber-500 text-white",
      href: "/admin/applications?status=Pending",
    },
    {
      label: "Approved Applications",
      value: stats.approved,
      icon: CheckCircle2,
      accent: "bg-emerald-600 text-white",
      href: "/admin/applications?status=Approved",
    },
    {
      label: "Rejected Applications",
      value: stats.rejected,
      icon: XCircle,
      accent: "bg-red-600 text-white",
      href: "/admin/applications?status=Rejected",
    },
    {
      label: "Total Generated ID Cards",
      value: stats.generated_cards,
      icon: IdCard,
      accent: "bg-[#8f007c] text-white",
      href: "/admin/downloads",
    },
  ];

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">
            Dashboard Overview
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Monitor incoming BS ID Card applications, approvals, and generated
            cards.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/"
            target="_blank"
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 px-4 py-2 text-sm font-semibold text-slate-700"
          >
            <ExternalLink className="w-4 h-4" />
            Public Form
          </Link>
          <Link
            href="/admin/templates"
            className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 px-4 py-2 text-sm font-semibold text-white"
          >
            Template Editor
          </Link>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-4">
        {cards.map((c) => {
          const Icon = c.icon;
          return (
            <Link
              key={c.label}
              href={c.href}
              className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs hover:shadow-md transition flex items-center justify-between"
            >
              <div>
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                  {c.label}
                </p>
                <p className="text-3xl font-bold text-slate-900 mt-2">
                  {loading ? "—" : c.value}
                </p>
              </div>
              <div
                className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${c.accent}`}
              >
                <Icon className="w-5 h-5" />
              </div>
            </Link>
          );
        })}
      </div>

      {/* Recent Applications Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-emerald-700" />
            <h2 className="text-base font-bold text-slate-900">
              Recent Applications
            </h2>
          </div>
          <Link
            href="/admin/applications"
            className="text-sm font-semibold text-emerald-700 hover:underline"
          >
            View All Applications →
          </Link>
        </div>

        {error && (
          <div className="p-6 text-sm text-red-600 bg-red-50">{error}</div>
        )}

        {loading ? (
          <div className="p-12 flex items-center justify-center text-slate-500 gap-2">
            <Loader2 className="w-5 h-5 animate-spin" />
            <span>Loading applications...</span>
          </div>
        ) : applications.length === 0 ? (
          <div className="p-12 text-center text-slate-500 text-sm">
            No applications have been submitted yet. Share the{" "}
            <Link href="/" className="text-emerald-700 font-semibold underline">
              Public Application Form
            </Link>{" "}
            to receive submissions.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase text-slate-500 border-b border-slate-200">
                <tr>
                  <th className="px-5 py-3.5">Applicant</th>
                  <th className="px-4 py-3.5">BS ID</th>
                  <th className="px-4 py-3.5">Blood Group</th>
                  <th className="px-4 py-3.5">Contact</th>
                  <th className="px-4 py-3.5">Email</th>
                  <th className="px-4 py-3.5">Submitted</th>
                  <th className="px-4 py-3.5">Status</th>
                  <th className="px-5 py-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {applications.slice(0, 10).map((app) => (
                  <tr key={app.id} className="hover:bg-slate-50/70">
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-3">
                        <img
                          src={app.photograph_url}
                          alt={app.full_name}
                          className="w-10 h-12 rounded-lg object-cover border border-slate-200 bg-slate-100 shrink-0"
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
                      <span className="inline-flex items-center px-2 py-0.5 rounded bg-red-50 text-red-700 font-semibold text-xs border border-red-200">
                        {app.blood_group}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 text-slate-700">
                      {app.contact_number}
                    </td>
                    <td className="px-4 py-3.5 text-slate-600 max-w-[180px] truncate">
                      {app.email}
                    </td>
                    <td className="px-4 py-3.5 text-xs text-slate-500 whitespace-nowrap">
                      {new Date(app.submission_date).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3.5">
                      <StatusBadge status={app.application_status} />
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      <div className="inline-flex items-center gap-2">
                        {app.application_status === "Pending" && (
                          <button
                            type="button"
                            disabled={busyId === app.id}
                            onClick={() => handleQuickApproveAndGenerate(app.id)}
                            className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white px-2.5 py-1.5 text-xs font-semibold cursor-pointer disabled:opacity-50"
                          >
                            {busyId === app.id ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <Sparkles className="w-3.5 h-3.5" />
                            )}
                            Approve &amp; Generate
                          </button>
                        )}
                        {app.generated_card_pdf_url && (
                          <a
                            href={`/api/admin/applications/${app.id}/download?format=pdf`}
                            className="inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 px-2.5 py-1.5 text-xs font-semibold"
                            title="Download PDF"
                          >
                            <Download className="w-3.5 h-3.5" />
                            PDF
                          </a>
                        )}
                        <Link
                          href={`/admin/applications/${app.id}`}
                          className="inline-flex items-center rounded-lg bg-slate-900 hover:bg-slate-800 text-white px-3 py-1.5 text-xs font-semibold"
                        >
                          Open / Edit
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
    </div>
  );
}
