import {
  getReaderBookPageProps,
  ReaderBookPage,
} from "@/koala/reader/ui/book-reader";
import type { GetServerSidePropsContext } from "next";

export default ReaderBookPage;

export async function getServerSideProps(
  context: GetServerSidePropsContext,
) {
  return getReaderBookPageProps(context);
}
