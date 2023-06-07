import { TRPCError, initTRPC } from "@trpc/server";
import { Session } from "next-auth";
import { User } from "@prisma/client";
const t = initTRPC
  .context<{
    session: Session | null;
    user?: User | null;
  }>()
  .create();
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
  })
);
