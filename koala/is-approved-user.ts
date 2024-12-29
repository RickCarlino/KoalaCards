import { prismaClient } from "@/koala/prisma-client";
// import { timeUntil } from "./time-until";

// Users that are allowed to use GPT-4, etc..
const superUsers = (process.env.AUTHORIZED_EMAILS || "")
  .split(",")
  .filter((x: string) => x.includes("@"))
  .map((x: string) => x.trim().toLowerCase());

let approvedUserIDs: Set<string> = new Set();

export const isApprovedUser = (id: string) => {
  return approvedUserIDs.has(id);
};

(async () =>
  prismaClient.user.findMany({}).then(async (users) => {
    users.map(async (user) => {
      const { email, /*id,*/ lastSeen } = user;
      const su = email && superUsers.includes(email);
      if (su) {
        approvedUserIDs.add(user.id);
      }
      const lastSeenDays = lastSeen
        ? Math.floor((Date.now() - lastSeen.getTime()) / (1000 * 60 * 60 * 24))
        : 0;
      if (lastSeenDays < 93) {
        const cardCount = await prismaClient.card.count({
          where: {
            userId: user.id,
          },
        });
        if (cardCount > 1) {
          console.log(
            `=== ${
              su ? "Super" : "Normal"
            } user: ${email} (${lastSeenDays} days ago)`,
          );
        }
      } else {
        // prismaClient.user.delete({ where: { id } }).then(() => {
        //   console.log(`=== Deleted user: ${email}`);
        // });
      }
    });
  }))();
