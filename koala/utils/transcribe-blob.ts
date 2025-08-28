import { LangCode } from "@/koala/shared-types";

export async function transcribeBlob(
  blob: Blob,
  language: LangCode,
  hint?: string,
): Promise<string> {
  const hintParam = hint ? `&hint=${encodeURIComponent(hint)}` : "";
  const res = await fetch(
    `/api/transcribe?language=${encodeURIComponent(language)}${hintParam}`,
    {
      method: "POST",
      headers: { "Content-Type": blob.type || "application/octet-stream" },
      body: blob,
    },
  );

  if (!res.ok) {
    const msg = await res.text();
    throw new Error(msg || `HTTP ${res.status}`);
  }

  const json: { text?: string } = await res.json();
  return json.text ?? "";
}
