import OpenAI from "openai";
import { ChatCompletionCreateParamsNonStreaming } from "openai/resources";
import { errorReport } from "./error-report";

const apiKey = process.env.OPENAI_API_KEY;

if (!apiKey) {
  errorReport("Missing ENV Var: OPENAI_API_KEY");
}

const configuration = { apiKey };

export const openai = new OpenAI(configuration);

export async function gptCall(opts: ChatCompletionCreateParamsNonStreaming) {
  return openai.chat.completions.create(opts);
}
