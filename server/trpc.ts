import { TRPCError, initTRPC } from "@trpc/server";
import { Session } from "next-auth";
import { User } from "@prisma/client";
const authorizedUsersString = process.env.AUTHORIZED_EMAILS || "";
const authorizedUsers = authorizedUsersString
  .split(",")
  .map((x: string) => x.trim().toLowerCase())
  .filter((x: string) => x.includes("@"));

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
