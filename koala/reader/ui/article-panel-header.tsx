import { Anchor, Group, Stack, Text } from "@mantine/core";
import { IconExternalLink } from "@tabler/icons-react";
import Link from "next/link";
import React from "react";
import { PublicReaderArticle } from "../public-article";
import {
  formatReaderDateTime,
  readerBodyFont,
  readerDisplayFont,
  readerHeadingColor,
  readerMutedColor,
} from "./theme";

type ReaderArticlePanelHeaderProps = {
  article: Pick<
    PublicReaderArticle,
    "createdAt" | "normalizedUrl" | "publicId" | "title"
  >;
  returnLabel: string;
  titleFontSize: string;
  children?: React.ReactNode;
};

export function ReaderArticlePanelHeader({
  article,
  returnLabel,
  titleFontSize,
  children,
}: ReaderArticlePanelHeaderProps) {
  return (
    <Stack gap={10}>
      <Group justify="space-between" align="center" wrap="wrap" gap="sm">
        <Anchor
          component={Link}
          href={`/reader/${article.publicId}`}
          size="sm"
        >
          {returnLabel}
        </Anchor>
        <Group gap="xs" wrap="wrap">
          <Text
            size="xs"
            style={{ fontFamily: readerBodyFont, color: readerMutedColor }}
          >
            Added {formatReaderDateTime(new Date(article.createdAt))}
          </Text>
          {article.normalizedUrl && (
            <Anchor
              href={article.normalizedUrl}
              target="_blank"
              rel="noreferrer"
              size="xs"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 4,
              }}
            >
              Source
              <IconExternalLink size={13} stroke={1.8} />
            </Anchor>
          )}
        </Group>
      </Group>
      <Text
        style={{
          fontFamily: readerDisplayFont,
          color: readerHeadingColor,
          fontWeight: 700,
          lineHeight: 1.25,
          fontSize: titleFontSize,
        }}
      >
        {article.title}
      </Text>
      {children}
    </Stack>
  );
}
