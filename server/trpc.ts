import { TRPCError, initTRPC } from "@trpc/server";
import { Session } from "next-auth";
import { User } from "@prisma/client";
import superjson from "superjson";

// Users that are allowed to use GPT-4, etc..
export const superUsers = (process.env.AUTHORIZED_EMAILS || "")
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
    // // Uncomment and deploy if we ever get a "hug of death"
    // // from HN, product hunt, etc..
    // const email = ctx.user?.email || "";
    // if (superUsers.length) {
    //   if (!superUsers.includes(email.toLowerCase())) {
    //     console.error(`=== Refusing to serve ${email} ===`);
    //     throw new TRPCError({
    //       code: "UNAUTHORIZED",
    //       message: "You are not authorized to use this service.",
    //     });
    //   }
    // }
    return next();
  }),
);
