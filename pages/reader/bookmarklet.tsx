import { getUserSettingsFromEmail } from "@/koala/auth-helpers";
import { trpc } from "@/koala/trpc-config";
import {
  Button,
  Container,
  Group,
  Stack,
  Text,
  Title,
} from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { GetServerSidePropsContext } from "next";
import Link from "next/link";
import { getSession } from "next-auth/react";
import React from "react";

const pageShellStyle: React.CSSProperties = {
  borderRadius: 24,
  border: "1px solid #f0d4e2",
  background:
    "linear-gradient(160deg, #fffdfd 0%, #fff8fc 54%, #fff2f8 100%)",
  boxShadow: "0 16px 30px rgba(176, 97, 136, 0.09)",
  padding: "clamp(14px, 2vw, 24px)",
};

const headlineFont =
  '"Palatino Linotype", "Book Antiqua", Palatino, serif';

function mutationErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }

  return fallback;
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
        message: "New bookmarklet issued.",
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
    <Container size="sm" mt="xl" pb="xl">
      <Stack gap="lg" style={pageShellStyle}>
        <Group justify="space-between" align="flex-end" wrap="wrap">
          <Stack gap={3}>
            <Title order={2} style={{ fontFamily: headlineFont }}>
              Bookmarklet
            </Title>
            <Text size="sm" c="dimmed">
              A bookmarklet is a bookmark that runs on your current tab to
              save an article instantly.
            </Text>
          </Stack>
          <Button
            component={Link}
            href="/reader"
            variant="light"
            size="sm"
          >
            Back to Reader
          </Button>
        </Group>

        <Stack gap={4}>
          <Text size="sm">
            1. Drag the button below to your bookmarks bar.
          </Text>
          <Text size="sm">2. Open any article page you want to save.</Text>
          <Text size="sm">
            3. Click the bookmark to send it to Reader.
          </Text>
        </Stack>

        {setupQuery.isLoading ? (
          <Text size="sm" c="dimmed">
            Preparing bookmarklet...
          </Text>
        ) : (
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
              Reset
            </Button>
          </Group>
        )}
      </Stack>
    </Container>
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
