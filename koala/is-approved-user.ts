import { prismaClient } from "@/koala/prisma-client";

// Users that are allowed to use GPT-4, etc..
export const superUsers = (process.env.AUTHORIZED_EMAILS || "")
  .split(",")
  .filter((x: string) => x.includes("@"))
  .map((x: string) => x.trim().toLowerCase());

let approvedUserIDs: string[] = [];
(() =>
  prismaClient.user.findMany({}).then((users) => {
    users.map((user) => {
      const { email, id, lastSeen } = user;
      const daysAgo = lastSeen
        ? (Date.now() - lastSeen.getTime()) / (1000 * 60 * 60 * 24)
        : -1;
      if (!email) {
        return;
      }
      if (superUsers.includes(email)) {
        approvedUserIDs.push(id);
      }
      console.log(`=== ${email} / ${id} (last seen ${daysAgo.toFixed(2)} days ago)`);
    });
  }))();

export const isApprovedUser = (id: string) => {
  return approvedUserIDs.includes(id);
};
