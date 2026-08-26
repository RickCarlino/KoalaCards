import { getUserSettingsFromEmail } from "@/koala/auth-helpers";
import type { GetServerSidePropsContext } from "next";
import { getSession } from "next-auth/react";
import { resolveReaderPreferences } from "./preferences";

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

export async function getReaderBookPageProps(
  context: GetServerSidePropsContext,
) {
  const settings = await requireReaderPageSettings(context);
  if (!settings) {
    return { redirect: { destination: "/", permanent: false } };
  }

  return {
    props: {
      initialPreferences: resolveReaderPreferences({
        fontSize: settings.readerFontSize,
        lineHeight: settings.readerLineHeight,
        readingWidth: settings.readerReadingWidth,
      }),
    },
  };
}
