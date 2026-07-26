import type { CSSProperties } from "react";

export type ReaderUiIngestStatus =
  | "pending"
  | "in_progress"
  | "ready"
  | "error";

export const readerDisplayFont = "inherit";
export const readerBodyFont = "inherit";
export const readerHeadingColor = "#2f2630";
export const readerMutedColor = "#5d4d58";
export const readerAccentColor = "#b84b73";
export const readerAccentStrongColor = "#a83e66";
export const readerSuccessColor = "#2e8f63";
export const readerWarningColor = "#ab6a20";
export const readerErrorColor = "#c54268";
export const readerSurfaceBackgroundColor = "#ffffff";
export const readerSubtleBackgroundColor = "#fff7fb";
export const readerFrameBorderColor = "#efcedf";
export const readerPanelBorderColor = "#efd3e2";
export const readerDividerColor = "#efd8e4";
export const readerSurfaceShadow = "0 1px 3px rgba(0, 0, 0, 0.04)";
export const readerFrameShadow = "0 2px 6px rgba(0, 0, 0, 0.05)";
export const readerPageSectionGap = "clamp(12px, 1.8vw, 18px)";
export const readerPanelGap = "clamp(10px, 1.2vw, 14px)";

export const readerPageContainerStyle: CSSProperties = {
  marginTop: "clamp(10px, 2.4vw, 24px)",
  marginBottom: "clamp(18px, 3vw, 32px)",
  paddingInline: "clamp(10px, 2.6vw, 22px)",
};

export const readerFrameStyle: CSSProperties = {
  position: "relative",
  borderRadius: 16,
  border: `1px solid ${readerFrameBorderColor}`,
  backgroundColor: readerSurfaceBackgroundColor,
  boxShadow: readerFrameShadow,
  padding: "clamp(12px, 1.8vw, 20px)",
  overflow: "hidden",
};

export const readerPanelStyle: CSSProperties = {
  borderRadius: 12,
  border: `1px solid ${readerPanelBorderColor}`,
  backgroundColor: readerSurfaceBackgroundColor,
  boxShadow: readerSurfaceShadow,
  padding: "clamp(10px, 1.5vw, 16px)",
};

export const readerSubtleCardStyle: CSSProperties = {
  borderRadius: 10,
  border: `1px solid ${readerDividerColor}`,
  backgroundColor: readerSubtleBackgroundColor,
  padding: "clamp(10px, 1.4vw, 14px)",
};

export const readerDecorStyle: CSSProperties = {
  display: "none",
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
  borderTop: `1px solid ${readerDividerColor}`,
};

const readerDateTimeFormatter = new Intl.DateTimeFormat(undefined, {
  dateStyle: "medium",
  timeStyle: "short",
});

export function readerListRowStyle(withDivider: boolean): CSSProperties {
  if (withDivider) {
    return readerListRowWithDividerStyle;
  }

  return readerListRowBaseStyle;
}

export function formatReaderDateTime(value: Date): string {
  return readerDateTimeFormatter.format(value);
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
