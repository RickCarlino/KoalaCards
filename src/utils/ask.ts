import { CreateCompletionRequest } from "openai";
import { openai } from "./openai";

type AskOpts = Partial<CreateCompletionRequest>;

export async function ask(prompt: string, opts: AskOpts = {}) {
  const resp = await openai.createCompletion({
    model: opts.model ?? "text-davinci-003",
    prompt,
    temperature: opts.temperature ?? 0.15,
    max_tokens: opts.max_tokens ?? 1024,
    n: opts.n ?? 1,
    best_of: opts.best_of ?? 2,
  });

  return resp.data.choices
    .filter((x) => x.finish_reason === "stop")
    .map((x) => x.text);
}
