import { getUserSettingsFromEmail } from "@/koala/auth-helpers";
import type { GetServerSidePropsContext } from "next";
import { getSession } from "next-auth/react";

export async function requireReaderPageSettings(
  context: GetServerSidePropsContext,
) {
  const session = await getSession({ req: context.req });
  if (!session?.user?.email) {
    return null;
  }

  return getUserSettingsFromEmail(session.user.email);
}

export async function getReaderEmptyPageProps(
  context: GetServerSidePropsContext,
) {
  const userSettings = await requireReaderPageSettings(context);
  if (!userSettings) {
    return { redirect: { destination: "/", permanent: false } };
  }

  return { props: {} };
}
