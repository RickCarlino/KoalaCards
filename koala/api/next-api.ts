import type { NextApiRequest, NextApiResponse } from "next";

type ErrorBody = { error: string };
type ResponseMode = "json" | "text";

function rejectMethod(
  res: NextApiResponse,
  method: string,
  mode: ResponseMode,
): boolean {
  res.setHeader("Allow", method);
  if (mode === "json") {
    res
      .status(405)
      .json({ error: "Method Not Allowed" } satisfies ErrorBody);
    return false;
  }

  res.status(405).end("Method Not Allowed");
  return false;
}

export function requireApiMethod(
  req: NextApiRequest,
  res: NextApiResponse,
  method: "GET" | "POST",
  mode: ResponseMode,
): boolean {
  if (req.method === method) {
    return true;
  }

  return rejectMethod(res, method, mode);
}

export function requireJsonPostMethod(
  req: NextApiRequest,
  res: NextApiResponse,
): boolean {
  return requireApiMethod(req, res, "POST", "json");
}

export function requireJsonGetMethod(
  req: NextApiRequest,
  res: NextApiResponse,
): boolean {
  return requireApiMethod(req, res, "GET", "json");
}

export function requireTextPostMethod(
  req: NextApiRequest,
  res: NextApiResponse,
): boolean {
  return requireApiMethod(req, res, "POST", "text");
}

export function requireJsonOpenAiApiKey(res: NextApiResponse): boolean {
  if (process.env.OPENAI_API_KEY) {
    return true;
  }

  res
    .status(500)
    .json({ error: "Missing OPENAI_API_KEY" } satisfies ErrorBody);
  return false;
}

export function requireTextOpenAiApiKey(res: NextApiResponse): boolean {
  if (process.env.OPENAI_API_KEY) {
    return true;
  }

  res.status(500).end("Missing OPENAI_API_KEY");
  return false;
}

export function setNoStore(res: NextApiResponse): void {
  res.setHeader("Cache-Control", "no-store");
}
