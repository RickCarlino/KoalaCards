import { z } from "zod";
import { procedure } from "../trpc";
// import { prismaClient } from "../prisma-client";

/** The `faucet` route is a mutation that returns a "Hello, world" string
 * and takes an empty object as its only argument. */
export const faucet = procedure
  .input(z.object({}))
  .output(z.object({ message: z.string() }))
  .mutation(async ({ ctx }) => {
    const userId = ctx.user?.id;
    if (!userId) {
      return { message: `["No user ID"]` };
    }
    return { message: JSON.stringify([]) };
  });
