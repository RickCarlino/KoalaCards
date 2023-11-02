import { z } from "zod";
import { procedure } from "../trpc";

/** The `faucet` route is a mutation that returns a "Hello, world" string
 * and takes an empty object as its only argument. */
export const faucet = procedure
  .input(z.object({}))
  .output(z.object({ message: z.string() }))
  .mutation(async () => {
    return { message: "[]" };
  });
