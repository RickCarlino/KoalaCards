import { prismaClient } from "@/server/prisma-client";
import { PrismaAdapter } from "@next-auth/prisma-adapter";
import NextAuth, { AuthOptions } from "next-auth";
import EmailProvider from "next-auth/providers/email";
[
'EMAIL_SERVER_HOST',
'EMAIL_SERVER_PORT',
'EMAIL_SERVER_USER',
'EMAIL_SERVER_PASSWORD',
'EMAIL_FROM',
].map( key => {
  if (!process.env[key]) {
    throw new Error(`Missing env ${key}`);
  }
})

export const authOptions: AuthOptions = {
  adapter: PrismaAdapter(prismaClient),
  providers: [
    EmailProvider({
      server: {
        host: process.env.EMAIL_SERVER_HOST,
        port: process.env.EMAIL_SERVER_PORT,
        auth: {
          user: process.env.EMAIL_SERVER_USER,
          pass: process.env.EMAIL_SERVER_PASSWORD,
        },
      },
      from: process.env.EMAIL_FROM,
    }),
  ],
};

export default NextAuth(authOptions);
