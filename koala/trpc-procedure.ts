import { TRPCError, initTRPC } from "@trpc/server";
import { Session } from "next-auth";
import { User } from "@prisma/client";
import superjson from "superjson";

type Ctx = { session: Session | null; user?: User | null };

const t = initTRPC.context<Ctx>().create({ transformer: superjson });

export const router = t.router;
export const procedure = t.procedure.use(
  t.middleware(async ({ ctx, next }) => {
    if (!ctx.session) {
      throw new TRPCError({
        code: "UNAUTHORIZED",
        message: "Please log in.",
      });
    }
    return next();
  }),
);
