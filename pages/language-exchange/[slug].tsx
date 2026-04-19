import { getLanguageExchangePublicPath } from "@/koala/language-exchange-direct";
import type { GetServerSidePropsContext } from "next";

export async function getServerSideProps(
  context: GetServerSidePropsContext,
) {
  const slug =
    typeof context.params?.slug === "string" ? context.params.slug : null;
  if (!slug) {
    return { notFound: true };
  }

  return {
    redirect: {
      destination: getLanguageExchangePublicPath(slug),
      permanent: false,
    },
  };
}

export default function LegacyLanguageExchangeRedirectPage() {
  return null;
}
