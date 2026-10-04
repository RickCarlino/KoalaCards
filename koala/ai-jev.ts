export type JevQuestion = {
  type: "choice" | "noul";
  instructions: string;
  criteria: Record<string, string>;
};

export type JevRequest = {
  model: string;
  state: Record<string, string>;
  questions: Record<string, JevQuestion>;
};

export class JevApiError extends Error {
  constructor(public readonly status: number) {
    super(`Jev request failed (HTTP ${status}).`);
  }
}

type JevOptions = {
  apiKey: string;
  fetchImplementation?: typeof fetch;
};

export const requireJevApiKey = (apiKey: string) => {
  if (!apiKey.trim() || apiKey.trim() === "0000") {
    throw new Error("Set TYPESAFE_API_KEY to enable JEV grading.");
  }
};

export async function evaluateJev(
  request: JevRequest,
  options: JevOptions,
): Promise<unknown> {
  requireJevApiKey(options.apiKey);
  const send = options.fetchImplementation ?? fetch;
  const response = await send("https://api.typesafe.ai/v1/systemone", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${options.apiKey.trim()}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(request),
    signal: AbortSignal.timeout(10_000),
  });
  if (response.ok) {
    return await response.json();
  }
  await response.body?.cancel();
  throw new JevApiError(response.status);
}
