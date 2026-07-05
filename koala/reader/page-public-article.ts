import type { GetServerSidePropsContext } from "next";
import { getPublicReaderArticle } from "@/koala/reader/public-article";

export async function getPublicReaderArticlePage(
  context: GetServerSidePropsContext,
) {
  const publicId = context.params?.publicId;
  if (typeof publicId !== "string" || publicId.trim().length === 0) {
    return null;
  }

  return getPublicReaderArticle(publicId);
}
