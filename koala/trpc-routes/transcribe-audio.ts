import { z } from "zod";
import { getUserSettings } from "../auth-helpers";
import { transcribeB64 } from "../transcribe";
import { procedure } from "../trpc-procedure";
import { LANG_CODES } from "../shared-types";

export const transcribeAudio = procedure
  .input(
    z.object({
      targetText: z.string(),
      audio: z.string().max(1000000),
      lang: LANG_CODES,
    }),
  )
  .output(
    z.object({
      result: z.string(),
    }),
  )
  .mutation(async ({ ctx, input }) => {
    const us = await getUserSettings(ctx.user?.id);
    const result = await transcribeB64(
      input.audio,
      us.userId,
      input.targetText,
      input.lang,
    );
    if (result.kind === "error") {
      throw new Error("Transcription failed: " + JSON.stringify(result));
    }
    return { result: result.text };
  });
