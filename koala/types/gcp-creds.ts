export type GcpCreds = { project_id: string } & Record<string, unknown>;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export function isGcpCreds(value: unknown): value is GcpCreds {
  if (!isRecord(value)) {
    return false;
  }
  const projectId = value["project_id"];
  return typeof projectId === "string" && projectId.length > 0;
}
