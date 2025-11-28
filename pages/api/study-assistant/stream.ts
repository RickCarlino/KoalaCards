import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth";
import { authOptions } from "../auth/[...nextauth]";
import OpenAI from "openai";
import { prismaClient } from "@/koala/prisma-client";
import { z } from "zod";

export const config = {
  api: {
    bodyParser: true,
  },
};

type CompletionMessage =
  OpenAI.Chat.Completions.ChatCompletionMessageParam;

const BodySchema = z.object({
  deckId: z.number(),
  messages: z.array(
    z.object({
      role: z.union([z.literal("user"), z.literal("assistant")]),
      content: z.string(),
    }),
  ),
  contextLog: z.array(z.string().max(240)).max(30).optional(),
});

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

function writeSSE(res: NextApiResponse, data: string, event?: string) {
  if (event) {
    res.write(`event: ${event}\n`);
  }
  const lines = data.split("\n");
  for (const line of lines) {
    res.write(`data: ${line}\n`);
  }
  res.write("\n");
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).end("Method Not Allowed");
  }

  const session = await getServerSession(req, res, authOptions);
  const email = session?.user?.email;
  if (!email) {
    return res.status(401).end("Unauthorized");
  }

  const dbUser = await prismaClient.user.findUnique({ where: { email } });
  if (!dbUser) {
    return res.status(401).end("Unauthorized");
  }

  if (!process.env.OPENAI_API_KEY) {
    return res.status(500).end("Missing OPENAI_API_KEY");
  }

  const parsed = BodySchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).end("Invalid body");
  }
  const { deckId, messages, contextLog } = parsed.data;

  const deck = await prismaClient.deck.findUnique({
    where: { id: deckId, userId: dbUser.id },
  });
  if (!deck) {
    return res.status(404).end("Deck not found");
  }

  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache, no-transform",
    Connection: "keep-alive",
  });

  let closed = false;
  req.on("close", () => {
    closed = true;
  });

  const system = `You are a Korean-learning study assistant.
Output should be optimized for fast reading and practice.

FLASHCARD SUGGESTIONS (for the “+” button):
- When the user asks for a card or you want to propose one, always emit a [[EXAMPLE]] block so the app can show the add button.
- Format: [[EXAMPLE]]<newline>TERM (Hangul only)<newline>Definition<newline>[[/EXAMPLE]].
- Put the block first and keep any extra explanation short and after the block only when necessary.

CONTEXT HANDLING:
- You receive a recent activity log; newer entries are more relevant. Use it to resolve references like "this/that/it", "that sentence", or "that card" by defaulting to the latest card term/definition or spoken answer.
- When a user explicitly asks for English (e.g., "in English", "translate to English"), give a concise English response first, grounded in the latest relevant card. Keep Korean examples short and only when helpful.

GLOBAL RULES:
- Target language (TL): Korean (Hangul only).
- Output Hangul only—no romanization (RR, Yale, McCune-Reischauer, phonetic hints).
- Be concise and stream short chunks.
- Avoid headings, code fences, and heavy formatting.
- Mirror the vocabulary level of the material. Students will have a diverse range of proficiency.
- Produce native Korean sentences that sound like they came from a Korean tutor speaking to an English learner.
- Follow standard Korean discourse conventions: prefer names, roles, or context-driven zero subjects over literal third-person pronouns (그는/그녀); keep references natural and situation-specific.
- Use grammatically complete, idiomatic sentences. Favor clear connective endings (e.g., -면, -해서, -더라도) instead of literal translations of English conjunctions.
- Compose each sentence directly in Korean, using natural collocations and fully conjugated predicates rather than bare dictionary forms.
- If you present examples: wrap each pair inside [[EXAMPLE]]...[[/EXAMPLE]] with the TL sentence (Hangul only) on one line and the English gloss on the next line, e.g. [[EXAMPLE]]<newline>한국어 문장<newline>English gloss<newline>[[/EXAMPLE]].
- Your goal is to teach Korean, but you can explain in English when appropriate.

EXPLANATION REQUESTS:
- Explain briefly in English, but keep TL examples short and concrete.

TRANSLATION/PHRASES REQUESTS:
- Keep it short. Phrases can be phrases, sentence fragments, or full sentences as appropriate. Long sentences are not useful since this is a flashcard app.
- Provide 2-4 variations in Korean with the follow-up English gloss lines.
- Each variation must stand on its own (no missing subjects or objects) and read like speech from a native Korean tutor.
- Treat each variation as something you would naturally say in Korean. Use idiomatic grammar, correct particles, and fully conjugated verbs suited to polite speech.
`;

  const activityLogLines =
    contextLog?.map((line) => line.trim()).filter(Boolean) ?? [];

  const recentActivityLines = activityLogLines.slice(-30).reverse();
  const activityLogMessage: CompletionMessage | null =
    recentActivityLines.length > 0
      ? {
          role: "system",
          content: `Recent activity log (newest first):\n${recentActivityLines
            .map((line) => `- ${line}`)
            .join("\n")}`,
        }
      : null;

  const stream = await openai.chat.completions.create({
    model: "gpt-5.1-chat-latest",
    messages: [
      { role: "system", content: system },
      ...(activityLogMessage ? [activityLogMessage] : []),
      ...messages,
    ],
    stream: true,
  });

  let _full = "";
  for await (const part of stream) {
    if (closed) {
      break;
    }
    const chunk = part.choices?.[0]?.delta?.content || "";
    if (chunk) {
      _full += chunk;
      writeSSE(res, chunk);
    }
  }

  writeSSE(res, "done", "done");
  res.end();
}
