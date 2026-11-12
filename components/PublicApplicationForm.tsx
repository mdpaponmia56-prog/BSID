"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertCircle,
  ArrowRight,
  Camera,
  Check,
  CheckCircle2,
  ChevronDown,
  Copy,
  Eye,
  FileImage,
  FileText,
  IdCard,
  Image as ImageIcon,
  Loader2,
  Maximize2,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Upload,
  User,
  X,
} from "lucide-react";
import {
  BLOOD_GROUPS,
  BloodGroup,
  DEFAULT_CARD_TEMPLATE,
  IdCardTemplateRecord,
} from "@/lib/types";
import LiveIdCardPreview from "@/components/LiveIdCardPreview";

interface FormState {
  full_name: string;
  bs_id: string;
  blood_group: BloodGroup | "";
  father_name: string;
  mother_name: string;
  contact_number: string;
  email: string;
  present_address: string;
}

interface FieldErrors {
  full_name?: string;
  bs_id?: string;
  blood_group?: string;
  photograph?: string;
  father_name?: string;
  mother_name?: string;
  contact_number?: string;
  email?: string;
  present_address?: string;
}

const INITIAL_FORM: FormState = {
  full_name: "",
  bs_id: "",
  blood_group: "",
  father_name: "",
  mother_name: "",
  contact_number: "",
  email: "",
  present_address: "",
};

const MAX_SIZE_BYTES = 5 * 1024 * 1024;
const ACCEPTED_TYPES = ["image/jpeg", "image/jpg", "image/png", "image/webp"];

