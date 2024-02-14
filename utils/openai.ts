import { prismaClient } from "@/server/prisma-client";
import { superUsers } from "@/server/trpc";
import OpenAI from "openai";
import { ChatCompletionCreateParamsNonStreaming } from "openai/resources";
import { errorReport } from "./error-report";

let approvedUserIDs: string[] = [];
(() =>
  prismaClient.user.findMany({}).then((users) => {
    users.map((user) => {
      const { email, id, lastSeen } = user;
      const daysAgo = lastSeen
        ? (Date.now() - lastSeen.getTime()) / (1000 * 60 * 60 * 24)
        : -1;
      if (!email) {
        console.log("=== No email for user " + id);
        return;
      }
      if (superUsers.includes(email)) {
        approvedUserIDs.push(id);
      }
      console.log(`=== ${email} / ${id} (last seen ${daysAgo} days ago)`);
    });
  }))();

const apiKey = process.env.OPENAI_API_KEY;

if (!apiKey) {
  errorReport("Missing ENV Var: OPENAI_API_KEY");
}

const configuration = { apiKey };

export const openai = new OpenAI(configuration);

export async function gptCall(opts: ChatCompletionCreateParamsNonStreaming) {
  return openai.chat.completions.create(opts);
}
