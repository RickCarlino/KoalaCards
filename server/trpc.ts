import { initTRPC } from "@trpc/server";
import { Session } from "next-auth";
const t = initTRPC.context<{ session: Session | null }>().create();
export const router = t.router;
export const procedure = t.procedure.use(
  t.middleware(async ({ ctx, next }) => {
    if (!ctx.session) {
      console.log("TODO: Figure out how to populate session here");
    }
    return next();
  })
);
