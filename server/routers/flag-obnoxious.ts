import { z } from "zod";
import { procedure } from "../trpc";

/** Flag cards that are leeches or excessively hard. */
export const flagObnoxious = procedure
  .input(z.object({}))
  .output(z.object({ message: z.string() }))
  .mutation(async (_) => {
    return {
      message: "TODO: Implement flagObnoxious",
    };
  });
