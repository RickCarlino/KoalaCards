import { createTransport } from "nodemailer";

type SendKoalaEmailInput = {
  html: string;
  subject: string;
  text: string;
  to: string;
};

type EmailServerConfig = {
  from: string;
  host: string;
  pass: string;
  port: number;
  user: string;
};

const getEmailServerConfig = (): EmailServerConfig | null => {
  const host = process.env.EMAIL_SERVER_HOST;
  const portRaw = process.env.EMAIL_SERVER_PORT;
  const user = process.env.EMAIL_SERVER_USER;
  const pass = process.env.EMAIL_SERVER_PASSWORD;
  const from = process.env.EMAIL_FROM;

  if (!host || !portRaw || !user || !pass || !from) {
    return null;
  }

  const port = Number.parseInt(portRaw, 10);
  if (Number.isNaN(port)) {
    return null;
  }

  return {
    host,
    port,
    user,
    pass,
    from,
  };
};

export const sendKoalaEmail = async (
  input: SendKoalaEmailInput,
): Promise<boolean> => {
  const config = getEmailServerConfig();
  if (!config) {
    console.error(
      "[email] missing EMAIL_SERVER_HOST/EMAIL_SERVER_PORT/EMAIL_SERVER_USER/EMAIL_SERVER_PASSWORD/EMAIL_FROM",
    );
    return false;
  }

  const result = await createTransport({
    host: config.host,
    port: config.port,
    auth: {
      user: config.user,
      pass: config.pass,
    },
  }).sendMail({
    to: input.to,
    from: config.from,
    subject: input.subject,
    text: input.text,
    html: input.html,
  });

  const failed = result.rejected.concat(result.pending).filter(Boolean);
  if (failed.length > 0) {
    console.error(`[email] failed to send to: ${failed.join(", ")}`);
    return false;
  }

  return true;
};
