export function getStudyReportPath(token: string): string {
  return `/api/study-report/${encodeURIComponent(token)}`;
}
