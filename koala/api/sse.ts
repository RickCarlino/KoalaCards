import type { NextApiResponse } from "next";

export function writeSSE(
  res: NextApiResponse,
  data: string,
  event?: string,
): void {
  if (event) {
    res.write(`event: ${event}\n`);
  }

  const lines = data.split("\n");
  for (const line of lines) {
    res.write(`data: ${line}\n`);
  }

  res.write("\n");
}
