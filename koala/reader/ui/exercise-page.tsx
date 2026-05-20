import { Anchor, Text } from "@mantine/core";
import Link from "next/link";
import React from "react";
import { PublicReaderArticle } from "../public-article";
import { ReaderPageFrame, ReaderPageHeader, ReaderPanel } from "./layout";
import { readerBodyFont } from "./theme";

type ReaderExercisePageProps = {
  article: Pick<PublicReaderArticle, "publicId">;
  title: string;
  subtitle?: string;
  isReady: boolean;
  hasContent: boolean;
  processingPanel: React.ReactNode;
  emptyMessage: string;
  emptyLinkLabel: string;
  children: React.ReactNode;
};

export function ReaderExercisePage({
  article,
  title,
  subtitle,
  isReady,
  hasContent,
  processingPanel,
  emptyMessage,
  emptyLinkLabel,
  children,
}: ReaderExercisePageProps) {
  return (
    <ReaderPageFrame>
      <ReaderPageHeader title={title} subtitle={subtitle} />
      {!isReady && processingPanel}
      {isReady && !hasContent && (
        <ReaderPanel>
          <Text
            size="sm"
            c="dimmed"
            style={{ fontFamily: readerBodyFont }}
          >
            {emptyMessage}
          </Text>
          <Anchor
            component={Link}
            href={`/reader/${article.publicId}`}
            size="sm"
          >
            {emptyLinkLabel}
          </Anchor>
        </ReaderPanel>
      )}
      {isReady && hasContent && children}
    </ReaderPageFrame>
  );
}
