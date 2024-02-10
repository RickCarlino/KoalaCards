import { z } from "zod";
import { procedure } from "../trpc";

export const deleteFlaggedCards = procedure
  .input(z.object({}))
  .mutation(async (_) => {});
