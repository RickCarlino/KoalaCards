export function getStudyReportPath(token: string): string {
  return `/api/study-report/${encodeURIComponent(token)}`;
}

export function getMcpPath(token: string): string {
  return `/api/mcp/${encodeURIComponent(token)}`;
}
