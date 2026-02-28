import type { CSSProperties } from "react";

export type ReaderUiIngestStatus =
  | "pending"
  | "in_progress"
  | "ready"
  | "error";

export type ReaderUiLanguage = "ko" | "en" | "other";

export const readerDisplayFont =
  '"Iowan Old Style", "Palatino Linotype", "Book Antiqua", Palatino, serif';

export const readerBodyFont = '"Trebuchet MS", "Segoe UI", sans-serif';

export const readerFrameStyle: CSSProperties = {
  position: "relative",
  borderRadius: 30,
  border: "1px solid #efcedf",
  background:
    "radial-gradient(circle at 7% 0%, rgba(255, 242, 248, 0.95) 0%, rgba(255, 251, 253, 0.96) 45%, rgba(255, 246, 251, 0.95) 100%)",
  boxShadow: "0 24px 48px rgba(189, 120, 151, 0.14)",
  padding: "clamp(16px, 2vw, 28px)",
  overflow: "hidden",
};

export const readerPanelStyle: CSSProperties = {
  borderRadius: 22,
  border: "1px solid #efd3e2",
  background:
    "linear-gradient(170deg, rgba(255,255,255,0.96) 0%, rgba(255,247,251,0.94) 100%)",
  boxShadow: "0 10px 24px rgba(182, 111, 144, 0.12)",
  padding: "clamp(12px, 1.5vw, 18px)",
};

export const readerSubtleCardStyle: CSSProperties = {
  borderRadius: 18,
  border: "1px solid #f1dce8",
  background: "rgba(255, 252, 254, 0.88)",
  padding: "clamp(10px, 1.3vw, 14px)",
};

export const readerDecorStyle: CSSProperties = {
  position: "absolute",
  width: 180,
  height: 180,
  borderRadius: "50%",
  background:
    "radial-gradient(circle, rgba(249, 202, 226, 0.42) 0%, rgba(249, 202, 226, 0) 70%)",
  top: -90,
  right: -70,
  pointerEvents: "none",
};

export function formatReaderDateTime(value: Date): string {
  return value.toLocaleString();
}

export function readerIngestLabel(status: ReaderUiIngestStatus): string {
  if (status === "pending") {
    return "Queued";
  }

  if (status === "in_progress") {
    return "Processing";
  }

  if (status === "ready") {
    return "Ready";
  }

  return "Error";
}

export function readerIngestTone(
  status: ReaderUiIngestStatus,
): "yellow" | "grape" | "teal" | "red" {
  if (status === "pending") {
    return "yellow";
  }

  if (status === "in_progress") {
    return "grape";
  }

  if (status === "ready") {
    return "teal";
  }

  return "red";
}

export function readerLanguageLabel(language: ReaderUiLanguage): string {
  if (language === "ko") {
    return "Korean";
  }

  if (language === "en") {
    return "English";
  }

  return "Other";
}
