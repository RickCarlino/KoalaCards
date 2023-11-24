import { z } from "zod";
import { procedure } from "../trpc";
import { getUserSettings as gus } from "../auth-helpers";

export const getUserSettings = procedure
  .input(z.object({}))
  .mutation(async ({ ctx }) => {
    try {
      const id = ctx.user?.id;
      if (id) {
        return await gus(id);
      } else {
        return null;
      }
    } catch (error) {
      return null;
    }
  });
