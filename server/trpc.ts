import { TRPCError, initTRPC } from "@trpc/server";
import { Session } from "next-auth";
import { User } from "@prisma/client";
import superjson from "superjson";

const authorizedUsersString = process.env.AUTHORIZED_EMAILS || "";
export const authorizedUsers = authorizedUsersString
  .split(",")
  .filter((x: string) => x.includes("@"))
  .map((x: string) => x.trim().toLowerCase());
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
    const email = ctx.user?.email || "";
    if (authorizedUsers.length) {
      if (!authorizedUsers.includes(email.toLowerCase())) {
        console.error(`=== Refusing to serve ${email} ===`);
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "You are not authorized to use this service.",
        });
      }
    }
    return next();
  }),
);
