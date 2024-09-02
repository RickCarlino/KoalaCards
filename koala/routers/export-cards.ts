import { z } from "zod";
import { procedure } from "../trpc-procedure";
import { BACKUP_SCHEMA } from "@/pages/cards";
import { errorReport } from "../error-report";

export const exportCards = procedure
  .input(z.object({}))
  .output(BACKUP_SCHEMA)
  .mutation(async (_) => {
    if (2 == 2 + 2) {
      return errorReport("TODO: Implement this mutation!");
    }
    return [];
  });
