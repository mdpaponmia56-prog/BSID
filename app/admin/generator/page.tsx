"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import {
  CheckCircle2,
  Download,
  IdCard,
  Loader2,
  Printer,
  RefreshCw,
  Search,
  Sparkles,
} from "lucide-react";
import { ApplicationRecord, IdCardTemplateRecord } from "@/lib/types";
import LiveIdCardPreview from "@/components/LiveIdCardPreview";
import StatusBadge from "@/components/StatusBadge";
import { printGeneratedIdCard } from "@/lib/print-card";

export default function AdminGeneratorPage() {
  const [applications, setApplications] = useState<ApplicationRecord[]>([]);
  const [template, setTemplate] = useState<IdCardTemplateRecord | null>(null);
  const [selectedId, setSelectedId] = useState<string>("");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function loadAll() {
    setLoading(true);
    try {
      const [appsRes, tplRes] = await Promise.all([
        fetch("/api/admin/applications?sort=newest"),
        fetch("/api/admin/templates"),
      ]);
      const appsData = await appsRes.json();
      const tplData = await tplRes.json();
      const list: ApplicationRecord[] = appsData.applications || [];
      setApplications(list);
      setTemplate(tplData.template || null);
      if (list.length > 0 && !selectedId) {
        setSelectedId(list[0].id);
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAll();
  }, []);

  const filtered = applications.filter((a) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return (
      a.full_name.toLowerCase().includes(q) ||
      a.bs_id.toLowerCase().includes(q) ||
      a.application_reference.toLowerCase().includes(q)
    );
  });

  const selected = applications.find((a) => a.id === selectedId) || null;

  async function handleGenerate(app: ApplicationRecord) {
    setGenerating(true);
    setMessage(null);
    try {
      const res = await fetch(`/api/admin/applications/${app.id}/generate`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Generation failed.");
      setApplications((prev) =>
        prev.map((item) => (item.id === app.id ? data.application : item))
      );
      setMessage(
        `High-resolution Front PNG, Back PNG, and Print-Ready PDF generated for ${app.bs_id}.`
      );
    } catch (err) {
      alert(err instanceof Error ? err.message : "Generation failed.");
    } finally {
      setGenerating(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">ID Card Generator</h1>
        <p className="text-sm text-slate-500 mt-1">
          Select any applicant to generate, preview, print, or export high-res
          PNG and PDF cards using your fixed Canva design.
        </p>
      </div>

      {loading ? (
        <div className="p-12 flex items-center justify-center gap-2 text-slate-500">
          <Loader2 className="w-5 h-5 animate-spin" />
          <span>Loading generator...</span>
        </div>
      ) : applications.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-10 text-center text-sm text-slate-500">
          No applications available yet.
        </div>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
          {/* Left Applicant Selector */}
          <div className="xl:col-span-4 bg-white rounded-2xl border border-slate-200 p-4 shadow-xs space-y-3">
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="Filter applicants..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full rounded-xl border border-slate-300 pl-9 pr-3 py-2 text-sm focus:border-emerald-600 focus:outline-none"
              />
            </div>

            <div className="divide-y divide-slate-100 max-h-[540px] overflow-y-auto">
              {filtered.map((app) => (
                <button
                  key={app.id}
                  type="button"
                  onClick={() => {
                    setSelectedId(app.id);
                    setMessage(null);
                  }}
                  className={`w-full text-left p-3 rounded-xl flex items-center gap-3 transition cursor-pointer ${
                    app.id === selectedId
                      ? "bg-emerald-50 border border-emerald-200"
                      : "hover:bg-slate-50"
                  }`}
                >
                  <img
                    src={app.photograph_url}
                    alt={app.full_name}
                    className="w-10 h-12 rounded-lg object-cover border border-slate-200 shrink-0"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-slate-900 truncate">
                      {app.full_name}
                    </p>
                    <p className="text-xs text-slate-500">
                      {app.bs_id} • {app.blood_group}
                    </p>
                  </div>
                  <StatusBadge status={app.application_status} />
                </button>
              ))}
            </div>
          </div>

          {/* Right Generator Workspace */}
          <div className="xl:col-span-8 bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-5">
            {selected && template ? (
              <>
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-slate-100 pb-4">
                  <div className="flex items-center gap-3">
                    <IdCard className="w-5 h-5 text-emerald-700" />
                    <div>
                      <h2 className="text-base font-bold text-slate-900">
                        {selected.full_name} ({selected.bs_id})
                      </h2>
                      <p className="text-xs text-slate-500">
                        {selected.generated_card_front_url
                          ? "Generated files ready for export"
                          : "Ready to generate high-resolution ID card"}
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      disabled={generating}
                      onClick={() => handleGenerate(selected)}
                      className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white px-4 py-2 text-xs font-semibold cursor-pointer disabled:opacity-50"
                    >
                      {generating ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : selected.generated_card_front_url ? (
                        <RefreshCw className="w-4 h-4" />
                      ) : (
                        <Sparkles className="w-4 h-4" />
                      )}
                      {selected.generated_card_front_url
                        ? "Regenerate Card"
                        : "Generate ID Card"}
                    </button>
                    <Link
                      href={`/admin/applications/${selected.id}`}
                      className="rounded-xl border border-slate-300 bg-white hover:bg-slate-50 px-3.5 py-2 text-xs font-semibold text-slate-700"
                    >
                      Edit Fields
                    </Link>
                  </div>
                </div>

                {message && (
                  <div className="flex items-center gap-2 rounded-xl bg-emerald-50 border border-emerald-200 p-3 text-xs font-medium text-emerald-800">
                    <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
                    <span>{message}</span>
                  </div>
                )}

                <LiveIdCardPreview
                  data={selected}
                  template={template}
                  displayWidth={260}
                />

                <div className="pt-4 border-t border-slate-100 flex flex-wrap items-center gap-2.5">
                  <a
                    href={`/api/admin/applications/${selected.id}/download?format=front_png`}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white px-4 py-2 text-xs font-semibold"
                  >
                    <Download className="w-4 h-4" />
                    Front PNG
                  </a>
                  <a
                    href={`/api/admin/applications/${selected.id}/download?format=back_png`}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white px-4 py-2 text-xs font-semibold"
                  >
                    <Download className="w-4 h-4" />
                    Back PNG
                  </a>
                  <a
                    href={`/api/admin/applications/${selected.id}/download?format=pdf`}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-[#8f007c] hover:bg-[#750066] text-white px-4 py-2 text-xs font-semibold"
                  >
                    <Download className="w-4 h-4" />
                    Print-Ready PDF
                  </a>
                  <button
                    type="button"
                    onClick={async () => {
                      let current = selected;
                      if (
                        !current.generated_card_front_url ||
                        !current.generated_card_back_url
                      ) {
                        const res = await fetch(
                          `/api/admin/applications/${selected.id}/generate`,
                          { method: "POST" }
                        );
                        const d = await res.json();
                        if (res.ok && d.application) {
                          current = d.application;
                          setApplications((prev) =>
                            prev.map((item) =>
                              item.id === current.id ? current : item
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
                    className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-600 text-emerald-700 hover:bg-emerald-50 px-4 py-2 text-xs font-semibold cursor-pointer"
                  >
                    <Printer className="w-4 h-4" />
                    Print ID Card
                  </button>
                </div>
              </>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}
