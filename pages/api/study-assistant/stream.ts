import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth";
import { authOptions } from "../auth/[...nextauth]";
import OpenAI from "openai";
import { prismaClient } from "@/koala/prisma-client";
import { z } from "zod";
import { generateStructuredOutput, type CoreMessage } from "@/koala/ai";

// Keep this feature isolated: single API route, no changes elsewhere.

export const config = {
  api: {
    bodyParser: true,
  },
};

type ChatMessage = { role: "user" | "assistant"; content: string };

const BodySchema = z.object({
  deckId: z.number(),
  // Minimal current context
  current: z.object({
    term: z.string(),
    definition: z.string(),
    langCode: z.string(),
    lessonType: z
      .union([
        z.literal("speaking"),
        z.literal("new"),
        z.literal("remedial"),
      ])
      .optional(),
  }),
  // Existing chat transcript (last N turns). Keep it small on the client.
  messages: z.array(
    z.object({
      role: z.union([z.literal("user"), z.literal("assistant")]),
      content: z.string(),
    }),
  ),
});

const SuggestionSchema = z.object({
  phrase: z.string().max(160),
  translation: z.string().max(200),
  gender: z.union([z.literal("M"), z.literal("F"), z.literal("N")]),
});

const SuggestionsSchema = z.object({
  suggestions: z.array(SuggestionSchema).max(5),
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
  const { deckId, current, messages } = parsed.data;

  // Verify deck ownership
  const deck = await prismaClient.deck.findUnique({
    where: { id: deckId, userId: dbUser.id },
  });
  if (!deck) {
    return res.status(404).end("Deck not found");
  }

  // Prepare SSE response
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
- If you present examples: put the TL sentence first (Hangul), then an English gloss on the next line.
- Your goal is to teach Korean, but you can explain in English when appropriate.

EXPLANATION REQUESTS:
- Explain briefly in English, but keep TL examples short and concrete.

TRANSLATION/PHRASES REQUESTS:
- Keep it short. Phrases can be phrases, sentence fragments, or full sentences as appropriate. Long sentences are not useful since this is a flashcard app.
- Provide 2-4 variations in Korean with the follow-up English gloss lines.
- Each variation must stand on its own (no missing subjects or objects) and read like speech from a native Korean tutor.
- Treat each variation as something you would naturally say in Korean. Use idiomatic grammar, correct particles, and fully conjugated verbs suited to polite speech.
`;

  // Compact context message (kept tiny for latency)
  const contextAsUser: ChatMessage = {
    role: "user",
    content: `Context:\n- Current term: ${current.term}\n- Definition: ${current.definition}\n- Language: Korean (ko)${current.lessonType ? `\n- Lesson type: ${current.lessonType}` : ""}`,
  };

  const stream = await openai.chat.completions.create({
    model: "gpt-5.1-chat-latest",
    messages: [
      { role: "system", content: system },
      contextAsUser,
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

  // Suggestions: run a quick structured output call, then emit as a separate event
  const suggestPrompt: CoreMessage[] = [
    {
      role: "system",
      content: `You generate compact flashcard suggestions for a Korean deck.
Rules:
- TL is Korean (Hangul only) with no romanization.
- Return up to 5 useful, high-frequency phrases that reuse or collocate with the key vocab "${current.term}" when appropriate.
- Keep every phrase native-sounding (CEFR B1-C2) and under 120 characters, using Korean-style subject omission or concrete roles/names instead of literal third-person pronouns.
- Compose each phrase directly in Korean with idiomatic collocations, fully conjugated predicates, and correct particles—treat it like natural speech, not a translation draft.
- Provide a succinct English translation.
- Although Korean has no grammatical gender, the gender field powers TTS voice variety—cycle through M/F/N thoughtfully.
- Output only data; no extra text.`,
    },
    {
      role: "user",
      content: `Key vocab: ${current.term}\nDefinition: ${current.definition}\nUser goal: ${messages[messages.length - 1]?.content ?? ""}`,
    },
  ];

  const result = await generateStructuredOutput({
    model: ["openai", "fast"],
    messages: suggestPrompt,
    schema: SuggestionsSchema,
    maxTokens: 400,
  });
  const limited = {
    suggestions: (result?.suggestions ?? []).slice(0, 5),
  };
  writeSSE(res, JSON.stringify(limited), "suggestions");

  writeSSE(res, "done", "done");
  res.end();
}
