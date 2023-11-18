import { z } from "zod";
import { procedure } from "../trpc";
import { getUserSettings as gus } from "../auth-helpers";

export const getUserSettings = procedure
  .input(z.object({}))
  .mutation(async ({ ctx }) => {
    return await gus(ctx.user?.id);
  });
