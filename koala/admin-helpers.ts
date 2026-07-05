import type { GetServerSidePropsContext } from "next";
import { getSession } from "next-auth/react";

const MONTHS = [
  "JAN",
  "FEB",
  "MAR",
  "APR",
  "MAY",
  "JUN",
  "JUL",
  "AUG",
  "SEP",
  "OCT",
  "NOV",
  "DEC",
];

export function authorizedSuperUsers(value: string): string[] {
  return value
    .split(",")
    .map((entry) => entry.trim().toLowerCase())
    .filter((entry) => entry.includes("@"));
}

export function isAuthorizedSuperUser(
  email: string | null,
  superUsers: string[],
): boolean {
  return Boolean(email && superUsers.includes(email));
}

export function yesNo(value: boolean): string {
  return value ? "Yes" : "No";
}

export function fmtShortDate(
  iso: string | null,
  emptyLabel: string,
): string {
  if (!iso) {
    return emptyLabel;
  }

  const date = new Date(iso);
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${MONTHS[date.getMonth()]} ${pad(date.getDate())} ${pad(
    date.getHours(),
  )}:${pad(date.getMinutes())}`;
}

export async function requireAdminRequest(
  context: GetServerSidePropsContext,
) {
  const session = await getSession({ req: context.req });
  const email = session?.user?.email?.toLowerCase() ?? null;
  const superUsers = authorizedSuperUsers(
    process.env.AUTHORIZED_EMAILS || "",
  );

  if (isAuthorizedSuperUser(email, superUsers)) {
    return { email, superUsers };
  }

  return {
    redirect: {
      destination: "/user",
      permanent: false,
    },
  };
}
