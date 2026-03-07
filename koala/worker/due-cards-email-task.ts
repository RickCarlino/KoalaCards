import { getDueCardsCount } from "@/koala/due-cards";
import { sendKoalaEmail } from "@/koala/email/send-koala-email";
import { prismaClient } from "@/koala/prisma-client";
import type { WorkerTask } from "./run-loop";

const DUE_CARDS_THRESHOLD = 20;
const NOTIFICATION_COOLDOWN_MS = 24 * 60 * 60 * 1000;

const parsePositiveInt = (
  value: string | undefined,
  fallback: number,
): number => {
  const parsed = Number.parseInt(value ?? "", 10);
  if (Number.isNaN(parsed) || parsed < 1) {
    return fallback;
  }

  return parsed;
};

const dueCardsEmailBatchSize = (): number => {
  return parsePositiveInt(process.env.DUE_CARDS_EMAIL_BATCH_SIZE, 100);
};

const dueCardsEmailCheckIntervalMs = (): number => {
  const minutes = parsePositiveInt(
    process.env.DUE_CARDS_EMAIL_CHECK_MINUTES,
    15,
  );
  return minutes * 60 * 1000;
};

const getAppBaseUrl = (): string => {
  const value = process.env.NEXTAUTH_URL;
  if (!value) {
    return "http://localhost:3000";
  }

  return value.replace(/\/$/, "");
};

const dueCardsEmailHtml = (dueCards: number, name: string): string => {
  const appBaseUrl = getAppBaseUrl();
  return [
    `<p>Hi ${name},</p>`,
    `<p>You currently have <strong>${dueCards}</strong> cards due in Koala Cards.</p>`,
    `<p><a href="${appBaseUrl}/review">Open Koala Cards</a></p>`,
    `<p>You will not receive another due-card reminder for at least 24 hours.</p>`,
  ].join("\n");
};

const dueCardsEmailText = (dueCards: number, name: string): string => {
  const appBaseUrl = getAppBaseUrl();
  return [
    `Hi ${name},`,
    "",
    `You currently have ${dueCards} cards due in Koala Cards.`,
    "",
    `Open Koala Cards: ${appBaseUrl}/review`,
    "",
    "You will not receive another due-card reminder for at least 24 hours.",
  ].join("\n");
};

const sendDueCardsReminder = async (input: {
  dueCards: number;
  email: string;
  name: string;
}): Promise<boolean> => {
  return sendKoalaEmail({
    to: input.email,
    subject: `You have ${input.dueCards} cards due`,
    text: dueCardsEmailText(input.dueCards, input.name),
    html: dueCardsEmailHtml(input.dueCards, input.name),
  });
};

export const createDueCardsEmailTask = (): WorkerTask => {
  let lastCheckAtMs = 0;

  console.log("[worker][due-cards-email] task-initialized", {
    threshold: DUE_CARDS_THRESHOLD,
    cooldownHours: 24,
    batchSize: dueCardsEmailBatchSize(),
    checkIntervalMinutes: dueCardsEmailCheckIntervalMs() / (60 * 1000),
  });

  return {
    name: "due-cards-email",
    runOnce: async () => {
      const nowMs = Date.now();
      const checkIntervalMs = dueCardsEmailCheckIntervalMs();

      if (nowMs - lastCheckAtMs < checkIntervalMs) {
        return 0;
      }

      lastCheckAtMs = nowMs;
      const cooldownCutoff = new Date(nowMs - NOTIFICATION_COOLDOWN_MS);

      const settings = await prismaClient.userSettings.findMany({
        where: {
          dueCardsEmailNotifications: true,
          OR: [
            { dueCardsEmailNotificationSentAt: null },
            {
              dueCardsEmailNotificationSentAt: {
                lt: cooldownCutoff,
              },
            },
          ],
          user: {
            email: {
              not: null,
            },
          },
        },
        select: {
          userId: true,
          user: {
            select: {
              email: true,
              name: true,
            },
          },
        },
        orderBy: {
          id: "asc",
        },
        take: dueCardsEmailBatchSize(),
      });

      let sentCount = 0;
      for (const setting of settings) {
        const email = setting.user.email;
        if (!email) {
          continue;
        }

        const dueCards = await getDueCardsCount(setting.userId, nowMs);
        if (dueCards <= DUE_CARDS_THRESHOLD) {
          continue;
        }

        const sent = await sendDueCardsReminder({
          dueCards,
          email,
          name: setting.user.name ?? "there",
        });

        if (!sent) {
          continue;
        }

        await prismaClient.userSettings.update({
          where: { userId: setting.userId },
          data: { dueCardsEmailNotificationSentAt: new Date(nowMs) },
        });

        sentCount += 1;
      }

      return sentCount;
    },
  };
};
