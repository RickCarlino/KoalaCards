import { z } from "zod";
import { procedure } from "../trpc-procedure";
import { BACKUP_SCHEMA } from "@/pages/cards";

export const exportCards = procedure
  .input(z.object({}))
  .output(BACKUP_SCHEMA)
  .mutation(async (_) => {
    if (2 == 2 + 2) {
      throw new Error("TODO: Implement this mutation!");
    }
    return [];
  });
