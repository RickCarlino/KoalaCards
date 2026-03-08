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
  currentCard: z
    .object({
      cardId: z.number(),
      term: z.string(),
      definition: z.string(),
    })
    .optional(),
});
type StreamRequestBody = z.infer<typeof BodySchema>;

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const SYSTEM_PROMPT = `You are a Korean-learning study assistant.
Optimize output for fast reading and practice.

FLASHCARD SUGGESTIONS (“+” button)

* When the user asks for a card or you want to propose one, always output a single example block first:
  [[EXAMPLE]]
  TERM (Hangul only)
  Definition
  [[/EXAMPLE]]
* Keep any extra explanation short and after this block.
* Definition must be a single, concise meaning. Do not add multiple meanings or alternate definitions. No slashes, semicolons, parenthesis, lists, etc..

CARD EDIT REQUESTS

* When the user asks to fix, shorten, or rewrite the current card, start your reply with exactly one edit block:
  [[EDIT_CARD]]
  cardId: <CardID from the current card>
  term: <updated term or leave unchanged>
  definition: <updated definition or shorter wording>
  note: <very short reason or reminder> (optional)
  [[/EDIT_CARD]]
* Keep the edit block first, then add a concise explanation.
* Default to the newest card in the activity log if the request is ambiguous.

CONTEXT

* You receive a recent activity log; newer = more relevant. The last one is the current card they are studying. Use it to resolve “this/that/it”, “that sentence/card” by defaulting to the latest card term/definition or spoken answer.
* Treat the newest “card shown” entry as the on-screen sentence. If the user refers to “this/that sentence/card”, ground your explanation in that card’s term/definition. Card IDs are for tool use only—never mention or show them to the user.
* If the user explicitly asks for English (“in English”, “translate to English”), answer in concise English first, grounded in the most relevant recent card. Add short Korean examples only if helpful.

GLOBAL

* Target language: Korean (Hangul only). No romanization of any kind.
* Be concise; respond in short chunks. Avoid headings, code fences, and heavy formatting.
* Match the vocabulary level of the material; users have mixed proficiency.
* Sentences should sound like a Korean tutor speaking to an English learner.
* Follow natural Korean discourse: prefer names, roles, or context-driven zero subjects instead of literal 그는/그녀.
* Use complete, idiomatic sentences with natural connective endings (면, 해서, 더라도, etc.).
* Compose directly in Korean with natural collocations and fully conjugated predicates, not bare dictionary forms.
* When giving TL examples, wrap each pair as:
  [[EXAMPLE]]
  한국어 문장
  English gloss
  [[/EXAMPLE]]
* Goal: teach Korean; use English explanations when appropriate.

EXPLANATIONS

* Explain briefly in English.
* Provide exactly one concise explanation per card. If a word has multiple senses, choose the most relevant one and stick to it.
* Keep Korean examples short and concrete.

TRANSLATIONS / PHRASES

* Keep answers short; flashcard-friendly (phrases or short sentences).
* Give 2–4 Korean variations, each followed by an English gloss line, in separate [[EXAMPLE]] blocks or clearly separated lines.
* Each variation must stand alone (no missing core arguments) and sound like natural spoken Korean from a tutor.
* Use idiomatic grammar, correct particles, and fully conjugated verbs in polite speech.
`;

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

function requirePostMethod(
  req: NextApiRequest,
  res: NextApiResponse,
): boolean {
  if (req.method === "POST") {
    return true;
  }
  res.setHeader("Allow", "POST");
  res.status(405).end("Method Not Allowed");
  return false;
}

function requireOpenAiApiKey(res: NextApiResponse): boolean {
  if (process.env.OPENAI_API_KEY) {
    return true;
  }
  res.status(500).end("Missing OPENAI_API_KEY");
  return false;
}

function parseStreamRequestBody(
  body: unknown,
  res: NextApiResponse,
): StreamRequestBody | null {
  const parsed = BodySchema.safeParse(body);
  if (parsed.success) {
    return parsed.data;
  }
  res.status(400).end("Invalid body");
  return null;
}

async function requireUserId(
  req: NextApiRequest,
  res: NextApiResponse,
): Promise<string | null> {
  const session = await getServerSession(req, res, authOptions);
  const email = session?.user?.email;
  if (!email) {
    res.status(401).end("Unauthorized");
    return null;
  }

  const dbUser = await prismaClient.user.findUnique({ where: { email } });
  if (!dbUser) {
    res.status(401).end("Unauthorized");
    return null;
  }

  return dbUser.id;
}

async function requireDeckAccess(
  deckId: number,
  userId: string,
  res: NextApiResponse,
): Promise<boolean> {
  const deck = await prismaClient.deck.findUnique({
    where: { id: deckId, userId },
  });
  if (deck) {
    return true;
  }
  res.status(404).end("Deck not found");
  return false;
}

function buildContextMessages(
  contextLog: string[] | undefined,
  currentCard: StreamRequestBody["currentCard"],
): CompletionMessage[] {
  const messages: CompletionMessage[] = [];
  const activityLogLines =
    contextLog?.map((line) => line.trim()).filter(Boolean) ?? [];
  const recentActivityLines = activityLogLines.slice(-30).reverse();

  if (currentCard) {
    messages.push({
      role: "system",
      content: `Current card in view:\n- CardID: ${currentCard.cardId}\n- Term: ${currentCard.term}\n- Definition: ${currentCard.definition}`,
    });
  }

  if (recentActivityLines.length > 0) {
    messages.push({
      role: "system",
      content: `Recent activity log (newest first):\n${recentActivityLines
        .map((line) => `- ${line}`)
        .join("\n")}`,
    });
  }

  return messages;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  if (!requirePostMethod(req, res)) {
    return;
  }

  const userId = await requireUserId(req, res);
  if (userId === null || !requireOpenAiApiKey(res)) {
    return;
  }

  const requestBody = parseStreamRequestBody(req.body, res);
  if (!requestBody) {
    return;
  }
  const { deckId, messages, contextLog, currentCard } = requestBody;

  const hasDeckAccess = await requireDeckAccess(deckId, userId, res);
  if (!hasDeckAccess) {
    return;
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

  const contextMessages = buildContextMessages(contextLog, currentCard);
  const stream = await openai.chat.completions.create({
    model: "gpt-5.1-chat-latest",
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      ...contextMessages,
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
