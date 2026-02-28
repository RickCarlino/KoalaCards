import { getUserSettingsFromEmail } from "@/koala/auth-helpers";
import {
  ReaderPageFrame,
  ReaderPageHeader,
  ReaderPanel,
} from "@/koala/reader/ui/layout";
import { readerSubtleCardStyle } from "@/koala/reader/ui/theme";
import { trpc } from "@/koala/trpc-config";
import { Button, Group, Stack, Text } from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { GetServerSidePropsContext } from "next";
import Link from "next/link";
import { getSession } from "next-auth/react";
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
    <Stack gap="xs">
      {steps.map((step, index) => {
        return (
          <Group
            key={step}
            gap="xs"
            align="flex-start"
            wrap="nowrap"
            style={readerSubtleCardStyle}
          >
            <Text fw={700} c="pink.7">
              {index + 1}
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
        message: "A new bookmarklet key was issued.",
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
        subtitle="Instantly save the page you are currently reading without copying URLs."
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
        <BookmarkletSteps />
      </ReaderPanel>

      <ReaderPanel>
        {setupQuery.isLoading && (
          <Text size="sm" c="dimmed">
            Preparing bookmarklet...
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
              Reset Key
            </Button>
          </Group>
        )}
      </ReaderPanel>
    </ReaderPageFrame>
  );
}

export async function getServerSideProps(
  context: GetServerSidePropsContext,
) {
  const session = await getSession({ req: context.req });
  if (!session?.user?.email) {
    return { redirect: { destination: "/", permanent: false } };
  }

  const userSettings = await getUserSettingsFromEmail(session.user.email);
  if (!userSettings) {
    return { redirect: { destination: "/", permanent: false } };
  }

  return { props: {} };
}
