import { getReaderEmptyPageProps } from "@/koala/reader/page-auth";
import {
  ReaderPageFrame,
  ReaderPageHeader,
  ReaderPanel,
  ReaderPanelHeader,
} from "@/koala/reader/ui/layout";
import {
  readerHeadingColor,
  readerListRowStyle,
} from "@/koala/reader/ui/theme";
import { trpc } from "@/koala/trpc-config";
import { Button, Group, Stack, Text } from "@mantine/core";
import { notifications } from "@mantine/notifications";
import Link from "next/link";
import React from "react";

function mutationErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }

  return fallback;
}

function BookmarkletSteps() {
  const steps = [
    "Drag the Koala Reader button to your bookmarks bar.",
    "Open the article page you want to save.",
    "Click the bookmark to send the page into Reader.",
  ];

  return (
    <Stack gap={0}>
      {steps.map((step, index) => {
        return (
          <Group
            key={step}
            gap="sm"
            align="flex-start"
            wrap="nowrap"
            style={readerListRowStyle(index > 0)}
          >
            <Text
              fw={700}
              size="sm"
              style={{ color: readerHeadingColor, minWidth: 18 }}
            >
              {index + 1}.
            </Text>
            <Text size="sm" c="dimmed">
              {step}
            </Text>
          </Group>
        );
      })}
    </Stack>
  );
}

export default function ReaderBookmarkletPage() {
  const setupQuery = trpc.getReaderBookmarkletConfig.useQuery(
    {},
    { refetchOnWindowFocus: false },
  );
  const rotateKey = trpc.rotateReaderBookmarkletKey.useMutation();

  const handleReset = async () => {
    try {
      await rotateKey.mutateAsync({});
      setupQuery.refetch();
      notifications.show({
        title: "Bookmarklet reset",
        message: "Created a new bookmark key.",
        color: "green",
      });
    } catch (error: unknown) {
      notifications.show({
        title: "Reset failed",
        message: mutationErrorMessage(
          error,
          "Could not reset bookmarklet.",
        ),
        color: "red",
      });
    }
  };

  return (
    <ReaderPageFrame size="sm">
      <ReaderPageHeader
        title="Bookmarklet"
        subtitle="Save the page you are reading in one click."
        rightSlot={
          <Button
            component={Link}
            href="/reader"
            variant="light"
            size="sm"
          >
            Back to Reader
          </Button>
        }
      />

      <ReaderPanel>
        <ReaderPanelHeader
          title="Setup Steps"
          subtitle="Install once, then save pages with one click."
        />
        <BookmarkletSteps />
      </ReaderPanel>

      <ReaderPanel>
        <ReaderPanelHeader
          title="Install Bookmarklet"
          subtitle="Drag this button into your browser bookmarks bar."
        />
        {setupQuery.isLoading && (
          <Text size="sm" c="dimmed">
            Building bookmarklet...
          </Text>
        )}

        {!setupQuery.isLoading && (
          <Group gap="xs" wrap="wrap">
            <Button
              component="a"
              href={setupQuery.data?.bookmarkletScript ?? ""}
              color="pink"
            >
              Koala Reader
            </Button>
            <Button
              size="xs"
              variant="subtle"
              loading={rotateKey.isLoading}
              onClick={handleReset}
            >
              Regenerate Key
            </Button>
          </Group>
        )}
      </ReaderPanel>
    </ReaderPageFrame>
  );
}

export const getServerSideProps = getReaderEmptyPageProps;
