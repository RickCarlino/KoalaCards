import * as trpcNext from "@trpc/server/adapters/next";
import { appRouter } from "../../../server/routers/_app";
import { getServerSession } from "next-auth";
import { authOptions } from "../auth/[...nextauth]";

export default trpcNext.createNextApiHandler({
  router: appRouter,
  createContext: async (_opts) => {
    return {
      session:
        (await getServerSession(_opts.req, _opts.res, authOptions)) || null,
    };
  },
});