export default function PublicApplicationForm() {
  const [form, setForm] = useState<FormState>(INITIAL_FORM);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreviewUrl, setPhotoPreviewUrl] = useState<string | null>(null);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [duplicateStatus, setDuplicateStatus] = useState<
    "idle" | "checking" | "duplicate" | "available"
  >("idle");
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submittedRef, setSubmittedRef] = useState<string | null>(null);
  const [previewTemplate, setPreviewTemplate] =
    useState<IdCardTemplateRecord>(DEFAULT_CARD_TEMPLATE);
  const [previewSide, setPreviewSide] = useState<"both" | "front" | "back">(
    "both"
  );
  const [mobileTab, setMobileTab] = useState<"form" | "preview">("form");
  const [zoomScale, setZoomScale] = useState<"fit" | "normal" | "full">("fit");
  const [showElementsBreakdown, setShowElementsBreakdown] = useState(false);
  const [copiedRef, setCopiedRef] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const completedCount = useMemo(() => {
    let count = 0;
    if (form.full_name.trim().length >= 2) count++;
    if (form.bs_id.trim().length >= 2 && duplicateStatus !== "duplicate") count++;
    if (form.blood_group) count++;
    if (photoFile) count++;
    if (form.father_name.trim().length >= 2) count++;
    if (form.mother_name.trim().length >= 2) count++;
    if (form.contact_number.trim().length >= 6) count++;
    if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) count++;
    if (form.present_address.trim().length >= 5) count++;
    return count;
  }, [form, duplicateStatus, photoFile]);

  const progressPct = Math.round((completedCount / 9) * 100);

  useEffect(() => {
    fetch("/api/template-preview")
      .then((r) => (r.ok ? r.json() : null))
      .then((tpl) => {
        if (tpl && tpl.card_width) setPreviewTemplate(tpl);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    return () => {
      if (photoPreviewUrl) {
        URL.revokeObjectURL(photoPreviewUrl);
      }
    };
  }, [photoPreviewUrl]);

  // Live duplicate BS ID validation
  useEffect(() => {
    const trimmed = form.bs_id.trim();
    if (trimmed.length < 2) {
      setDuplicateStatus("idle");
      return;
    }

    const timer = setTimeout(async () => {
      setDuplicateStatus("checking");
      try {
        const res = await fetch(
          `/api/applications/check-bs-id?bs_id=${encodeURIComponent(trimmed)}`
        );
        if (!res.ok) {
          setDuplicateStatus("idle");
          return;
        }
        const data = (await res.json()) as { exists: boolean };
        setDuplicateStatus(data.exists ? "duplicate" : "available");
        if (data.exists) {
          setErrors((prev) => ({
            ...prev,
            bs_id: `BS ID "${trimmed.toUpperCase()}" is already registered.`,
          }));
        } else {
          setErrors((prev) => {
            if (prev.bs_id?.includes("already registered")) {
              const next = { ...prev };
              delete next.bs_id;
              return next;
            }
            return prev;
          });
        }
      } catch {
        setDuplicateStatus("idle");
      }
    }, 450);

    return () => clearTimeout(timer);
  }, [form.bs_id]);

  function handleFieldChange<K extends keyof FormState>(
    key: K,
    value: FormState[K]
  ) {
    setForm((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => {
      if (!prev[key]) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });
    setSubmitError(null);
  }

  function handlePhotoSelected(file: File | undefined | null) {
    if (!file) return;

    const lowerType = file.type.toLowerCase();
    const validExt = /\.(jpe?g|png|webp)$/i.test(file.name);
    if (!ACCEPTED_TYPES.includes(lowerType) && !validExt) {
      setErrors((prev) => ({
        ...prev,
        photograph:
          "Invalid image format. Please select a JPG, JPEG, PNG, or WEBP photograph.",
      }));
      return;
    }

    if (file.size === 0) {
      setErrors((prev) => ({
        ...prev,
        photograph: "The selected file is empty.",
      }));
      return;
    }

    if (file.size > MAX_SIZE_BYTES) {
      setErrors((prev) => ({
        ...prev,
        photograph: "Photograph size must not exceed 5 MB.",
      }));
      return;
    }

    if (photoPreviewUrl) {
      URL.revokeObjectURL(photoPreviewUrl);
    }
    const url = URL.createObjectURL(file);
    setPhotoFile(file);
    setPhotoPreviewUrl(url);
    setErrors((prev) => {
      const next = { ...prev };
      delete next.photograph;
      return next;
    });
    setSubmitError(null);
  }

  function validateForm(): boolean {
    const nextErrors: FieldErrors = {};

    if (form.full_name.trim().length < 2) {
      nextErrors.full_name = "Full Name is required (at least 2 characters).";
    }
    if (form.bs_id.trim().length < 2) {
      nextErrors.bs_id = "BS ID is required.";
    } else if (!/^[A-Za-z0-9\-_/]+$/.test(form.bs_id.trim())) {
      nextErrors.bs_id =
        "BS ID may contain only letters, numbers, hyphens, underscores, or slashes.";
    } else if (duplicateStatus === "duplicate") {
      nextErrors.bs_id = `BS ID "${form.bs_id.trim().toUpperCase()}" is already registered.`;
    }
    if (!form.blood_group) {
      nextErrors.blood_group = "Please select your Blood Group.";
    }
    if (!photoFile) {
      nextErrors.photograph = "Personal Photograph is required.";
    }
    if (form.father_name.trim().length < 2) {
      nextErrors.father_name = "Father's Name is required.";
    }
    if (form.mother_name.trim().length < 2) {
      nextErrors.mother_name = "Mother's Name is required.";
    }
    if (form.contact_number.trim().length < 6) {
      nextErrors.contact_number = "Valid Contact Number is required.";
    } else if (!/^[+0-9\s\-()]+$/.test(form.contact_number.trim())) {
      nextErrors.contact_number = "Please enter a valid Contact Number.";
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) {
      nextErrors.email = "Please enter a valid Email Address.";
    }
    if (form.present_address.trim().length < 5) {
      nextErrors.present_address =
        "Present Address is required (at least 5 characters).";
    }

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  }

  function handlePreSubmit(e?: React.FormEvent) {
    if (e) e.preventDefault();
    if (submitting) return;
    setSubmitError(null);
    if (!validateForm()) {
      setMobileTab("form");
      if (typeof window !== "undefined") {
        window.scrollTo({ top: 0, behavior: "smooth" });
      }
      return;
    }
    setShowConfirmModal(true);
  }

  async function handleConfirmedSubmit() {
    if (submitting || !photoFile) return;
    setSubmitting(true);
    setUploadProgress(5);
    setSubmitError(null);

    try {
      const fd = new FormData();
      fd.append("full_name", form.full_name.trim());
      fd.append("bs_id", form.bs_id.trim().toUpperCase());
      fd.append("blood_group", form.blood_group);
      fd.append("photograph", photoFile);
      fd.append("father_name", form.father_name.trim());
      fd.append("mother_name", form.mother_name.trim());
      fd.append("contact_number", form.contact_number.trim());
      fd.append("email", form.email.trim());
      fd.append("present_address", form.present_address.trim());

      const responseData = await new Promise<{
        success?: boolean;
        application_reference?: string;
        error?: string;
      }>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open("POST", "/api/applications");

        xhr.upload.onprogress = (event) => {
          if (event.lengthComputable) {
            const pct = Math.min(92, Math.round((event.loaded / event.total) * 90));
            setUploadProgress(Math.max(10, pct));
          }
        };

        xhr.onload = () => {
          setUploadProgress(100);
          try {
            const parsed = JSON.parse(xhr.responseText);
            if (xhr.status >= 200 && xhr.status < 300) {
              resolve(parsed);
            } else {
              reject(new Error(parsed.error || "Submission failed."));
            }
          } catch {
            reject(new Error("Unexpected server response."));
          }
        };

        xhr.onerror = () => {
          reject(new Error("Network error while submitting application."));
        };

        xhr.send(fd);
      });

      setShowConfirmModal(false);
      setSubmittedRef(responseData.application_reference || "BS-SUBMITTED");
    } catch (err) {
      setShowConfirmModal(false);
      setSubmitError(
        err instanceof Error ? err.message : "Failed to submit application."
      );
    } finally {
      setSubmitting(false);
    }
  }

  function handleResetForNew() {
    if (photoPreviewUrl) {
      URL.revokeObjectURL(photoPreviewUrl);
    }
    setForm(INITIAL_FORM);
    setPhotoFile(null);
    setPhotoPreviewUrl(null);
    setErrors({});
    setDuplicateStatus("idle");
    setSubmittedRef(null);
    setSubmitError(null);
    setUploadProgress(0);
  }

  async function handleCopyRef() {
    if (!submittedRef || typeof navigator === "undefined" || !navigator.clipboard)
      return;
    try {
      await navigator.clipboard.writeText(submittedRef);
      setCopiedRef(true);
      setTimeout(() => setCopiedRef(false), 2000);
    } catch {
      // Ignore clipboard failure
    }
  }

  function switchToPreview(side: "both" | "front" | "back" = "both") {
    setPreviewSide(side);
    setMobileTab("preview");
    if (typeof window !== "undefined") {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }

  function switchToForm() {
    setMobileTab("form");
    if (typeof window !== "undefined") {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }

  if (submittedRef) {
    return (
      <div className="max-w-2xl mx-auto px-3.5 sm:px-4 py-8 sm:py-12">
        <div className="bg-white rounded-2xl shadow-lg border border-emerald-200 p-6 sm:p-10 text-center">
          <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center mx-auto mb-5">
            <CheckCircle2 className="w-9 h-9" />
          </div>
          <h2 className="text-xl sm:text-2xl font-bold text-slate-900 mb-2.5">
            Application Submitted
          </h2>
          <p className="text-sm sm:text-base text-slate-700 mb-6 leading-relaxed">
            Your BS ID Card application has been submitted successfully. Thank
            you!
          </p>
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 sm:p-5 mb-6">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1.5">
              Unique Application Reference Number
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-2.5">
              <p className="text-xl sm:text-2xl font-mono font-bold text-emerald-700 select-all break-all">
                {submittedRef}
              </p>
              <button
                type="button"
                onClick={handleCopyRef}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white border border-slate-300 text-xs font-semibold text-slate-700 hover:bg-slate-100 active:scale-95 transition cursor-pointer"
              >
                {copiedRef ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-600" />
                    Copied
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    Copy ID
                  </>
                )}
              </button>
            </div>
            <p className="text-xs text-slate-500 mt-2.5">
              Please keep this reference number for verification with the
              administrator.
            </p>
          </div>
          <button
            type="button"
            onClick={handleResetForNew}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 active:scale-[0.99] text-white font-semibold px-6 py-3.5 sm:py-3 transition cursor-pointer"
          >
            Submit Another Application
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 pt-4 pb-24 xl:py-10">
      {/* Header Banner */}
      <div className="rounded-2xl bg-gradient-to-r from-[#8f007c] via-[#7f006f] to-[#177a2e] text-white p-5 sm:p-8 shadow-lg mb-5 sm:mb-7">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <div className="inline-flex items-center gap-2 text-[11px] sm:text-xs font-semibold bg-white/15 px-3.5 py-1 rounded-full mb-2.5">
              <Sparkles className="w-3.5 h-3.5 text-amber-300 shrink-0" />
              <span>Build by Md Nazmul Miah bs id ZM0914</span>
            </div>
            <h1 className="text-xl sm:text-3xl font-bold tracking-tight leading-snug">
              BS ID CARD APPLICATION FORM
            </h1>
          </div>
        </div>
        <p className="mt-2.5 text-xs sm:text-base text-white/90 leading-relaxed">
          Please provide your accurate personal information and upload a clear
          photograph to generate your BS ID Card. Ensure all information is
          correct before submitting.
        </p>

        {/* Completion Progress Bar */}
        <div className="mt-4 pt-3.5 border-t border-white/15">
          <div className="flex items-center justify-between text-xs font-medium text-white/95 mb-1.5">
            <span>Application Progress</span>
            <span>
              {completedCount} of 9 fields completed ({progressPct}%)
            </span>
          </div>
          <div className="w-full h-2 rounded-full bg-white/20 overflow-hidden">
            <div
              className="h-full bg-emerald-300 rounded-full transition-all duration-300"
              style={{ width: `${progressPct}%` }}
            />
          </div>
        </div>
      </div>

      {/* Mobile & Tablet Sticky View Switcher */}
      <div className="xl:hidden sticky top-2 z-30 mb-5 bg-white/95 backdrop-blur-md p-1.5 rounded-2xl shadow-md border border-slate-200 flex items-center gap-1.5">
        <button
          type="button"
          onClick={switchToForm}
          className={`flex-1 flex items-center justify-center gap-1.5 sm:gap-2 min-h-[44px] py-2 px-3 rounded-xl text-xs sm:text-sm font-semibold transition cursor-pointer ${
            mobileTab === "form"
              ? "bg-emerald-700 text-white shadow-xs"
              : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
          }`}
        >
          <FileText className="w-4 h-4 shrink-0" />
          <span>Form</span>
          <span
            className={`text-[11px] px-1.5 py-0.5 rounded-full font-bold ${
              mobileTab === "form"
                ? "bg-white/20 text-white"
                : "bg-slate-200 text-slate-700"
            }`}
          >
            {completedCount}/9
          </span>
        </button>

        <button
          type="button"
          onClick={() => switchToPreview(previewSide)}
          className={`flex-1 flex items-center justify-center gap-1.5 sm:gap-2 min-h-[44px] py-2 px-3 rounded-xl text-xs sm:text-sm font-semibold transition cursor-pointer ${
            mobileTab === "preview"
              ? "bg-[#8f007c] text-white shadow-xs"
              : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
          }`}
        >
          <IdCard className="w-4 h-4 shrink-0" />
          <span>Live Card Preview</span>
          <span className="relative flex h-2 w-2 shrink-0">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-400" />
          </span>
        </button>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 xl:gap-8 items-start">
        {/* Application Form Card */}
        <form
          onSubmit={handlePreSubmit}
          noValidate
          className={`${
            mobileTab === "form" ? "block" : "hidden"
          } xl:block xl:col-span-6 bg-white rounded-2xl shadow-sm border border-slate-200 p-4 sm:p-7 space-y-5 sm:space-y-6`}
        >
        {submitError && (
          <div className="flex items-start gap-3 rounded-xl bg-red-50 border border-red-200 p-4 text-sm text-red-800">
            <AlertCircle className="w-5 h-5 shrink-0 mt-0.5 text-red-600" />
            <div>{submitError}</div>
          </div>
        )}

        {/* 1. Full Name */}
        <div>
          <label
            htmlFor="full_name"
            className="block text-sm font-semibold text-slate-800 mb-1.5"
          >
            1. Full Name <span className="text-red-600">*</span>
          </label>
          <input
            id="full_name"
            name="full_name"
            type="text"
            autoComplete="name"
            autoCapitalize="words"
            required
            placeholder="e.g. Md Nazmul Miah"
            value={form.full_name}
            onChange={(e) => handleFieldChange("full_name", e.target.value)}
            className="w-full min-h-[46px] rounded-xl border border-slate-300 px-3.5 sm:px-4 py-2.5 text-base sm:text-sm text-slate-900 placeholder:text-slate-400 focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-600/20"
          />
          {errors.full_name && (
            <p className="mt-1.5 text-xs text-red-600 font-medium">
              {errors.full_name}
            </p>
          )}
        </div>

        {/* 2. BS ID & 3. Blood Group */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-5">
          <div>
            <label
              htmlFor="bs_id"
              className="block text-sm font-semibold text-slate-800 mb-1.5"
            >
              2. BS ID <span className="text-red-600">*</span>
            </label>
            <div className="relative">
              <input
                id="bs_id"
                name="bs_id"
                type="text"
                autoCapitalize="characters"
                autoCorrect="off"
                spellCheck={false}
                required
                placeholder="e.g. ZM0914"
                value={form.bs_id}
                onChange={(e) =>
                  handleFieldChange("bs_id", e.target.value.toUpperCase())
                }
                className="w-full min-h-[46px] rounded-xl border border-slate-300 px-3.5 sm:px-4 py-2.5 pr-10 text-base sm:text-sm text-slate-900 uppercase placeholder:normal-case placeholder:text-slate-400 focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-600/20"
              />
              {duplicateStatus === "checking" && (
                <Loader2 className="w-4 h-4 animate-spin text-slate-400 absolute right-3.5 top-3.5" />
              )}
            </div>
            {duplicateStatus === "available" && !errors.bs_id && (
              <p className="mt-1.5 text-xs text-emerald-700 font-medium flex items-center gap-1">
                <Check className="w-3.5 h-3.5" /> BS ID is available.
              </p>
            )}
            {errors.bs_id && (
              <p className="mt-1.5 text-xs text-red-600 font-medium">
                {errors.bs_id}
              </p>
            )}
          </div>

          {/* 3. Blood Group */}
          <div>
            <label
              htmlFor="blood_group"
              className="block text-sm font-semibold text-slate-800 mb-1.5"
            >
              3. Blood Group <span className="text-red-600">*</span>
            </label>
            <select
              id="blood_group"
              name="blood_group"
              required
              value={form.blood_group}
              onChange={(e) =>
                handleFieldChange(
                  "blood_group",
                  e.target.value as BloodGroup | ""
                )
              }
              className="w-full min-h-[46px] rounded-xl border border-slate-300 bg-white px-3.5 sm:px-4 py-2.5 text-base sm:text-sm text-slate-900 focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-600/20"
            >
              <option value="">Select Blood Group</option>
              {BLOOD_GROUPS.map((bg) => (
                <option key={bg} value={bg}>
                  {bg}
                </option>
              ))}
            </select>
            {errors.blood_group && (
              <p className="mt-1.5 text-xs text-red-600 font-medium">
                {errors.blood_group}
              </p>
            )}
          </div>
        </div>

        {/* 4. Personal Photograph */}
        <div>
          <label className="block text-sm font-semibold text-slate-800 mb-1">
            4. Personal Photograph <span className="text-red-600">*</span>
          </label>
          <p className="text-xs text-slate-500 mb-2.5 leading-relaxed">
            Accepted formats: JPG, JPEG, PNG, WEBP (max 5 MB). Use a clear
            front-facing portrait photograph.
          </p>

          <input
            ref={fileInputRef}
            id="photograph"
            name="photograph"
            type="file"
            accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={(e) => handlePhotoSelected(e.target.files?.[0])}
          />

          {!photoPreviewUrl ? (
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="w-full border-2 border-dashed border-slate-300 hover:border-emerald-500 active:bg-emerald-50/60 hover:bg-emerald-50/40 rounded-2xl p-5 sm:p-6 text-center transition cursor-pointer"
            >
              <div className="flex items-center justify-center gap-2 mb-2.5">
                <span className="w-10 h-10 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center">
                  <Camera className="w-5 h-5" />
                </span>
                <span className="w-10 h-10 rounded-full bg-purple-100 text-[#8f007c] flex items-center justify-center">
                  <Upload className="w-5 h-5" />
                </span>
              </div>
              <p className="text-sm sm:text-base font-semibold text-slate-800">
                Tap to Take Photo or Upload Image
              </p>
              <p className="text-xs text-slate-500 mt-1">
                JPG, JPEG, PNG, or WEBP up to 5 MB
              </p>
            </button>
          ) : (
            <div className="flex flex-col sm:flex-row items-center gap-4 p-4 rounded-2xl border border-slate-200 bg-slate-50">
              <div className="w-28 h-36 rounded-xl overflow-hidden border border-slate-300 bg-white shrink-0 shadow-xs">
                <img
                  src={photoPreviewUrl}
                  alt="Applicant photograph preview"
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="flex-1 w-full text-center sm:text-left min-w-0">
                <div className="flex items-center justify-center sm:justify-start gap-2 text-sm font-semibold text-slate-800">
                  <FileImage className="w-4 h-4 text-emerald-700 shrink-0" />
                  <span className="truncate max-w-[230px]">
                    {photoFile?.name}
                  </span>
                </div>
                <p className="text-xs text-slate-500 mt-1">
                  {photoFile
                    ? `${(photoFile.size / 1024).toFixed(1)} KB • Ready for ID Card`
                    : ""}
                </p>
                <div className="mt-3 flex flex-wrap items-center justify-center sm:justify-start gap-2">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="inline-flex items-center justify-center gap-1.5 min-h-[40px] rounded-xl border border-slate-300 bg-white hover:bg-slate-100 px-3.5 py-2 text-xs font-semibold text-slate-700 transition cursor-pointer"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    Replace Photo
                  </button>
                  <button
                    type="button"
                    onClick={() => switchToPreview("front")}
                    className="xl:hidden inline-flex items-center justify-center gap-1.5 min-h-[40px] rounded-xl bg-[#8f007c]/10 hover:bg-[#8f007c]/15 px-3.5 py-2 text-xs font-semibold text-[#8f007c] transition cursor-pointer"
                  >
                    <Eye className="w-3.5 h-3.5" />
                    See on Card
                  </button>
                </div>
              </div>
            </div>
          )}

          {errors.photograph && (
            <p className="mt-1.5 text-xs text-red-600 font-medium">
              {errors.photograph}
            </p>
          )}
        </div>

        {/* 5. Father's Name & 6. Mother's Name */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-5">
          <div>
            <label
              htmlFor="father_name"
              className="block text-sm font-semibold text-slate-800 mb-1.5"
            >
              5. Father&apos;s Name <span className="text-red-600">*</span>
            </label>
            <input
              id="father_name"
              name="father_name"
              type="text"
              autoComplete="off"
              autoCapitalize="words"
              required
              placeholder="e.g. Yousuf Miah"
              value={form.father_name}
              onChange={(e) => handleFieldChange("father_name", e.target.value)}
              className="w-full min-h-[46px] rounded-xl border border-slate-300 px-3.5 sm:px-4 py-2.5 text-base sm:text-sm text-slate-900 placeholder:text-slate-400 focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-600/20"
            />
            {errors.father_name && (
              <p className="mt-1.5 text-xs text-red-600 font-medium">
                {errors.father_name}
              </p>
            )}
          </div>

          <div>
            <label
              htmlFor="mother_name"
              className="block text-sm font-semibold text-slate-800 mb-1.5"
            >
              6. Mother&apos;s Name <span className="text-red-600">*</span>
            </label>
            <input
              id="mother_name"
              name="mother_name"
              type="text"
              autoComplete="off"
              autoCapitalize="words"
              required
              placeholder="e.g. Safia Khatun"
              value={form.mother_name}
              onChange={(e) => handleFieldChange("mother_name", e.target.value)}
              className="w-full min-h-[46px] rounded-xl border border-slate-300 px-3.5 sm:px-4 py-2.5 text-base sm:text-sm text-slate-900 placeholder:text-slate-400 focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-600/20"
            />
            {errors.mother_name && (
              <p className="mt-1.5 text-xs text-red-600 font-medium">
                {errors.mother_name}
              </p>
            )}
          </div>
        </div>

        {/* 7. Contact Number & 8. Email Address */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-5">
          <div>
            <label
              htmlFor="contact_number"
              className="block text-sm font-semibold text-slate-800 mb-1.5"
            >
              7. Contact Number <span className="text-red-600">*</span>
            </label>
            <input
              id="contact_number"
              name="contact_number"
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              required
              placeholder="e.g. 01851540587"
              value={form.contact_number}
              onChange={(e) =>
                handleFieldChange("contact_number", e.target.value)
              }
              className="w-full min-h-[46px] rounded-xl border border-slate-300 px-3.5 sm:px-4 py-2.5 text-base sm:text-sm text-slate-900 placeholder:text-slate-400 focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-600/20"
            />
            {errors.contact_number && (
              <p className="mt-1.5 text-xs text-red-600 font-medium">
                {errors.contact_number}
              </p>
            )}
          </div>

          <div>
            <label
              htmlFor="email"
              className="block text-sm font-semibold text-slate-800 mb-1.5"
            >
              8. Email Address <span className="text-red-600">*</span>
            </label>
            <input
              id="email"
              name="email"
              type="email"
              inputMode="email"
              autoComplete="email"
              autoCapitalize="none"
              required
              placeholder="e.g. applicant@gmail.com"
              value={form.email}
              onChange={(e) => handleFieldChange("email", e.target.value)}
              className="w-full min-h-[46px] rounded-xl border border-slate-300 px-3.5 sm:px-4 py-2.5 text-base sm:text-sm text-slate-900 placeholder:text-slate-400 focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-600/20"
            />
            {errors.email && (
              <p className="mt-1.5 text-xs text-red-600 font-medium">
                {errors.email}
              </p>
            )}
          </div>
        </div>

        {/* 9. Present Address */}
        <div>
          <label
            htmlFor="present_address"
            className="block text-sm font-semibold text-slate-800 mb-1.5"
          >
            9. Present Address <span className="text-red-600">*</span>
          </label>
          <textarea
            id="present_address"
            name="present_address"
            rows={3}
            autoComplete="street-address"
            required
            placeholder="e.g. Baimail, Konabari, Gazipur"
            value={form.present_address}
            onChange={(e) =>
              handleFieldChange("present_address", e.target.value)
            }
            className="w-full rounded-xl border border-slate-300 px-3.5 sm:px-4 py-2.5 text-base sm:text-sm text-slate-900 placeholder:text-slate-400 focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-600/20"
          />
          {errors.present_address && (
            <p className="mt-1.5 text-xs text-red-600 font-medium">
              {errors.present_address}
            </p>
          )}
        </div>

        <div className="pt-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3.5 border-t border-slate-100">
          <p className="text-xs text-slate-500">
            All fields marked with <span className="text-red-600">*</span> are
            mandatory.
          </p>
          <div className="flex flex-col sm:flex-row gap-2.5 w-full sm:w-auto">
            <button
              type="button"
              onClick={() => switchToPreview(previewSide)}
              className="xl:hidden w-full inline-flex items-center justify-center gap-2 rounded-xl border border-[#8f007c]/30 bg-[#8f007c]/5 hover:bg-[#8f007c]/10 text-[#8f007c] font-semibold px-5 py-3 text-sm transition cursor-pointer"
            >
              <Eye className="w-4 h-4" />
              Preview Front &amp; Back Card
            </button>
            <button
              type="submit"
              disabled={submitting || duplicateStatus === "duplicate"}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 active:scale-[0.99] disabled:bg-slate-300 text-white font-semibold px-7 py-3.5 sm:py-3 shadow-sm transition cursor-pointer"
            >
              <span>Review &amp; Submit Application</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
        </form>

        {/* Live Front & Back ID Card Preview Panel */}
        <div
          className={`${
            mobileTab === "preview" ? "block" : "hidden"
          } xl:block xl:col-span-6 xl:sticky xl:top-6 bg-white rounded-2xl shadow-sm border border-slate-200 p-4 sm:p-6 space-y-4`}
        >
          <div className="flex flex-col gap-3 border-b border-slate-100 pb-3.5">
            <div className="flex items-start sm:items-center justify-between gap-2">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
                  <Eye className="w-4 h-4" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-slate-900">
                    Live BS ID Card Preview
                  </h2>
                  <p className="text-xs text-slate-500">
                    Real-time Front &amp; Back design preview
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={switchToForm}
                className="xl:hidden shrink-0 inline-flex items-center gap-1 rounded-lg bg-slate-100 hover:bg-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 cursor-pointer"
              >
                ← Edit Form
              </button>
            </div>

            {/* Side & Zoom Controls */}
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="inline-flex rounded-xl bg-slate-100 p-1 w-full sm:w-auto">
                {(["both", "front", "back"] as const).map((mode) => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => setPreviewSide(mode)}
                    className={`flex-1 sm:flex-initial px-3 py-1.5 rounded-lg text-xs font-semibold capitalize cursor-pointer transition ${
                      previewSide === mode
                        ? "bg-white text-slate-900 shadow-xs"
                        : "text-slate-600 hover:text-slate-900"
                    }`}
                  >
                    {mode === "both" ? "Both Sides" : `${mode} Side`}
                  </button>
                ))}
              </div>

              <div className="inline-flex items-center gap-1 rounded-xl bg-slate-100 p-1 w-full sm:w-auto justify-between sm:justify-start">
                <span className="text-[11px] font-semibold text-slate-500 pl-2 pr-1 flex items-center gap-1">
                  <Maximize2 className="w-3 h-3" /> Size:
                </span>
                {(
                  [
                    { id: "fit", label: "Auto Fit" },
                    { id: "normal", label: "Compact" },
                    { id: "full", label: "100% Detail" },
                  ] as const
                ).map((z) => (
                  <button
                    key={z.id}
                    type="button"
                    onClick={() => setZoomScale(z.id)}
                    className={`flex-1 sm:flex-initial px-2.5 py-1.5 rounded-lg text-[11px] font-semibold cursor-pointer transition ${
                      zoomScale === z.id
                        ? "bg-white text-emerald-800 shadow-xs"
                        : "text-slate-600 hover:text-slate-900"
                    }`}
                  >
                    {z.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {previewTemplate ? (
            <div className="bg-slate-50/70 rounded-xl border border-slate-200/80 p-3 sm:p-4">
              {zoomScale === "full" && (
                <p className="text-[11px] text-center text-amber-700 bg-amber-50 border border-amber-200 rounded-lg py-1.5 px-2.5 mb-3">
                  100% Original Resolution (591×1004 px) — Swipe horizontally if
                  needed to inspect fonts &amp; badges
                </p>
              )}
              <LiveIdCardPreview
                data={{
                  full_name: form.full_name.trim() || "Your Full Name",
                  bs_id: form.bs_id.trim().toUpperCase() || "BS-ID",
                  blood_group: form.blood_group || "O+",
                  father_name: form.father_name.trim() || "Father's Name",
                  mother_name: form.mother_name.trim() || "Mother's Name",
                  contact_number: form.contact_number.trim() || "01XXXXXXXXX",
                  email: form.email.trim() || "your.email@gmail.com",
                  present_address:
                    form.present_address.trim() || "Your Present Address",
                  photograph_url: photoPreviewUrl || "",
                }}
                template={previewTemplate}
                responsive={zoomScale === "fit"}
                displayWidth={
                  zoomScale === "full"
                    ? previewTemplate.card_width
                    : previewSide === "both"
                    ? 245
                    : 300
                }
                side={previewSide}
                qrSealUrl="/api/template-preview/image?side=qr-seal"
              />
            </div>
          ) : (
            <div className="py-16 flex items-center justify-center gap-2 text-sm text-slate-500">
              <Loader2 className="w-5 h-5 animate-spin" />
              <span>Loading ID card preview...</span>
            </div>
          )}

          {/* Collapsible Card Elements & Typography Summary */}
          <div className="rounded-xl border border-slate-200 bg-slate-50/60 overflow-hidden">
            <button
              type="button"
              onClick={() => setShowElementsBreakdown((v) => !v)}
              className="w-full px-4 py-3 flex items-center justify-between text-left text-xs font-semibold text-slate-700 hover:bg-slate-100/70 transition cursor-pointer"
            >
              <span className="flex items-center gap-2">
                <Sparkles className="w-3.5 h-3.5 text-[#8f007c]" />
                View All Card Elements, Layout &amp; Fonts ({completedCount}/9
                filled)
              </span>
              <ChevronDown
                className={`w-4 h-4 text-slate-500 transition-transform ${
                  showElementsBreakdown ? "rotate-180" : ""
                }`}
              />
            </button>

            {showElementsBreakdown && (
              <div className="px-4 pb-4 pt-1 border-t border-slate-200/80 grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
                {[
                  {
                    label: "Full Name (Front)",
                    value: form.full_name.trim() || "Not entered yet",
                    filled: form.full_name.trim().length >= 2,
                  },
                  {
                    label: "BS ID Badge (Front)",
                    value: form.bs_id.trim().toUpperCase() || "Not entered yet",
                    filled: form.bs_id.trim().length >= 2,
                  },
                  {
                    label: "Blood Group Droplet (Front)",
                    value: form.blood_group || "Not selected",
                    filled: !!form.blood_group,
                  },
                  {
                    label: "Photograph Frame (Front)",
                    value: photoPreviewUrl ? "Photo uploaded" : "No photo yet",
                    filled: !!photoPreviewUrl,
                  },
                  {
                    label: "Father's Name (Back)",
                    value: form.father_name.trim() || "Not entered yet",
                    filled: form.father_name.trim().length >= 2,
                  },
                  {
                    label: "Mother's Name (Back)",
                    value: form.mother_name.trim() || "Not entered yet",
                    filled: form.mother_name.trim().length >= 2,
                  },
                  {
                    label: "Contact Number (Back)",
                    value: form.contact_number.trim() || "Not entered yet",
                    filled: form.contact_number.trim().length >= 6,
                  },
                  {
                    label: "Email Address (Back)",
                    value: form.email.trim() || "Not entered yet",
                    filled: form.email.includes("@"),
                  },
                  {
                    label: "Present Address (Back)",
                    value: form.present_address.trim() || "Not entered yet",
                    filled: form.present_address.trim().length >= 5,
                  },
                  {
                    label: "Fixed Design & QR Code",
                    value: "Bangladesh Scouts Official Design + Seal QR",
                    filled: true,
                  },
                ].map((item) => (
                  <div
                    key={item.label}
                    className="flex items-start gap-2 bg-white rounded-lg p-2.5 border border-slate-200/80"
                  >
                    <span
                      className={`mt-0.5 w-2 h-2 rounded-full shrink-0 ${
                        item.filled ? "bg-emerald-500" : "bg-slate-300"
                      }`}
                    />
                    <div className="min-w-0">
                      <p className="text-[11px] font-semibold text-slate-500">
                        {item.label}
                      </p>
                      <p className="text-xs font-semibold text-slate-900 truncate">
                        {item.value}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="xl:hidden flex flex-col sm:flex-row gap-2.5 pt-1">
            <button
              type="button"
              onClick={switchToForm}
              className="flex-1 min-h-[44px] rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 font-semibold text-sm px-4 py-2.5 transition cursor-pointer"
            >
              ← Back to Edit Details
            </button>
            <button
              type="button"
              onClick={() => handlePreSubmit()}
              disabled={submitting || duplicateStatus === "duplicate"}
              className="flex-1 min-h-[44px] inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 disabled:bg-slate-300 text-white font-semibold text-sm px-4 py-2.5 transition cursor-pointer"
            >
              <span>Review &amp; Submit</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>

          <p className="text-[11px] text-center text-slate-500 pt-2 border-t border-slate-100 leading-relaxed">
            Preview only — your official high-resolution ID card will be issued
            after administrator review and approval.
          </p>
        </div>
      </div>

      {/* Mobile Floating Preview Quick-Button (when filling form on mobile) */}
      {mobileTab === "form" && !showConfirmModal && (
        <div className="xl:hidden fixed bottom-4 inset-x-4 z-30 flex justify-center pointer-events-none">
          <button
            type="button"
            onClick={() => switchToPreview(previewSide)}
            className="pointer-events-auto inline-flex items-center gap-2.5 rounded-full bg-slate-900/95 hover:bg-slate-900 active:scale-95 text-white px-5 py-3 shadow-xl border border-white/15 backdrop-blur-md text-xs sm:text-sm font-semibold transition cursor-pointer"
          >
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-400" />
            </span>
            <IdCard className="w-4 h-4 text-emerald-300" />
            <span>View Live ID Card</span>
          </button>
        </div>
      )}

      {/* Confirmation Dialog (Mobile Bottom Sheet / Centered Modal) */}
      {showConfirmModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-900/60 backdrop-blur-xs p-0 sm:p-4">
          <div className="bg-white rounded-t-3xl sm:rounded-2xl max-w-lg w-full shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
            <div className="px-5 py-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between shrink-0">
              <div>
                <h3 className="text-base sm:text-lg font-bold text-slate-900">
                  Confirm BS ID Card Application
                </h3>
                <p className="text-[11px] sm:text-xs text-slate-500 mt-0.5">
                  Verify your details before final submission.
                </p>
              </div>
              <button
                type="button"
                disabled={submitting}
                onClick={() => setShowConfirmModal(false)}
                className="w-8 h-8 rounded-full bg-slate-200/80 hover:bg-slate-300 text-slate-600 flex items-center justify-center transition cursor-pointer"
                aria-label="Close dialog"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 sm:p-6 space-y-4 overflow-y-auto flex-1">
              <div className="flex items-center gap-3 sm:gap-4 bg-slate-50 p-3 sm:p-3.5 rounded-xl border border-slate-200">
                {photoPreviewUrl ? (
                  <img
                    src={photoPreviewUrl}
                    alt="Confirm photograph"
                    className="w-16 h-20 sm:w-20 sm:h-24 object-cover rounded-xl border border-slate-300 shrink-0 shadow-xs"
                  />
                ) : (
                  <div className="w-16 h-20 rounded-xl bg-slate-200 flex items-center justify-center text-slate-400 text-xs shrink-0">
                    No Photo
                  </div>
                )}
                <div className="space-y-1 text-sm min-w-0">
                  <p className="font-bold text-slate-900 text-base sm:text-lg truncate">
                    {form.full_name}
                  </p>
                  <p className="text-xs sm:text-sm text-slate-600">
                    BS ID:{" "}
                    <span className="font-semibold text-slate-900">
                      {form.bs_id.toUpperCase()}
                    </span>
                  </p>
                  <p className="text-xs sm:text-sm text-slate-600">
                    Blood Group:{" "}
                    <span className="font-semibold text-red-600">
                      {form.blood_group}
                    </span>
                  </p>
                </div>
              </div>

              <dl className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs bg-slate-50 p-3.5 sm:p-4 rounded-xl border border-slate-200">
                <div>
                  <dt className="text-slate-500">Father&apos;s Name</dt>
                  <dd className="font-semibold text-slate-900 mt-0.5">
                    {form.father_name}
                  </dd>
                </div>
                <div>
                  <dt className="text-slate-500">Mother&apos;s Name</dt>
                  <dd className="font-semibold text-slate-900 mt-0.5">
                    {form.mother_name}
                  </dd>
                </div>
                <div>
                  <dt className="text-slate-500">Contact Number</dt>
                  <dd className="font-semibold text-slate-900 mt-0.5">
                    {form.contact_number}
                  </dd>
                </div>
                <div>
                  <dt className="text-slate-500">Email Address</dt>
                  <dd className="font-semibold text-slate-900 break-all mt-0.5">
                    {form.email}
                  </dd>
                </div>
                <div className="sm:col-span-2">
                  <dt className="text-slate-500">Present Address</dt>
                  <dd className="font-semibold text-slate-900 mt-0.5 leading-relaxed">
                    {form.present_address}
                  </dd>
                </div>
              </dl>

              {submitting && (
                <div className="space-y-2 p-3 bg-emerald-50 rounded-xl border border-emerald-200">
                  <div className="flex items-center justify-between text-xs font-semibold text-emerald-800">
                    <span className="flex items-center gap-1.5">
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      Uploading photo &amp; saving...
                    </span>
                    <span>{uploadProgress}%</span>
                  </div>
                  <div className="w-full h-2.5 rounded-full bg-emerald-200/60 overflow-hidden">
                    <div
                      className="h-full bg-emerald-600 transition-all duration-200 rounded-full"
                      style={{ width: `${uploadProgress}%` }}
                    />
                  </div>
                </div>
              )}
            </div>

            <div className="px-4 py-3.5 sm:px-6 sm:py-4 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-end gap-2.5 shrink-0">
              <button
                type="button"
                disabled={submitting}
                onClick={() => setShowConfirmModal(false)}
                className="w-full sm:w-auto min-h-[44px] rounded-xl border border-slate-300 bg-white hover:bg-slate-100 px-4 py-2.5 text-sm font-semibold text-slate-700 transition cursor-pointer"
              >
                Edit Details
              </button>
              <button
                type="button"
                disabled={submitting}
                onClick={handleConfirmedSubmit}
                className="w-full sm:w-auto min-h-[44px] inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 disabled:opacity-60 px-6 py-2.5 text-sm font-semibold text-white transition cursor-pointer"
              >
                {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
                Confirm &amp; Submit Application
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
