import { draw } from "radash";
import { z } from "zod";
import { getUserSettings } from "../auth-helpers";
import { procedure } from "../trpc-procedure";
import { generateSpeechURL } from "../generate-speech-url";

const LANG_CODES = z.union([
  z.literal("en"),
  z.literal("es"),
  z.literal("fr"),
  z.literal("it"),
  z.literal("ko"),
]);

export const speakText = procedure
  .input(
    z.object({
      text: z.string().max(1000000),
      lang: LANG_CODES,
    }),
  )
  .output(
    z.object({
      url: z.string(),
    }),
  )
  .mutation(async ({ ctx, input }) => {
    await getUserSettings(ctx.user?.id);
    const url = await generateSpeechURL({
      text: input.text,
      langCode: input.lang,
      gender: draw(["F", "M", "N"] as const) || "N",
    });
    return { url };
  });
