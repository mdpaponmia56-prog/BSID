"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  Download,
  FileArchive,
  History,
  Loader2,
  Printer,
  RefreshCw,
  Save,
  Sparkles,
  Trash2,
  Upload,
  XCircle,
} from "lucide-react";
import {
  ApplicationRecord,
  ApplicationStatus,
  AuditLogRecord,
  BLOOD_GROUPS,
  BloodGroup,
  IdCardTemplateRecord,
} from "@/lib/types";
import LiveIdCardPreview from "@/components/LiveIdCardPreview";
import StatusBadge from "@/components/StatusBadge";
import { printGeneratedIdCard } from "@/lib/print-card";

export default function AdminApplicationDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const id = params.id;

  const [application, setApplication] = useState<ApplicationRecord | null>(null);
  const [template, setTemplate] = useState<IdCardTemplateRecord | null>(null);
  const [auditLogs, setAuditLogs] = useState<AuditLogRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Editable state
  const [fullName, setFullName] = useState("");
  const [bsId, setBsId] = useState("");
  const [bloodGroup, setBloodGroup] = useState<BloodGroup>("O+");
  const [fatherName, setFatherName] = useState("");
  const [motherName, setMotherName] = useState("");
  const [contactNumber, setContactNumber] = useState("");
  const [email, setEmail] = useState("");
  const [presentAddress, setPresentAddress] = useState("");
  const [status, setStatus] = useState<ApplicationStatus>("Pending");
  const [rejectionReason, setRejectionReason] = useState("");

  const [newPhotoFile, setNewPhotoFile] = useState<File | null>(null);
  const [newPhotoPreview, setNewPhotoPreview] = useState<string | null>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);

  const [saving, setSaving] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [previewMode, setPreviewMode] = useState<"live" | "generated">("live");
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/applications/${id}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load application.");
      const app: ApplicationRecord = data.application;
      setApplication(app);
      setTemplate(data.activeTemplate);
      setAuditLogs(data.auditLogs || []);

      setFullName(app.full_name);
      setBsId(app.bs_id);
      setBloodGroup(app.blood_group);
      setFatherName(app.father_name);
      setMotherName(app.mother_name);
      setContactNumber(app.contact_number);
      setEmail(app.email);
      setPresentAddress(app.present_address);
      setStatus(app.application_status);
      setRejectionReason(app.rejection_reason || "");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error loading record.");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    return () => {
      if (newPhotoPreview) URL.revokeObjectURL(newPhotoPreview);
    };
  }, [newPhotoPreview]);

  function handleSelectPhoto(file: File | undefined) {
    if (!file) return;
    if (newPhotoPreview) URL.revokeObjectURL(newPhotoPreview);
    setNewPhotoFile(file);
    setNewPhotoPreview(URL.createObjectURL(file));
  }

  async function saveChanges(options?: {
    nextStatus?: ApplicationStatus;
    nextRejectionReason?: string;
    regenerate?: boolean;
  }) {
    if (!application) return;
    setSaving(true);
    setError(null);
    setNotice(null);

    try {
      const fd = new FormData();
      fd.append("full_name", fullName.trim());
      fd.append("bs_id", bsId.trim().toUpperCase());
      fd.append("blood_group", bloodGroup);
      fd.append("father_name", fatherName.trim());
      fd.append("mother_name", motherName.trim());
      fd.append("contact_number", contactNumber.trim());
      fd.append("email", email.trim());
      fd.append("present_address", presentAddress.trim());
      fd.append("application_status", options?.nextStatus ?? status);
      if (
        (options?.nextStatus ?? status) === "Rejected" &&
        (options?.nextRejectionReason ?? rejectionReason)
      ) {
        fd.append(
          "rejection_reason",
          options?.nextRejectionReason ?? rejectionReason
        );
      }
      if (newPhotoFile) {
        fd.append("photograph", newPhotoFile);
      }
      if (options?.regenerate) {
        fd.append("regenerate_card", "true");
      }

      const res = await fetch(`/api/admin/applications/${application.id}`, {
        method: "PATCH",
        body: fd,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to save changes.");

      setApplication(data.application);
      setAuditLogs(data.auditLogs || []);
      setStatus(data.application.application_status);
      setRejectionReason(data.application.rejection_reason || "");
      setNewPhotoFile(null);
      if (newPhotoPreview) {
        URL.revokeObjectURL(newPhotoPreview);
        setNewPhotoPreview(null);
      }
      setNotice(
        options?.regenerate
          ? "Changes saved and ID card generated successfully."
          : "Changes saved to database."
      );
      if (options?.regenerate) {
        setPreviewMode("generated");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed.");
    } finally {
      setSaving(false);
    }
  }

  async function handleGenerateOnly() {
    if (!application) return;
    setGenerating(true);
    setError(null);
    setNotice(null);
    try {
      await saveChanges({ regenerate: true });
    } finally {
      setGenerating(false);
    }
  }

  async function handleDelete() {
    if (!application) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/admin/applications/${application.id}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error || "Delete failed.");
      }
      router.push("/admin/applications");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Delete failed.");
      setDeleting(false);
      setShowDeleteModal(false);
    }
  }

  if (loading) {
    return (
      <div className="p-16 flex items-center justify-center gap-2 text-slate-500">
        <Loader2 className="w-6 h-6 animate-spin" />
        <span>Loading application editor...</span>
      </div>
    );
  }

  if (!application || !template) {
    return (
      <div className="bg-white rounded-2xl border border-red-200 p-8 text-center">
        <p className="text-red-700 font-semibold mb-3">
          {error || "Application not found."}
        </p>
        <Link
          href="/admin/applications"
          className="text-sm font-semibold text-emerald-700 hover:underline"
        >
          ← Back to Applications
        </Link>
      </div>
    );
  }

  const activePhotoUrl = newPhotoPreview || application.photograph_url;

  return (
    <div className="space-y-6">
      {/* Top Action Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link
            href="/admin/applications"
            className="p-2 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-700"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="text-xl font-bold text-slate-900">
                {application.full_name}
              </h1>
              <StatusBadge status={status} />
            </div>
            <p className="text-xs text-slate-500 font-mono mt-0.5">
              Ref: {application.application_reference} • Submitted{" "}
              {new Date(application.submission_date).toLocaleString()}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {status !== "Approved" && (
            <button
              type="button"
              disabled={saving}
              onClick={() =>
                saveChanges({ nextStatus: "Approved", regenerate: true })
              }
              className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 text-xs font-semibold cursor-pointer disabled:opacity-50"
            >
              <CheckCircle2 className="w-4 h-4" />
              Approve &amp; Generate Card
            </button>
          )}
          <button
            type="button"
            disabled={saving}
            onClick={() => setShowRejectModal(true)}
            className="inline-flex items-center gap-1.5 rounded-xl border border-amber-300 bg-amber-50 hover:bg-amber-100 text-amber-900 px-4 py-2 text-xs font-semibold cursor-pointer"
          >
            <XCircle className="w-4 h-4" />
            Reject
          </button>
          <button
            type="button"
            onClick={() => setShowDeleteModal(true)}
            className="inline-flex items-center gap-1.5 rounded-xl border border-red-200 bg-red-50 hover:bg-red-100 text-red-700 px-3.5 py-2 text-xs font-semibold cursor-pointer"
          >
            <Trash2 className="w-4 h-4" />
            Delete
          </button>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2.5 rounded-xl bg-red-50 border border-red-200 p-4 text-sm text-red-800">
          <AlertCircle className="w-5 h-5 shrink-0 text-red-600" />
          <span>{error}</span>
        </div>
      )}
      {notice && (
        <div className="flex items-center gap-2.5 rounded-xl bg-emerald-50 border border-emerald-200 p-4 text-sm text-emerald-800">
          <CheckCircle2 className="w-5 h-5 shrink-0 text-emerald-600" />
          <span>{notice}</span>
        </div>
      )}
      {status === "Rejected" && rejectionReason && (
        <div className="rounded-xl bg-red-50 border border-red-200 p-4 text-sm text-red-800">
          <strong>Rejection Reason:</strong> {rejectionReason}
        </div>
      )}

      {/* Split-Screen Editor: LEFT = Editable Fields, RIGHT = Live ID Card Preview */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
        {/* LEFT SIDE: Applicant Information & Editable Fields */}
        <div className="xl:col-span-5 space-y-6">
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-5">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h2 className="text-base font-bold text-slate-900">
                Applicant Information
              </h2>
              <span className="text-xs text-slate-500">
                Edits update preview live
              </span>
            </div>

            {/* Uploaded Photograph + Replace */}
            <div className="flex items-center gap-4 p-3.5 rounded-xl bg-slate-50 border border-slate-200">
              <img
                src={activePhotoUrl}
                alt={fullName}
                className="w-20 h-24 rounded-xl object-cover border border-slate-300 bg-white shrink-0"
              />
              <div className="space-y-2">
                <p className="text-xs font-semibold text-slate-700">
                  Applicant Photograph
                </p>
                <input
                  ref={photoInputRef}
                  type="file"
                  accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp"
                  className="hidden"
                  onChange={(e) => handleSelectPhoto(e.target.files?.[0])}
                />
                <button
                  type="button"
                  onClick={() => photoInputRef.current?.click()}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-700 cursor-pointer"
                >
                  <Upload className="w-3.5 h-3.5" />
                  Replace Photograph
                </button>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Full Name
                </label>
                <input
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 px-3.5 py-2 text-sm focus:border-emerald-600 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    BS ID
                  </label>
                  <input
                    type="text"
                    value={bsId}
                    onChange={(e) => setBsId(e.target.value.toUpperCase())}
                    className="w-full rounded-xl border border-slate-300 px-3.5 py-2 text-sm uppercase focus:border-emerald-600 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Blood Group
                  </label>
                  <select
                    value={bloodGroup}
                    onChange={(e) =>
                      setBloodGroup(e.target.value as BloodGroup)
                    }
                    className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-sm focus:border-emerald-600 focus:outline-none"
                  >
                    {BLOOD_GROUPS.map((bg) => (
                      <option key={bg} value={bg}>
                        {bg}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Father&apos;s Name
                  </label>
                  <input
                    type="text"
                    value={fatherName}
                    onChange={(e) => setFatherName(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 px-3.5 py-2 text-sm focus:border-emerald-600 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Mother&apos;s Name
                  </label>
                  <input
                    type="text"
                    value={motherName}
                    onChange={(e) => setMotherName(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 px-3.5 py-2 text-sm focus:border-emerald-600 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Contact Number
                  </label>
                  <input
                    type="tel"
                    value={contactNumber}
                    onChange={(e) => setContactNumber(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 px-3.5 py-2 text-sm focus:border-emerald-600 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Email Address
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 px-3.5 py-2 text-sm focus:border-emerald-600 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Present Address
                </label>
                <textarea
                  rows={3}
                  value={presentAddress}
                  onChange={(e) => setPresentAddress(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 px-3.5 py-2 text-sm focus:border-emerald-600 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Application Status
                </label>
                <select
                  value={status}
                  onChange={(e) =>
                    setStatus(e.target.value as ApplicationStatus)
                  }
                  className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-sm focus:border-emerald-600 focus:outline-none"
                >
                  <option value="Pending">Pending</option>
                  <option value="Approved">Approved</option>
                  <option value="Rejected">Rejected</option>
                </select>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-slate-100">
              <button
                type="button"
                disabled={saving}
                onClick={() => saveChanges({ regenerate: false })}
                className="inline-flex items-center gap-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white px-4 py-2.5 text-sm font-semibold cursor-pointer disabled:opacity-50"
              >
                {saving ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Save className="w-4 h-4" />
                )}
                Save Changes
              </button>

              <button
                type="button"
                disabled={saving || generating}
                onClick={handleGenerateOnly}
                className="inline-flex items-center gap-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white px-4 py-2.5 text-sm font-semibold cursor-pointer disabled:opacity-50"
              >
                {generating ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <RefreshCw className="w-4 h-4" />
                )}
                Save &amp; Regenerate ID Card
              </button>
            </div>
          </div>

          {/* Audit Log History */}
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-4">
            <div className="flex items-center gap-2">
              <History className="w-4 h-4 text-slate-600" />
              <h3 className="text-sm font-bold text-slate-900">
                Audit Log &amp; Change History
              </h3>
            </div>
            {auditLogs.length === 0 ? (
              <p className="text-xs text-slate-500">
                No administrator modifications recorded yet.
              </p>
            ) : (
              <div className="space-y-3 max-h-64 overflow-y-auto pr-1">
                {auditLogs.map((log) => (
                  <div
                    key={log.id}
                    className="rounded-xl bg-slate-50 border border-slate-200 p-3 text-xs space-y-1"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-bold text-slate-800">
                        {log.action_type}
                      </span>
                      <span className="text-slate-500">
                        {new Date(log.timestamp).toLocaleString()}
                      </span>
                    </div>
                    <p className="text-slate-600">
                      By: {log.administrator_email}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* RIGHT SIDE: Live ID Card Preview & Downloads */}
        <div className="xl:col-span-7 space-y-6">
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-slate-100 pb-4">
              <div>
                <h2 className="text-base font-bold text-slate-900">
                  ID Card Preview &amp; Export
                </h2>
                <p className="text-xs text-slate-500">
                  Original fixed Canva design ({template.card_width}×
                  {template.card_height} aspect ratio)
                </p>
              </div>

              <div className="inline-flex rounded-xl bg-slate-100 p-1">
                <button
                  type="button"
                  onClick={() => setPreviewMode("live")}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer ${
                    previewMode === "live"
                      ? "bg-white text-slate-900 shadow-xs"
                      : "text-slate-600"
                  }`}
                >
                  Live Preview
                </button>
                <button
                  type="button"
                  disabled={!application.generated_card_front_url}
                  onClick={() => setPreviewMode("generated")}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer disabled:opacity-40 ${
                    previewMode === "generated"
                      ? "bg-white text-slate-900 shadow-xs"
                      : "text-slate-600"
                  }`}
                >
                  Generated High-Res Files
                </button>
              </div>
            </div>

            {previewMode === "live" ? (
              <LiveIdCardPreview
                data={{
                  full_name: fullName,
                  bs_id: bsId,
                  blood_group: bloodGroup,
                  father_name: fatherName,
                  mother_name: motherName,
                  contact_number: contactNumber,
                  email,
                  present_address: presentAddress,
                  photograph_url: activePhotoUrl,
                }}
                template={template}
                displayWidth={265}
              />
            ) : (
              <div className="flex flex-wrap items-start justify-center gap-6">
                {application.generated_card_front_url && (
                  <div className="flex flex-col items-center">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-2">
                      Generated Front PNG
                    </span>
                    <img
                      src={`${application.generated_card_front_url}?v=${encodeURIComponent(
                        application.updated_date
                      )}`}
                      alt="Generated Front ID Card"
                      className="w-[265px] rounded-xl shadow-md border border-slate-300"
                    />
                  </div>
                )}
                {application.generated_card_back_url && (
                  <div className="flex flex-col items-center">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-2">
                      Generated Back PNG
                    </span>
                    <img
                      src={`${application.generated_card_back_url}?v=${encodeURIComponent(
                        application.updated_date
                      )}`}
                      alt="Generated Back ID Card"
                      className="w-[265px] rounded-xl shadow-md border border-slate-300"
                    />
                  </div>
                )}
              </div>
            )}

            {/* Download & Print Controls */}
            <div className="pt-4 border-t border-slate-100 space-y-3">
              <div className="flex flex-wrap items-center gap-2.5">
                <a
                  href={`/api/admin/applications/${application.id}/download?format=front_png`}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white px-4 py-2.5 text-xs font-semibold"
                >
                  <Download className="w-4 h-4" />
                  Download Front PNG
                </a>
                <a
                  href={`/api/admin/applications/${application.id}/download?format=back_png`}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white px-4 py-2.5 text-xs font-semibold"
                >
                  <Download className="w-4 h-4" />
                  Download Back PNG
                </a>
                <a
                  href={`/api/admin/applications/${application.id}/download?format=pdf`}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-[#8f007c] hover:bg-[#750066] text-white px-4 py-2.5 text-xs font-semibold"
                >
                  <Download className="w-4 h-4" />
                  Download Print-Ready PDF
                </a>
                <a
                  href={`/api/admin/applications/${application.id}/download?format=zip`}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-800 px-4 py-2.5 text-xs font-semibold"
                >
                  <FileArchive className="w-4 h-4" />
                  ZIP Bundle
                </a>
                <button
                  type="button"
                  onClick={async () => {
                    let currentApp = application;
                    if (
                      !currentApp.generated_card_front_url ||
                      !currentApp.generated_card_back_url
                    ) {
                      const res = await fetch(
                        `/api/admin/applications/${application.id}/generate`,
                        { method: "POST" }
                      );
                      const d = await res.json();
                      if (res.ok && d.application) {
                        currentApp = d.application;
                        setApplication(d.application);
                      }
                    }
                    if (
                      currentApp.generated_card_front_url &&
                      currentApp.generated_card_back_url
                    ) {
                      printGeneratedIdCard({
                        frontUrl: currentApp.generated_card_front_url,
                        backUrl: currentApp.generated_card_back_url,
                        bsId: currentApp.bs_id,
                        fullName: currentApp.full_name,
                      });
                    }
                  }}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-600 text-emerald-700 hover:bg-emerald-50 px-4 py-2.5 text-xs font-semibold cursor-pointer"
                >
                  <Printer className="w-4 h-4" />
                  Print ID Card
                </button>
              </div>
              {!application.generated_card_front_url && (
                <p className="text-xs text-amber-700 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5" />
                  Card has not been generated yet. Clicking any download button
                  or &quot;Approve &amp; Generate Card&quot; will render the
                  high-resolution files automatically.
                </p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Reject Reason Modal */}
      {showRejectModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-slate-200 space-y-4">
            <h3 className="text-lg font-bold text-slate-900">
              Reject Application
            </h3>
            <p className="text-xs text-slate-600">
              Provide a reason for rejecting{" "}
              <strong>{application.full_name}</strong> ({application.bs_id}):
            </p>
            <textarea
              rows={3}
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              placeholder="e.g. Photograph is unclear / Invalid BS ID..."
              className="w-full rounded-xl border border-slate-300 px-3.5 py-2 text-sm focus:border-red-500 focus:outline-none"
            />
            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setShowRejectModal(false)}
                className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={async () => {
                  await saveChanges({
                    nextStatus: "Rejected",
                    nextRejectionReason: rejectionReason,
                    regenerate: false,
                  });
                  setShowRejectModal(false);
                }}
                className="rounded-xl bg-red-600 hover:bg-red-700 text-white px-4 py-2 text-sm font-semibold cursor-pointer"
              >
                Confirm Rejection
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-slate-200 space-y-4">
            <h3 className="text-lg font-bold text-slate-900">
              Confirm Permanent Deletion
            </h3>
            <p className="text-sm text-slate-600">
              Permanently delete <strong>{application.full_name}</strong> (
              {application.bs_id}) and all associated stored files?
            </p>
            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setShowDeleteModal(false)}
                className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={deleting}
                onClick={handleDelete}
                className="inline-flex items-center gap-2 rounded-xl bg-red-600 hover:bg-red-700 text-white px-4 py-2 text-sm font-semibold cursor-pointer"
              >
                {deleting && <Loader2 className="w-4 h-4 animate-spin" />}
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
