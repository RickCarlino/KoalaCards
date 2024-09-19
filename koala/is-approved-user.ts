import { prismaClient } from "@/koala/prisma-client";
import { timeUntil } from "./time-until";

// Users that are allowed to use GPT-4, etc..
const superUsers = (process.env.AUTHORIZED_EMAILS || "")
  .split(",")
  .filter((x: string) => x.includes("@"))
  .map((x: string) => x.trim().toLowerCase());

let approvedUserIDs: Set<string> = new Set();

(() =>
  prismaClient.user.findMany({}).then((users) => {
    users.map((user) => {
      const { email, id, lastSeen } = user;
      const su = email && superUsers.includes(email);
      if (su) {
        approvedUserIDs.add(user.id);
      }
      const when = lastSeen ? timeUntil(lastSeen.getTime()) : "never";
      console.log(`=== ${email} / ${id} / ${when} / ${su ? "S" : "R"}`);
    });
  }))();

export const isApprovedUser = (id: string) => {
  return approvedUserIDs.has(id);
};
