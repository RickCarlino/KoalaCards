import { z } from "zod";
import { procedure } from "../trpc";
import { BACKUP_SCHEMA } from "@/pages/cards";

export const importCards = procedure
  .input(BACKUP_SCHEMA)
  .output(z.object({ count: z.number() }))
  .mutation(async (_) => {
    return { count: -1 };
  });
