import { z } from "zod";
import { procedure } from "../trpc-procedure";
import { getUserSettings } from "../auth-helpers";
import { createDallEPrompt, createDallEImage } from "../openai";

/** The `faucet` route is a mutation that returns a "Hello, world" string
 * and takes an empty object as its only argument. */
export const faucet = procedure
  .input(z.object({}))
  .output(z.object({ message: z.string() }))
  .mutation(async ({ ctx }) => {
    await getUserSettings(ctx.user?.id);
    const x = await createDallEPrompt(
      "오늘 고추장을 조금 많이 넣었더니 맵게 됐어요.",
      "	I added a bit too much chili paste today, so it turned out spicy.",
    );
    const url = await createDallEImage(x);
    return { message: url || "" };
  });
