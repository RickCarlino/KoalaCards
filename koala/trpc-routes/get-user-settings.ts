import { z } from "zod";
import { procedure } from "../trpc-procedure";
import { getUserSettings as gus } from "../auth-helpers";

export const getUserSettings = procedure
  .input(z.object({}))
  .mutation(async ({ ctx }) => {
    const id = ctx.user?.id;
    if (id) {
      return await gus(id);
    } else {
      return null;
    }
  });
