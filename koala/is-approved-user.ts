import { prismaClient } from "@/koala/prisma-client";

const superUsers = (process.env.AUTHORIZED_EMAILS || "")
  .split(",")
  .filter((x: string) => x.includes("@"))
  .map((x: string) => x.trim().toLowerCase());

const approvedUserIDs: Set<string> = new Set();

export const isApprovedUser = (id: string) => {
  return approvedUserIDs.has(id);
};

async function deleteInactiveUser(id: string, email: string | null) {
  if (isApprovedUser(id)) {
    return;
  }
  const cards = await prismaClient.card.findMany({
    where: {
      paused: true,
      userId: id,
    },
  });

  await prismaClient.card.deleteMany({
    where: {
      id: { in: cards.map((c) => c.id) },
    },
  });

  await prismaClient.deck.deleteMany({
    where: {
      userId: id,
    },
  });

  await prismaClient.user.delete({ where: { id } }).then(() => {
    console.log(`=== Delete ${email}`);
  });
}

function calculateDays(lastSeen: Date | null) {
  const lastSeenDays = lastSeen
    ? Math.floor((Date.now() - lastSeen.getTime()) / (1000 * 60 * 60 * 24))
    : 0;

  return lastSeenDays;
}

function userApproval(id: string, email: string | null) {
  const su = email && superUsers.includes(email);
  if (su) {
    approvedUserIDs.add(id);
    return true;
  }
  return false;
}

async function countCards(userId: string) {
  return prismaClient.card.count({
    where: {
      userId,
    },
  });
}

type User = {
  id: string;
  email: string | null;
  lastSeen: Date | null;
  createdAt: Date | null;
};

const userCleanup = async (user: User) => {
  const { email, id, lastSeen, createdAt } = user;
  const lastSeenDays = calculateDays(lastSeen);
  if (lastSeenDays < 28) {
    const su = userApproval(id, email);
    const cardCount = await countCards(id);
    if (cardCount > 1) {
      const flair = su ? "@" : "";
      const log = `== ${flair}${email} ${lastSeenDays}d ago ${cardCount} cards`;
      console.log(log);
      return;
    } else {
      if (cardCount === 0) {
        const daysSinceRegistration = calculateDays(createdAt);
        const a = daysSinceRegistration > 1;
        const b = lastSeenDays > 1;
        if (a || b) {
          await deleteInactiveUser(id, email);
        }
      }
    }
  } else {
    await deleteInactiveUser(user.id, email);
  }
};

(async () =>
  prismaClient.user.findMany({}).then(async (users) => {
    users.map(userCleanup);
  }))();
