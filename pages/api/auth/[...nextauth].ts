import { errorReport } from "@/koala/error-report";
import { prismaClient } from "@/koala/prisma-client";
import { PrismaAdapter } from "@next-auth/prisma-adapter";
import NextAuth, { AuthOptions } from "next-auth";
import EmailProvider, {
  EmailConfig,
  EmailUserConfig,
} from "next-auth/providers/email";
import { createTransport } from "nodemailer";
[
  "EMAIL_SERVER_HOST",
  "EMAIL_SERVER_PORT",
  "EMAIL_SERVER_USER",
  "EMAIL_SERVER_PASSWORD",
  "EMAIL_FROM",
].map((key) => {
  if (!process.env[key]) {
    return errorReport(`Missing env ${key}`);
  }
});
const server: EmailConfig["server"] = {
  host: process.env.EMAIL_SERVER_HOST || "",
  port: parseInt(process.env.EMAIL_SERVER_PORT || "", 10),
  auth: {
    user: process.env.EMAIL_SERVER_USER || "",
    pass: process.env.EMAIL_SERVER_PASSWORD || "",
  },
};
export const EMAIL_SERVER_OPTIONS: Partial<EmailUserConfig> = {
  server,
  from: process.env.EMAIL_FROM,
  generateVerificationToken() {
    const random = crypto.getRandomValues(new Uint8Array(8));
    return Buffer.from(random).toString("hex").slice(0, 6);
  },
  // SOLUTION TO iOS EMAIL PREIVIEW ISSUE:
  // https://github.com/nextauthjs/next-auth/issues/4965#issuecomment-1189094806
  async sendVerificationRequest(params) {
    const { identifier, provider, token } = params;
    console.log(`=== Log in ${token}`);
    const url = new URL(params.url);
    const signInURL = new URL(`/auth/email?${url.searchParams}`, url.origin);

    const result = await createTransport(server).sendMail({
      to: identifier,
      from: provider.from,
      subject: `Koala Cards Sign In Link`,
      text: `Sign in to Koala Cards here: ${signInURL}`,
      html: [
        `<a href="${signInURL}" target="_blank">Click here to sign in to Koala Cards</a>`,
        `<p>If you can't click the link, copy and paste the following URL into your browser:</p>`,
        `<p>${signInURL}</p>`,
      ].join("\n"),
    });
    const failed = result.rejected.concat(result.pending).filter(Boolean);
    if (failed.length) {
      return errorReport(`Email(s) (${failed.join(", ")}) could not be sent`);
    }
  },
};

export const authOptions: AuthOptions = {
  adapter: PrismaAdapter(prismaClient),
  providers: [EmailProvider(EMAIL_SERVER_OPTIONS)],
};

export default NextAuth(authOptions);
