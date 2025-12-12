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

const SYSTEM_PROMPT = `You are a Korean-learning study assistant.
Optimize output for fast reading and practice.

FLASHCARD SUGGESTIONS (“+” button)

* When the user asks for a card or you want to propose one, always output a single example block first:
  [[EXAMPLE]]
  TERM (Hangul only)
  Definition
  [[/EXAMPLE]]
* Keep any extra explanation short and after this block.

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
* Keep Korean examples short and concrete.

TRANSLATIONS / PHRASES

* Keep answers short; flashcard-friendly (phrases or short sentences).
* Give 2–4 Korean variations, each followed by an English gloss line, in separate [[EXAMPLE]] blocks or clearly separated lines.
* Each variation must stand alone (no missing core arguments) and sound like natural spoken Korean from a tutor.
* Use idiomatic grammar, correct particles, and fully conjugated verbs in polite speech.
`;

function getOpenAI() {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return null;
  }
  return new OpenAI({ apiKey });
}

function writeSse(res: NextApiResponse, data: string, event?: string) {
  if (event) {
    res.write(`event: ${event}\n`);
  }
  for (const line of data.split("\n")) {
    res.write(`data: ${line}\n`);
  }
  res.write("\n");
}

function toActivityLogMessage(
  contextLog: string[] | undefined,
): CompletionMessage | null {
  const trimmed =
    contextLog?.map((line) => line.trim()).filter(Boolean) ?? [];
  if (trimmed.length === 0) {
    return null;
  }
  const recent = trimmed.slice(-30).reverse();
  return {
    role: "system",
    content: `Recent activity log (newest first):\n${recent
      .map((line) => `- ${line}`)
      .join("\n")}`,
  };
}

function toCurrentCardMessage(
  currentCard:
    | {
        cardId: number;
        term: string;
        definition: string;
      }
    | undefined,
): CompletionMessage | null {
  if (!currentCard) {
    return null;
  }
  return {
    role: "system",
    content: `Current card in view:\n- CardID: ${currentCard.cardId}\n- Term: ${currentCard.term}\n- Definition: ${currentCard.definition}`,
  };
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

  const openai = getOpenAI();
  if (!openai) {
    return res.status(500).end("Missing OPENAI_API_KEY");
  }

  const parsed = BodySchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).end("Invalid body");
  }
  const { deckId, messages, contextLog, currentCard } = parsed.data;

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

  const activityLogMessage = toActivityLogMessage(contextLog);
  const currentCardMessage = toCurrentCardMessage(currentCard);

  const stream = await openai.chat.completions.create({
    model: "gpt-5.1-chat-latest",
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      ...(currentCardMessage ? [currentCardMessage] : []),
      ...(activityLogMessage ? [activityLogMessage] : []),
      ...messages,
    ],
    stream: true,
  });

  for await (const part of stream) {
    if (closed) {
      break;
    }
    const chunk = part.choices?.[0]?.delta?.content || "";
    if (chunk) {
      writeSse(res, chunk);
    }
  }

  writeSse(res, "done", "done");
  res.end();
}
