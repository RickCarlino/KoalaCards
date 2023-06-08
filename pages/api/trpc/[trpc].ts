import * as trpcNext from "@trpc/server/adapters/next";
import { appRouter } from "../../../server/routers/main";
import { getServerSession } from "next-auth";
import { authOptions } from "../auth/[...nextauth]";
import { prismaClient } from "@/server/prisma-client";

export default trpcNext.createNextApiHandler({
  router: appRouter,
  createContext: async (_opts) => {
    const session = await getServerSession(_opts.req, _opts.res, authOptions);
    const email = session?.user?.email;
    const query = { where: { email } };
    const user = email ? await prismaClient.user.findFirst(query) : undefined;
    return { session, user };
  },
});
