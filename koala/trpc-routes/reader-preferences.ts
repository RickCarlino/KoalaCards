import { z } from "zod";
import { prismaClient } from "@/koala/prisma-client";
import { READER_PREFERENCE_LIMITS } from "@/koala/reader/preferences";
import { procedure } from "../trpc-procedure";
import { requireReaderUserId } from "./reader-server";

const updateReaderPreferencesInputSchema = z.object({
  fontSize: z
    .number()
    .int()
    .min(READER_PREFERENCE_LIMITS.fontSize.min)
    .max(READER_PREFERENCE_LIMITS.fontSize.max),
  lineHeight: z
    .number()
    .min(READER_PREFERENCE_LIMITS.lineHeight.min)
    .max(READER_PREFERENCE_LIMITS.lineHeight.max),
  readingWidth: z
    .number()
    .int()
    .min(READER_PREFERENCE_LIMITS.readingWidth.min)
    .max(READER_PREFERENCE_LIMITS.readingWidth.max),
});

const updateReaderPreferencesOutputSchema = z.object({
  status: z.literal("updated"),
});

export const updateReaderPreferencesRoute = procedure
  .input(updateReaderPreferencesInputSchema)
  .output(updateReaderPreferencesOutputSchema)
  .mutation(async ({ input, ctx }) => {
    const userId = requireReaderUserId(ctx.user?.id);
    await prismaClient.userSettings.update({
      where: { userId },
      data: {
        readerFontSize: input.fontSize,
        readerLineHeight: input.lineHeight,
        readerReadingWidth: input.readingWidth,
      },
    });

    return { status: "updated" };
  });
