import type { CSSProperties } from "react";

export type ReaderUiIngestStatus =
  | "pending"
  | "in_progress"
  | "ready"
  | "error";

export const readerDisplayFont =
  '"Iowan Old Style", "Palatino Linotype", "Book Antiqua", Palatino, serif';

export const readerBodyFont = '"Trebuchet MS", "Segoe UI", sans-serif';
export const readerHeadingColor = "#4f3241";
export const readerMutedColor = "#745462";
export const readerPageSectionGap = "clamp(14px, 2vw, 22px)";
export const readerPanelGap = "clamp(10px, 1.2vw, 14px)";

export const readerPageContainerStyle: CSSProperties = {
  marginTop: "clamp(10px, 2.4vw, 32px)",
  marginBottom: "clamp(20px, 3.4vw, 44px)",
  paddingInline: "clamp(10px, 2.8vw, 26px)",
};

export const readerFrameStyle: CSSProperties = {
  position: "relative",
  borderRadius: 28,
  border: "1px solid #efcedf",
  background:
    "radial-gradient(circle at 10% -5%, rgba(252, 223, 238, 0.72) 0%, rgba(255, 250, 253, 0.97) 42%, rgba(255, 246, 251, 0.95) 100%)",
  boxShadow: "0 20px 42px rgba(186, 118, 149, 0.13)",
  padding: "clamp(14px, 2vw, 24px)",
  overflow: "hidden",
};

export const readerPanelStyle: CSSProperties = {
  borderRadius: 20,
  border: "1px solid #efd3e2",
  background:
    "linear-gradient(170deg, rgba(255, 255, 255, 0.97) 0%, rgba(255, 247, 251, 0.95) 100%)",
  boxShadow: "0 8px 20px rgba(182, 111, 144, 0.11)",
  padding: "clamp(12px, 1.7vw, 20px)",
};

export const readerSubtleCardStyle: CSSProperties = {
  borderRadius: 18,
  border: "1px solid #f1dce8",
  background: "rgba(255, 252, 254, 0.9)",
  padding: "clamp(10px, 1.4vw, 15px)",
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

export const readerPanelTitleStyle: CSSProperties = {
  color: readerHeadingColor,
  fontFamily: readerBodyFont,
  fontWeight: 700,
  letterSpacing: "0.01em",
};

export const readerPanelSubtitleStyle: CSSProperties = {
  color: readerMutedColor,
  fontFamily: readerBodyFont,
  maxWidth: 700,
};

const readerListRowBaseStyle: CSSProperties = {
  gap: "clamp(8px, 1.2vw, 12px)",
};

const readerListRowWithDividerStyle: CSSProperties = {
  ...readerListRowBaseStyle,
  marginTop: "clamp(8px, 1vw, 12px)",
  paddingTop: "clamp(12px, 1.3vw, 16px)",
  borderTop: "1px solid #efd8e4",
};

export function readerListRowStyle(withDivider: boolean): CSSProperties {
  if (withDivider) {
    return readerListRowWithDividerStyle;
  }

  return readerListRowBaseStyle;
}

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
