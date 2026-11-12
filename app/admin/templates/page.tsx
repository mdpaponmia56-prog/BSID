"use client";

import React, { useEffect, useRef, useState } from "react";
import {
  CheckCircle2,
  FlaskConical,
  History,
  Loader2,
  RotateCcw,
  Save,
  Upload,
} from "lucide-react";
import {
  IdCardTemplateRecord,
  TemplateVersionRecord,
  TextFieldConfig,
} from "@/lib/types";
import LiveIdCardPreview from "@/components/LiveIdCardPreview";

const SAMPLE_APPLICANT = {
  full_name: "Md Nazmul Miah",
  bs_id: "ZM0914",
  blood_group: "O+",
  father_name: "Yousuf Miah",
  mother_name: "Safia Khatun",
  contact_number: "01851540587",
  email: "nazmulmia101010@gmail.com",
  present_address: "Baimail,Konabari,Gazipur",
  photograph_url: "",
};

export default function AdminTemplatesPage() {
  const [template, setTemplate] = useState<IdCardTemplateRecord | null>(null);
  const [versions, setVersions] = useState<TemplateVersionRecord[]>([]);
  const [selectedElement, setSelectedElement] = useState<
    TextFieldConfig["key"] | "photograph" | "qrCode"
  >("full_name");
  const [sampleData, setSampleData] = useState(SAMPLE_APPLICANT);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingSide, setUploadingSide] = useState<"front" | "back" | null>(
    null
  );
  const [testingRender, setTestingRender] = useState(false);
  const [testImages, setTestImages] = useState<{
    frontDataUrl: string;
    backDataUrl: string;
  } | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const frontUploadRef = useRef<HTMLInputElement>(null);
  const backUploadRef = useRef<HTMLInputElement>(null);

  async function loadTemplate() {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/templates");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load template.");
      setTemplate(data.template);
      setVersions(data.versions || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load template.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadTemplate();
  }, []);

  async function handleBackgroundUpload(side: "front" | "back", file?: File) {
    if (!file) return;
    setUploadingSide(side);
    setError(null);
    setNotice(null);
    try {
      const fd = new FormData();
      fd.append("side", side);
      fd.append("file", file);
      const res = await fetch("/api/admin/templates/upload", {
        method: "POST",
        body: fd,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Upload failed.");
      setTemplate(data.template);
      setVersions(data.versions || []);
      setNotice(
        `Original ${side} background updated and saved as version ${data.template.version_number}.`
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed.");
    } finally {
      setUploadingSide(null);
    }
  }

  async function handleSaveTemplate() {
    if (!template) return;
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      const res = await fetch("/api/admin/templates", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          template_name: template.template_name,
          card_width: template.card_width,
          card_height: template.card_height,
          text_position_configuration: template.text_position_configuration,
          image_position_configuration: template.image_position_configuration,
          typography_configuration: template.typography_configuration,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to save template.");
      setTemplate(data.template);
      setVersions(data.versions || []);
      setNotice(
        `Template configuration saved persistently (Version ${data.template.version_number}).`
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed.");
    } finally {
      setSaving(false);
    }
  }

  async function handleTestServerRender() {
    if (!template) return;
    setTestingRender(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/templates/test-render", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text_position_configuration: template.text_position_configuration,
          image_position_configuration: template.image_position_configuration,
          typography_configuration: template.typography_configuration,
          sample: sampleData,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Test render failed.");
      setTestImages(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Test render failed.");
    } finally {
      setTestingRender(false);
    }
  }

  async function handleRestoreVersion(versionId: string) {
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      const res = await fetch("/api/admin/templates/restore", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ versionId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Restore failed.");
      setTemplate(data.template);
      setVersions(data.versions || []);
      setTestImages(null);
      setNotice(
        `Template configuration restored as Version ${data.template.version_number}.`
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Restore failed.");
    } finally {
      setSaving(false);
    }
  }

  function updateTextField<K extends keyof TextFieldConfig>(
    key: TextFieldConfig["key"],
    prop: K,
    val: TextFieldConfig[K]
  ) {
    if (!template) return;
    setTemplate({
      ...template,
      text_position_configuration: {
        ...template.text_position_configuration,
        [key]: {
          ...template.text_position_configuration[key],
          [prop]: val,
        },
      },
    });
  }

  if (loading || !template) {
    return (
      <div className="p-12 flex items-center justify-center gap-2 text-slate-500">
        <Loader2 className="w-5 h-5 animate-spin" />
        <span>Loading template editor...</span>
      </div>
    );
  }

  const textFieldKeys = Object.keys(
    template.text_position_configuration
  ) as Array<TextFieldConfig["key"]>;

  const activeTextCfg =
    selectedElement !== "photograph" && selectedElement !== "qrCode"
      ? template.text_position_configuration[selectedElement]
      : null;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">
            Template Management
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Administrator-only template configuration for{" "}
            <strong>{template.template_name}</strong> (v{template.version_number}
            ). Changes affect future card generations only.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            disabled={testingRender}
            onClick={handleTestServerRender}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-800 px-4 py-2 text-xs font-semibold cursor-pointer"
          >
            {testingRender ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <FlaskConical className="w-4 h-4 text-[#8f007c]" />
            )}
            Test Render Output
          </button>

          <button
            type="button"
            disabled={saving}
            onClick={handleSaveTemplate}
            className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white px-5 py-2 text-xs font-semibold cursor-pointer disabled:opacity-50"
          >
            {saving ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Save className="w-4 h-4" />
            )}
            Save Template Settings
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-xl bg-red-50 border border-red-200 p-4 text-sm text-red-800">
          {error}
        </div>
      )}
      {notice && (
        <div className="flex items-center gap-2 rounded-xl bg-emerald-50 border border-emerald-200 p-4 text-sm text-emerald-800">
          <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
          <span>{notice}</span>
        </div>
      )}

      {/* Background Asset Uploaders */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white rounded-2xl border border-slate-200 p-4 flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-bold text-slate-900">
              Original Front Design
            </p>
            <p className="text-xs text-slate-500">
              PNG, JPG, or PDF fixed front background ({template.card_width}×
              {template.card_height})
            </p>
          </div>
          <input
            ref={frontUploadRef}
            type="file"
            accept=".png,.jpg,.jpeg,.pdf"
            className="hidden"
            onChange={(e) =>
              handleBackgroundUpload("front", e.target.files?.[0])
            }
          />
          <button
            type="button"
            disabled={uploadingSide === "front"}
            onClick={() => frontUploadRef.current?.click()}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 bg-slate-50 hover:bg-slate-100 px-3.5 py-2 text-xs font-semibold text-slate-700 cursor-pointer shrink-0"
          >
            {uploadingSide === "front" ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Upload className="w-4 h-4" />
            )}
            Replace Front
          </button>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 p-4 flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-bold text-slate-900">
              Original Back Design
            </p>
            <p className="text-xs text-slate-500">
              PNG, JPG, or PDF fixed back background ({template.card_width}×
              {template.card_height})
            </p>
          </div>
          <input
            ref={backUploadRef}
            type="file"
            accept=".png,.jpg,.jpeg,.pdf"
            className="hidden"
            onChange={(e) =>
              handleBackgroundUpload("back", e.target.files?.[0])
            }
          />
          <button
            type="button"
            disabled={uploadingSide === "back"}
            onClick={() => backUploadRef.current?.click()}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 bg-slate-50 hover:bg-slate-100 px-3.5 py-2 text-xs font-semibold text-slate-700 cursor-pointer shrink-0"
          >
            {uploadingSide === "back" ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Upload className="w-4 h-4" />
            )}
            Replace Back
          </button>
        </div>
      </div>

      {/* Editor Workspace */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
        {/* Left Controls */}
        <div className="xl:col-span-5 space-y-5">
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-4">
            <h2 className="text-sm font-bold text-slate-900">
              Select Element to Configure
            </h2>
            <div className="flex flex-wrap gap-1.5">
              {textFieldKeys.map((k) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => setSelectedElement(k)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition ${
                    selectedElement === k
                      ? "bg-slate-900 text-white"
                      : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                  }`}
                >
                  {template.text_position_configuration[k].label}
                </button>
              ))}
              <button
                type="button"
                onClick={() => setSelectedElement("photograph")}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition ${
                  selectedElement === "photograph"
                    ? "bg-[#8f007c] text-white"
                    : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                }`}
              >
                Photograph Frame
              </button>
              <button
                type="button"
                onClick={() => setSelectedElement("qrCode")}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition ${
                  selectedElement === "qrCode"
                    ? "bg-emerald-700 text-white"
                    : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                }`}
              >
                QR Code
              </button>
            </div>

            {/* Text Field Configuration */}
            {activeTextCfg && (
              <div className="pt-3 border-t border-slate-100 space-y-3 text-xs">
                <p className="font-bold text-slate-800 text-sm">
                  {activeTextCfg.label} ({activeTextCfg.side.toUpperCase()})
                </p>

                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block font-semibold text-slate-600 mb-1">
                      X Position
                    </label>
                    <input
                      type="number"
                      value={activeTextCfg.x}
                      onChange={(e) =>
                        updateTextField(
                          activeTextCfg.key,
                          "x",
                          Number(e.target.value)
                        )
                      }
                      className="w-full rounded-lg border border-slate-300 px-2.5 py-1.5"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-600 mb-1">
                      Y Position
                    </label>
                    <input
                      type="number"
                      value={activeTextCfg.y}
                      onChange={(e) =>
                        updateTextField(
                          activeTextCfg.key,
                          "y",
                          Number(e.target.value)
                        )
                      }
                      className="w-full rounded-lg border border-slate-300 px-2.5 py-1.5"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-600 mb-1">
                      Max Width
                    </label>
                    <input
                      type="number"
                      value={activeTextCfg.maxWidth}
                      onChange={(e) =>
                        updateTextField(
                          activeTextCfg.key,
                          "maxWidth",
                          Number(e.target.value)
                        )
                      }
                      className="w-full rounded-lg border border-slate-300 px-2.5 py-1.5"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-semibold text-slate-600 mb-1">
                      Font Family
                    </label>
                    <select
                      value={activeTextCfg.fontFamily}
                      onChange={(e) =>
                        updateTextField(
                          activeTextCfg.key,
                          "fontFamily",
                          e.target.value
                        )
                      }
                      className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5"
                    >
                      <option value="Open Sans">Open Sans</option>
                      <option value="Merriweather">Merriweather (Serif)</option>
                    </select>
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-600 mb-1">
                      Text Alignment
                    </label>
                    <select
                      value={activeTextCfg.align}
                      onChange={(e) =>
                        updateTextField(
                          activeTextCfg.key,
                          "align",
                          e.target.value as "left" | "center" | "right"
                        )
                      }
                      className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5"
                    >
                      <option value="left">Left</option>
                      <option value="center">Center</option>
                      <option value="right">Right</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block font-semibold text-slate-600 mb-1">
                      Font Size
                    </label>
                    <input
                      type="number"
                      value={activeTextCfg.fontSize}
                      onChange={(e) =>
                        updateTextField(
                          activeTextCfg.key,
                          "fontSize",
                          Number(e.target.value)
                        )
                      }
                      className="w-full rounded-lg border border-slate-300 px-2.5 py-1.5"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-600 mb-1">
                      Font Weight
                    </label>
                    <select
                      value={activeTextCfg.fontWeight}
                      onChange={(e) =>
                        updateTextField(
                          activeTextCfg.key,
                          "fontWeight",
                          e.target.value as "400" | "500" | "600" | "700"
                        )
                      }
                      className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5"
                    >
                      <option value="400">Regular (400)</option>
                      <option value="500">Medium (500)</option>
                      <option value="600">SemiBold (600)</option>
                      <option value="700">Bold (700)</option>
                    </select>
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-600 mb-1">
                      Font Color
                    </label>
                    <input
                      type="color"
                      value={activeTextCfg.color}
                      onChange={(e) =>
                        updateTextField(
                          activeTextCfg.key,
                          "color",
                          e.target.value
                        )
                      }
                      className="w-full h-8 rounded-lg border border-slate-300 p-0.5 cursor-pointer"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 items-center">
                  <div>
                    <label className="block font-semibold text-slate-600 mb-1">
                      Line Spacing
                    </label>
                    <input
                      type="number"
                      step="0.05"
                      min="0.8"
                      max="2.5"
                      value={activeTextCfg.lineHeight}
                      onChange={(e) =>
                        updateTextField(
                          activeTextCfg.key,
                          "lineHeight",
                          Number(e.target.value)
                        )
                      }
                      className="w-full rounded-lg border border-slate-300 px-2.5 py-1.5"
                    />
                  </div>
                  <label className="flex items-center gap-2 pt-5 font-semibold text-slate-700 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={activeTextCfg.wrap}
                      onChange={(e) =>
                        updateTextField(
                          activeTextCfg.key,
                          "wrap",
                          e.target.checked
                        )
                      }
                      className="rounded border-slate-300"
                    />
                    Enable Text Wrapping
                  </label>
                </div>
              </div>
            )}

            {/* Photograph Slot Configuration */}
            {selectedElement === "photograph" && (
              <div className="pt-3 border-t border-slate-100 space-y-3 text-xs">
                <p className="font-bold text-slate-800 text-sm">
                  Photograph Frame Configuration
                </p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-semibold text-slate-600 mb-1">
                      X
                    </label>
                    <input
                      type="number"
                      value={template.image_position_configuration.photograph.x}
                      onChange={(e) =>
                        setTemplate({
                          ...template,
                          image_position_configuration: {
                            ...template.image_position_configuration,
                            photograph: {
                              ...template.image_position_configuration
                                .photograph,
                              x: Number(e.target.value),
                            },
                          },
                        })
                      }
                      className="w-full rounded-lg border border-slate-300 px-2.5 py-1.5"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-600 mb-1">
                      Y
                    </label>
                    <input
                      type="number"
                      value={template.image_position_configuration.photograph.y}
                      onChange={(e) =>
                        setTemplate({
                          ...template,
                          image_position_configuration: {
                            ...template.image_position_configuration,
                            photograph: {
                              ...template.image_position_configuration
                                .photograph,
                              y: Number(e.target.value),
                            },
                          },
                        })
                      }
                      className="w-full rounded-lg border border-slate-300 px-2.5 py-1.5"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-600 mb-1">
                      Width
                    </label>
                    <input
                      type="number"
                      value={
                        template.image_position_configuration.photograph.width
                      }
                      onChange={(e) =>
                        setTemplate({
                          ...template,
                          image_position_configuration: {
                            ...template.image_position_configuration,
                            photograph: {
                              ...template.image_position_configuration
                                .photograph,
                              width: Number(e.target.value),
                            },
                          },
                        })
                      }
                      className="w-full rounded-lg border border-slate-300 px-2.5 py-1.5"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-600 mb-1">
                      Height
                    </label>
                    <input
                      type="number"
                      value={
                        template.image_position_configuration.photograph.height
                      }
                      onChange={(e) =>
                        setTemplate({
                          ...template,
                          image_position_configuration: {
                            ...template.image_position_configuration,
                            photograph: {
                              ...template.image_position_configuration
                                .photograph,
                              height: Number(e.target.value),
                            },
                          },
                        })
                      }
                      className="w-full rounded-lg border border-slate-300 px-2.5 py-1.5"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-600 mb-1">
                      Border Radius
                    </label>
                    <input
                      type="number"
                      value={
                        template.image_position_configuration.photograph
                          .borderRadius
                      }
                      onChange={(e) =>
                        setTemplate({
                          ...template,
                          image_position_configuration: {
                            ...template.image_position_configuration,
                            photograph: {
                              ...template.image_position_configuration
                                .photograph,
                              borderRadius: Number(e.target.value),
                            },
                          },
                        })
                      }
                      className="w-full rounded-lg border border-slate-300 px-2.5 py-1.5"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-600 mb-1">
                      Image Fitting
                    </label>
                    <select
                      value={
                        template.image_position_configuration.photograph
                          .objectFit
                      }
                      onChange={(e) =>
                        setTemplate({
                          ...template,
                          image_position_configuration: {
                            ...template.image_position_configuration,
                            photograph: {
                              ...template.image_position_configuration
                                .photograph,
                              objectFit: e.target.value as
                                | "cover"
                                | "contain"
                                | "fill",
                            },
                          },
                        })
                      }
                      className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5"
                    >
                      <option value="cover">Cover (Crop to Fill)</option>
                      <option value="contain">Contain (Fit Inside)</option>
                      <option value="fill">Stretch to Fill</option>
                    </select>
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-600 mb-1">
                      Crop Focal X (0–1)
                    </label>
                    <input
                      type="number"
                      step="0.05"
                      min="0"
                      max="1"
                      value={
                        template.image_position_configuration.photograph.cropX
                      }
                      onChange={(e) =>
                        setTemplate({
                          ...template,
                          image_position_configuration: {
                            ...template.image_position_configuration,
                            photograph: {
                              ...template.image_position_configuration
                                .photograph,
                              cropX: Number(e.target.value),
                            },
                          },
                        })
                      }
                      className="w-full rounded-lg border border-slate-300 px-2.5 py-1.5"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-600 mb-1">
                      Crop Focal Y (0–1)
                    </label>
                    <input
                      type="number"
                      step="0.05"
                      min="0"
                      max="1"
                      value={
                        template.image_position_configuration.photograph.cropY
                      }
                      onChange={(e) =>
                        setTemplate({
                          ...template,
                          image_position_configuration: {
                            ...template.image_position_configuration,
                            photograph: {
                              ...template.image_position_configuration
                                .photograph,
                              cropY: Number(e.target.value),
                            },
                          },
                        })
                      }
                      className="w-full rounded-lg border border-slate-300 px-2.5 py-1.5"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* QR Code Slot Configuration */}
            {selectedElement === "qrCode" && (
              <div className="pt-3 border-t border-slate-100 space-y-3 text-xs">
                <p className="font-bold text-slate-800 text-sm">
                  QR Code Configuration
                </p>
                <div className="grid grid-cols-2 gap-3">
                  <label className="flex items-center gap-2 font-semibold text-slate-700 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={
                        template.image_position_configuration.qrCode.enabled
                      }
                      onChange={(e) =>
                        setTemplate({
                          ...template,
                          image_position_configuration: {
                            ...template.image_position_configuration,
                            qrCode: {
                              ...template.image_position_configuration.qrCode,
                              enabled: e.target.checked,
                            },
                          },
                        })
                      }
                    />
                    Enable QR Code
                  </label>
                  <label className="flex items-center gap-2 font-semibold text-slate-700 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={
                        template.image_position_configuration.qrCode
                          .showCenterSeal
                      }
                      onChange={(e) =>
                        setTemplate({
                          ...template,
                          image_position_configuration: {
                            ...template.image_position_configuration,
                            qrCode: {
                              ...template.image_position_configuration.qrCode,
                              showCenterSeal: e.target.checked,
                            },
                          },
                        })
                      }
                    />
                    Center Scouts Seal
                  </label>
                </div>
                <div className="grid grid-cols-4 gap-2">
                  <div>
                    <label className="block font-semibold text-slate-600 mb-1">
                      X
                    </label>
                    <input
                      type="number"
                      value={template.image_position_configuration.qrCode.x}
                      onChange={(e) =>
                        setTemplate({
                          ...template,
                          image_position_configuration: {
                            ...template.image_position_configuration,
                            qrCode: {
                              ...template.image_position_configuration.qrCode,
                              x: Number(e.target.value),
                            },
                          },
                        })
                      }
                      className="w-full rounded-lg border border-slate-300 px-2 py-1"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-600 mb-1">
                      Y
                    </label>
                    <input
                      type="number"
                      value={template.image_position_configuration.qrCode.y}
                      onChange={(e) =>
                        setTemplate({
                          ...template,
                          image_position_configuration: {
                            ...template.image_position_configuration,
                            qrCode: {
                              ...template.image_position_configuration.qrCode,
                              y: Number(e.target.value),
                            },
                          },
                        })
                      }
                      className="w-full rounded-lg border border-slate-300 px-2 py-1"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-600 mb-1">
                      W
                    </label>
                    <input
                      type="number"
                      value={template.image_position_configuration.qrCode.width}
                      onChange={(e) =>
                        setTemplate({
                          ...template,
                          image_position_configuration: {
                            ...template.image_position_configuration,
                            qrCode: {
                              ...template.image_position_configuration.qrCode,
                              width: Number(e.target.value),
                            },
                          },
                        })
                      }
                      className="w-full rounded-lg border border-slate-300 px-2 py-1"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-600 mb-1">
                      H
                    </label>
                    <input
                      type="number"
                      value={
                        template.image_position_configuration.qrCode.height
                      }
                      onChange={(e) =>
                        setTemplate({
                          ...template,
                          image_position_configuration: {
                            ...template.image_position_configuration,
                            qrCode: {
                              ...template.image_position_configuration.qrCode,
                              height: Number(e.target.value),
                            },
                          },
                        })
                      }
                      className="w-full rounded-lg border border-slate-300 px-2 py-1"
                    />
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Sample Test Data */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-3">
            <h3 className="text-sm font-bold text-slate-900">
              Sample Test Information
            </h3>
            <div className="grid grid-cols-2 gap-2.5 text-xs">
              <input
                type="text"
                placeholder="Full Name"
                value={sampleData.full_name}
                onChange={(e) =>
                  setSampleData({ ...sampleData, full_name: e.target.value })
                }
                className="rounded-lg border border-slate-300 px-2.5 py-1.5"
              />
              <input
                type="text"
                placeholder="BS ID"
                value={sampleData.bs_id}
                onChange={(e) =>
                  setSampleData({ ...sampleData, bs_id: e.target.value })
                }
                className="rounded-lg border border-slate-300 px-2.5 py-1.5"
              />
              <input
                type="text"
                placeholder="Blood Group"
                value={sampleData.blood_group}
                onChange={(e) =>
                  setSampleData({ ...sampleData, blood_group: e.target.value })
                }
                className="rounded-lg border border-slate-300 px-2.5 py-1.5"
              />
              <input
                type="text"
                placeholder="Contact"
                value={sampleData.contact_number}
                onChange={(e) =>
                  setSampleData({
                    ...sampleData,
                    contact_number: e.target.value,
                  })
                }
                className="rounded-lg border border-slate-300 px-2.5 py-1.5"
              />
            </div>
          </div>

          {/* Version History & Restore */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-3">
            <div className="flex items-center gap-2">
              <History className="w-4 h-4 text-slate-600" />
              <h3 className="text-sm font-bold text-slate-900">
                Saved Template Versions
              </h3>
            </div>
            <div className="space-y-2 max-h-52 overflow-y-auto">
              {versions.map((v) => (
                <div
                  key={v.id}
                  className="flex items-center justify-between rounded-xl bg-slate-50 border border-slate-200 px-3 py-2 text-xs"
                >
                  <div>
                    <p className="font-bold text-slate-800">
                      Version {v.version_number}
                    </p>
                    <p className="text-slate-500">
                      {new Date(v.created_date).toLocaleString()}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleRestoreVersion(v.id)}
                    className="inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-white hover:bg-slate-100 px-2.5 py-1 font-semibold text-slate-700 cursor-pointer"
                  >
                    <RotateCcw className="w-3 h-3" />
                    Restore
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right Live Template Preview / Server Test Render */}
        <div className="xl:col-span-7 bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-5">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <h2 className="text-base font-bold text-slate-900">
              {testImages
                ? "Server-Rendered PNG Verification"
                : "Interactive Template Coordinate Preview"}
            </h2>
            {testImages && (
              <button
                type="button"
                onClick={() => setTestImages(null)}
                className="text-xs font-semibold text-emerald-700 hover:underline cursor-pointer"
              >
                Back to Interactive Preview
              </button>
            )}
          </div>

          {testImages ? (
            <div className="flex flex-wrap justify-center gap-6">
              <div className="flex flex-col items-center">
                <span className="text-[11px] font-bold uppercase text-slate-500 mb-2">
                  Server PNG Front
                </span>
                <img
                  src={testImages.frontDataUrl}
                  alt="Server test front"
                  className="w-[265px] rounded-xl shadow-md border border-slate-300"
                />
              </div>
              <div className="flex flex-col items-center">
                <span className="text-[11px] font-bold uppercase text-slate-500 mb-2">
                  Server PNG Back
                </span>
                <img
                  src={testImages.backDataUrl}
                  alt="Server test back"
                  className="w-[265px] rounded-xl shadow-md border border-slate-300"
                />
              </div>
            </div>
          ) : (
            <LiveIdCardPreview
              data={sampleData}
              template={template}
              displayWidth={265}
              highlightField={selectedElement}
            />
          )}
        </div>
      </div>
    </div>
  );
}
