import { z } from "zod";
import { transcribeB64 } from "../transcribe";
import { procedure } from "../trpc-procedure";
import { LANG_CODES } from "./bulk-create-cards";
import { getUserSettings } from "../auth-helpers";
import { errorReport } from "../error-report";

export const transcribeAudio = procedure
  .input(
    z.object({
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
    const result = await transcribeB64(input.lang, input.audio, us.userId);

    if (result.kind !== "OK") {
      return errorReport('result.kind !== "OK"');
    }

    return { result: result.text };
  });
