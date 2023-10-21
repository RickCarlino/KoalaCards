import { EMAIL_SERVER_OPTIONS } from "@/pages/api/auth/[...nextauth]";
import { prismaClient } from "@/server/prisma-client";

async function getUsersWithDueCards() {
  // Set the time threshold for the last 24 hours
  const thresholdTime = new Date(Date.now() - 24 * 60 * 60 * 1000);

  // Find users who were active in the last 24 hours and have more than 10 cards due for review
  const users = await prismaClient.user.findMany({
    where: {
      lastSeen: {
        gt: thresholdTime,
      },
      // Nested read for cards associated with the user
      cards: {
        some: {
          flagged: false,
          nextReviewAt: { lte: Date.now() },
          OR: [{ repetitions: { gt: 0 } }, { lapses: { gt: 0 } }],
        },
      },
    },
    select: {
      email: true,
      // Select and count the cards for each user
      cards: {
        where: {
          flagged: false,
          nextReviewAt: { lte: Date.now() },
          OR: [{ repetitions: { gt: 0 } }, { lapses: { gt: 0 } }],
        },
        select: {
          id: true,
        },
      },
    },
  });

  return users
    .filter((user) => user.cards.length > 10 && user.email)
    .map((user) => user.email || "");
}

const nodemailer = require("nodemailer");

async function sendEmails(emails: string[]) {
  // Create a transporter object using the default SMTP transport
  let transporter = nodemailer.createTransport(EMAIL_SERVER_OPTIONS);

  // Send email to each user
  for (const email of emails) {
    let mailOptions = {
      to: email,
      subject: "It's time to review your cards!",
      text: "You have more than 10 cards due for review in KoalaSRS.",
    };

    // Send the email
    await transporter.sendMail(mailOptions);
  }
}

(async () => {
  const emails = await getUsersWithDueCards();
  await sendEmails(emails);
})();
