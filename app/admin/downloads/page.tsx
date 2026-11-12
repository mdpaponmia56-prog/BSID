"use client";

import React, { useEffect, useState } from "react";
import {
  CheckSquare,
  Download,
  FileArchive,
  Loader2,
  Printer,
  Square,
} from "lucide-react";
import { ApplicationRecord } from "@/lib/types";
import StatusBadge from "@/components/StatusBadge";
import { printGeneratedIdCard } from "@/lib/print-card";

export default function AdminDownloadsPage() {
  const [applications, setApplications] = useState<ApplicationRecord[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [bulkFormat, setBulkFormat] = useState<"all" | "png" | "pdf">("all");
  const [downloadingBulk, setDownloadingBulk] = useState(false);

  useEffect(() => {
    fetch("/api/admin/applications?sort=newest")
      .then((r) => r.json())
      .then((d) => setApplications(d.applications || []))
      .finally(() => setLoading(false));
  }, []);

  function toggleOne(id: string) {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }

  function toggleAll() {
    if (selectedIds.length === applications.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(applications.map((a) => a.id));
    }
  }

  async function handleBulkDownload() {
    if (selectedIds.length === 0) return;
    setDownloadingBulk(true);
    try {
      const res = await fetch("/api/admin/downloads/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: selectedIds, format: bulkFormat }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Bulk download failed.");
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `BS-ID-Cards-${new Date().toISOString().slice(0, 10)}.zip`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Bulk download failed.");
    } finally {
      setDownloadingBulk(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Download Center</h1>
          <p className="text-sm text-slate-500 mt-1">
            Download individual PNG/PDF cards or package multiple ID cards into
            a single ZIP archive.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <select
            value={bulkFormat}
            onChange={(e) =>
              setBulkFormat(e.target.value as "all" | "png" | "pdf")
            }
            className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700"
          >
            <option value="all">ZIP: PNG + PDF</option>
            <option value="png">ZIP: High-Res PNGs Only</option>
            <option value="pdf">ZIP: Print-Ready PDFs Only</option>
          </select>

          <button
            type="button"
            disabled={selectedIds.length === 0 || downloadingBulk}
            onClick={handleBulkDownload}
            className="inline-flex items-center gap-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 disabled:bg-slate-300 text-white px-4 py-2 text-xs font-semibold cursor-pointer"
          >
            {downloadingBulk ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <FileArchive className="w-4 h-4" />
            )}
            Download Selected ZIP ({selectedIds.length})
          </button>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        {loading ? (
          <div className="p-12 flex items-center justify-center gap-2 text-slate-500">
            <Loader2 className="w-5 h-5 animate-spin" />
            <span>Loading cards...</span>
          </div>
        ) : applications.length === 0 ? (
          <div className="p-12 text-center text-sm text-slate-500">
            No applications available for download.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase text-slate-500 border-b border-slate-200">
                <tr>
                  <th className="px-4 py-3.5 w-10">
                    <button
                      type="button"
                      onClick={toggleAll}
                      className="text-slate-600 hover:text-slate-900 cursor-pointer"
                      aria-label="Select all"
                    >
                      {selectedIds.length === applications.length ? (
                        <CheckSquare className="w-4 h-4 text-emerald-700" />
                      ) : (
                        <Square className="w-4 h-4" />
                      )}
                    </button>
                  </th>
                  <th className="px-4 py-3.5">Applicant</th>
                  <th className="px-4 py-3.5">BS ID</th>
                  <th className="px-4 py-3.5">Status</th>
                  <th className="px-4 py-3.5">Card Status</th>
                  <th className="px-5 py-3.5 text-right">Downloads</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {applications.map((app) => {
                  const checked = selectedIds.includes(app.id);
                  return (
                    <tr key={app.id} className="hover:bg-slate-50/70">
                      <td className="px-4 py-3.5">
                        <button
                          type="button"
                          onClick={() => toggleOne(app.id)}
                          className="text-slate-600 hover:text-slate-900 cursor-pointer"
                        >
                          {checked ? (
                            <CheckSquare className="w-4 h-4 text-emerald-700" />
                          ) : (
                            <Square className="w-4 h-4" />
                          )}
                        </button>
                      </td>
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-3">
                          <img
                            src={app.photograph_url}
                            alt={app.full_name}
                            className="w-9 h-11 rounded-lg object-cover border border-slate-200"
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
                        <StatusBadge status={app.application_status} />
                      </td>
                      <td className="px-4 py-3.5 text-xs">
                        {app.generated_card_front_url ? (
                          <span className="text-emerald-700 font-semibold">
                            Generated &amp; Ready
                          </span>
                        ) : (
                          <span className="text-slate-500">
                            Will generate on download
                          </span>
                        )}
                      </td>
                      <td className="px-5 py-3.5 text-right">
                        <div className="inline-flex items-center gap-1.5">
                          <a
                            href={`/api/admin/applications/${app.id}/download?format=front_png`}
                            className="inline-flex items-center gap-1 rounded-lg bg-slate-900 hover:bg-slate-800 text-white px-2.5 py-1.5 text-xs font-semibold"
                          >
                            <Download className="w-3.5 h-3.5" />
                            PNG
                          </a>
                          <a
                            href={`/api/admin/applications/${app.id}/download?format=back_png`}
                            className="inline-flex items-center gap-1 rounded-lg bg-slate-700 hover:bg-slate-600 text-white px-2.5 py-1.5 text-xs font-semibold"
                          >
                            <Download className="w-3.5 h-3.5" />
                            Back
                          </a>
                          <a
                            href={`/api/admin/applications/${app.id}/download?format=pdf`}
                            className="inline-flex items-center gap-1 rounded-lg bg-[#8f007c] hover:bg-[#750066] text-white px-2.5 py-1.5 text-xs font-semibold"
                          >
                            <Download className="w-3.5 h-3.5" />
                            PDF
                          </a>
                          <button
                            type="button"
                            onClick={async () => {
                              let current = app;
                              if (
                                !current.generated_card_front_url ||
                                !current.generated_card_back_url
                              ) {
                                const res = await fetch(
                                  `/api/admin/applications/${app.id}/generate`,
                                  { method: "POST" }
                                );
                                const d = await res.json();
                                if (res.ok && d.application) {
                                  current = d.application;
                                  setApplications((prev) =>
                                    prev.map((x) =>
                                      x.id === current.id ? current : x
                                    )
                                  );
                                }
                              }
                              if (
                                current.generated_card_front_url &&
                                current.generated_card_back_url
                              ) {
                                printGeneratedIdCard({
                                  frontUrl: current.generated_card_front_url,
                                  backUrl: current.generated_card_back_url,
                                  bsId: current.bs_id,
                                  fullName: current.full_name,
                                });
                              }
                            }}
                            className="inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 px-2.5 py-1.5 text-xs font-semibold cursor-pointer"
                          >
                            <Printer className="w-3.5 h-3.5" />
                            Print
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
