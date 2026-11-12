"use client";

import React, { useEffect, useRef, useState } from "react";
import QRCode from "qrcode";
import { User } from "lucide-react";
import {
  BloodGroup,
  IdCardTemplateRecord,
  TextFieldConfig,
} from "@/lib/types";

export interface LiveCardData {
  full_name: string;
  bs_id: string;
  blood_group: BloodGroup | string;
  father_name: string;
  mother_name: string;
  contact_number: string;
  email: string;
  present_address: string;
  photograph_url: string;
}

interface LiveIdCardPreviewProps {
  data: LiveCardData;
  template: IdCardTemplateRecord;
  displayWidth?: number;
  responsive?: boolean;
  maxSideWidth?: number;
  side?: "both" | "front" | "back";
  highlightField?: TextFieldConfig["key"] | "photograph" | "qrCode" | null;
  qrSealUrl?: string;
}

function renderSingleSide(params: {
  side: "front" | "back";
  data: LiveCardData;
  template: IdCardTemplateRecord;
  displayWidth: number;
  qrDataUrl: string | null;
  highlightField?: TextFieldConfig["key"] | "photograph" | "qrCode" | null;
  qrSealUrl: string;
}) {
  const {
    side,
    data,
    template,
    displayWidth,
    qrDataUrl,
    highlightField,
    qrSealUrl,
  } = params;
  const scale = displayWidth / template.card_width;
  const displayHeight = template.card_height * scale;
  const bgUrl =
    side === "front"
      ? template.front_background_url
      : template.back_background_url;

  const photoCfg = template.image_position_configuration.photograph;
  const qrCfg = template.image_position_configuration.qrCode;
  const fields = Object.values(template.text_position_configuration).filter(
    (f) => f.side === side
  );

  return (
    <div className="flex flex-col items-center">
      <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-2">
        {side === "front" ? "Front Side" : "Back Side"}
      </span>
      <div
        className="relative overflow-hidden rounded-xl shadow-md border border-slate-300 bg-white select-none"
        style={{ width: `${displayWidth}px`, height: `${displayHeight}px` }}
      >
        {/* Fixed Original Background */}
        <img
          src={bgUrl}
          alt={`${side} template background`}
          className="absolute inset-0 w-full h-full object-fill pointer-events-none"
        />

        {/* Photograph Slot */}
        {photoCfg.side === side && (
          <div
            className={`absolute overflow-hidden ${
              highlightField === "photograph"
                ? "ring-2 ring-amber-400 ring-offset-1"
                : ""
            }`}
            style={{
              left: `${photoCfg.x * scale}px`,
              top: `${photoCfg.y * scale}px`,
              width: `${photoCfg.width * scale}px`,
              height: `${photoCfg.height * scale}px`,
              borderRadius: `${photoCfg.borderRadius * scale}px`,
            }}
          >
            {data.photograph_url ? (
              <img
                src={data.photograph_url}
                alt={data.full_name || "Applicant"}
                className="w-full h-full"
                style={{
                  objectFit: photoCfg.objectFit || "cover",
                  objectPosition: `${(photoCfg.cropX ?? 0.5) * 100}% ${
                    (photoCfg.cropY ?? 0.5) * 100
                  }%`,
                  transform: `scale(${photoCfg.zoom || 1})`,
                }}
              />
            ) : (
              <div className="w-full h-full bg-slate-100/90 flex flex-col items-center justify-center text-slate-400 p-2 text-center">
                <User
                  className="text-slate-300 mb-1"
                  style={{
                    width: `${Math.max(20, photoCfg.width * scale * 0.42)}px`,
                    height: `${Math.max(20, photoCfg.width * scale * 0.42)}px`,
                  }}
                />
                <span
                  className="font-semibold text-slate-400 leading-tight"
                  style={{ fontSize: `${Math.max(9, 13 * scale)}px` }}
                >
                  Photo Preview
                </span>
              </div>
            )}
          </div>
        )}

        {/* QR Code Slot */}
        {qrCfg?.enabled && qrCfg.side === side && qrDataUrl && (
          <div
            className={`absolute ${
              highlightField === "qrCode"
                ? "ring-2 ring-amber-400 ring-offset-1"
                : ""
            }`}
            style={{
              left: `${qrCfg.x * scale}px`,
              top: `${qrCfg.y * scale}px`,
              width: `${qrCfg.width * scale}px`,
              height: `${qrCfg.height * scale}px`,
            }}
          >
            <img
              src={qrDataUrl}
              alt="ID QR Code"
              className="w-full h-full object-contain"
            />
            {qrCfg.showCenterSeal && (
              <div
                className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white flex items-center justify-center overflow-hidden"
                style={{
                  width: `${qrCfg.width * scale * 0.24}px`,
                  height: `${qrCfg.height * scale * 0.24}px`,
                  padding: "1px",
                }}
              >
                <img
                  src={qrSealUrl}
                  alt="Scouts Seal"
                  className="w-full h-full object-contain rounded-full"
                />
              </div>
            )}
          </div>
        )}

        {/* Dynamic Text Fields */}
        {fields.map((cfg) => {
          const val = data[cfg.key] || "";
          const fontFamilyCss =
            cfg.fontFamily === "Merriweather"
              ? "var(--font-merriweather), Georgia, serif"
              : "var(--font-open-sans), Arial, sans-serif";

          const boxLeft =
            cfg.align === "center"
              ? (cfg.x - cfg.maxWidth / 2) * scale
              : cfg.align === "right"
              ? (cfg.x - cfg.maxWidth) * scale
              : cfg.x * scale;

          return (
            <div
              key={cfg.key}
              className={`absolute -translate-y-1/2 ${
                highlightField === cfg.key
                  ? "outline-2 outline-dashed outline-amber-400 bg-amber-200/20 rounded"
                  : ""
              }`}
              style={{
                left: `${boxLeft}px`,
                top: `${cfg.y * scale}px`,
                width: `${cfg.maxWidth * scale}px`,
                textAlign: cfg.align,
                fontFamily: fontFamilyCss,
                fontSize: `${cfg.fontSize * scale}px`,
                fontWeight: cfg.fontWeight,
                color: cfg.color,
                lineHeight: cfg.lineHeight,
                whiteSpace: cfg.wrap ? "normal" : "nowrap",
                overflowWrap: "break-word",
              }}
            >
              {val}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function LiveIdCardPreview({
  data,
  template,
  displayWidth = 280,
  responsive = false,
  maxSideWidth,
  side = "both",
  highlightField = null,
  qrSealUrl = "/api/admin/assets/qr-seal",
}: LiveIdCardPreviewProps) {
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [containerWidth, setContainerWidth] = useState<number>(0);

  useEffect(() => {
    if (!responsive || !containerRef.current) return;
    const el = containerRef.current;

    const update = () => {
      const w = el.getBoundingClientRect().width;
      if (w > 0) setContainerWidth(Math.floor(w));
    };

    update();
    if (typeof ResizeObserver !== "undefined") {
      const ro = new ResizeObserver(() => update());
      ro.observe(el);
      return () => ro.disconnect();
    }
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, [responsive]);

  useEffect(() => {
    let active = true;
    const payload =
      template.typography_configuration?.qrMode === "verification_json"
        ? JSON.stringify({
            bs_id: data.bs_id,
            name: data.full_name,
            blood_group: data.blood_group,
            contact: data.contact_number,
            org: "Bangladesh Scouts",
          })
        : `BS ID: ${data.bs_id}\nName: ${data.full_name}\nBlood Group: ${data.blood_group}\nContact: ${data.contact_number}\nhttps://scouts.gov.bd`;

    QRCode.toDataURL(payload, {
      width: 300,
      margin: 1,
      errorCorrectionLevel: "H",
      color: { dark: "#000000", light: "#FFFFFF" },
    })
      .then((url) => {
        if (active) setQrDataUrl(url);
      })
      .catch(() => {});

    return () => {
      active = false;
    };
  }, [
    data.bs_id,
    data.full_name,
    data.blood_group,
    data.contact_number,
    template.typography_configuration?.qrMode,
  ]);

  let computedWidth = displayWidth;
  if (responsive && containerWidth > 0) {
    if (side === "both") {
      if (containerWidth >= 560) {
        computedWidth = Math.min(
          Math.floor((containerWidth - 20) / 2),
          maxSideWidth ?? 275
        );
      } else {
        computedWidth = Math.min(containerWidth, maxSideWidth ?? 360);
      }
    } else {
      computedWidth = Math.min(containerWidth, maxSideWidth ?? 390);
    }
    computedWidth = Math.max(220, computedWidth);
  }

  return (
    <div ref={containerRef} className="w-full overflow-x-auto">
      <div className="flex flex-wrap items-start justify-center gap-5 sm:gap-6 min-w-fit mx-auto">
        {(side === "both" || side === "front") &&
          renderSingleSide({
            side: "front",
            data,
            template,
            displayWidth: computedWidth,
            qrDataUrl,
            highlightField,
            qrSealUrl,
          })}
        {(side === "both" || side === "back") &&
          renderSingleSide({
            side: "back",
            data,
            template,
            displayWidth: computedWidth,
            qrDataUrl,
            highlightField,
            qrSealUrl,
          })}
      </div>
    </div>
  );
}
