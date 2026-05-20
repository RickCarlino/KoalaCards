import { Anchor, Group, Text } from "@mantine/core";
import Link from "next/link";
import React from "react";
import {
  PublicReaderArticle,
  selectPendingMessage,
} from "../public-article";
import { ReaderPanel } from "./layout";

type ReaderProcessingPanelProps = {
  status: PublicReaderArticle["ingestStatus"];
  ingestError: string;
  publicId: string;
  normalizedUrl: string | null;
  errorTitle: string;
  pendingMessages: {
    pending: string;
    inProgress: string;
  };
  articleLinkLabel: string;
  backLinkLabel: string;
  backHref?: string;
  sourceLinkLabel: string;
};

export function ReaderProcessingPanel({
  status,
  ingestError,
  publicId,
  normalizedUrl,
  errorTitle,
  pendingMessages,
  articleLinkLabel,
  backLinkLabel,
  backHref = "/reader",
  sourceLinkLabel,
}: ReaderProcessingPanelProps) {
  if (status === "error") {
    return (
      <ReaderPanel>
        <Text c="red" fw={700}>
          {errorTitle}
        </Text>
        {ingestError.trim().length > 0 && (
          <Text size="sm" c="red">
            {ingestError}
          </Text>
        )}
        <Group gap="sm" wrap="wrap">
          <Anchor component={Link} href={`/reader/${publicId}`} size="sm">
            {articleLinkLabel}
          </Anchor>
          <Anchor component={Link} href={backHref} size="sm">
            {backLinkLabel}
          </Anchor>
          {normalizedUrl && (
            <Anchor
              href={normalizedUrl}
              target="_blank"
              rel="noreferrer"
              size="sm"
            >
              {sourceLinkLabel}
            </Anchor>
          )}
        </Group>
      </ReaderPanel>
    );
  }

  if (status === "pending" || status === "in_progress") {
    return (
      <ReaderPanel>
        <Text c="dimmed">
          {selectPendingMessage(status, pendingMessages)}
        </Text>
        <Group gap="sm" wrap="wrap">
          <Anchor component={Link} href={`/reader/${publicId}`} size="sm">
            {articleLinkLabel}
          </Anchor>
          <Anchor component={Link} href={backHref} size="sm">
            {backLinkLabel}
          </Anchor>
        </Group>
      </ReaderPanel>
    );
  }

  return null;
}
