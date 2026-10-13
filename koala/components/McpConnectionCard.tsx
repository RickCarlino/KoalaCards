import { useState } from "react";
import { Button, Group, Paper, Stack, Text } from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { SectionCard } from "@/koala/components/SectionCard";
import { getMcpPath } from "@/koala/study-report-link";

type LinkAction = "copy" | "regenerate" | "disable";

async function updateLink(action: LinkAction): Promise<string | null> {
  const response = await fetch("/api/study-report/link", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action }),
  });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error ?? "Could not update the link.");
  }
  return data.token
    ? new URL(getMcpPath(data.token), window.location.origin).toString()
    : null;
}

export function McpConnectionCard({ mcpUrl }: { mcpUrl: string | null }) {
  const [url, setUrl] = useState(mcpUrl);
  const [pending, setPending] = useState<LinkAction | null>(null);

  const handleAction = async (action: LinkAction) => {
    if (
      action !== "copy" &&
      !window.confirm(
        action === "disable"
          ? "Disable this connection? Apps using this link will lose access."
          : "Regenerate this link? The old link will stop working. Reconnect ChatGPT with the new link.",
      )
    ) {
      return;
    }
    setPending(action);
    try {
      const nextUrl =
        action === "copy" && url ? url : await updateLink(action);
      setUrl(nextUrl);
      if (action === "copy" && nextUrl) {
        await navigator.clipboard.writeText(nextUrl);
      }
      notifications.show({
        message: {
          copy: "Link copied",
          regenerate: "New link ready. Reconnect ChatGPT with it.",
          disable: "Link disabled",
        }[action],
        color: "teal",
      });
    } catch (error) {
      notifications.show({
        message:
          error instanceof Error
            ? error.message
            : "Could not update the link.",
        color: "red",
      });
    } finally {
      setPending(null);
    }
  };

  return (
    <SectionCard
      title="ChatGPT Connection"
      titleOrder={3}
      description="Anyone with this link can read your study data and create or edit cards. Keep it private."
    >
      <Stack gap="md">
        <Text size="sm" c="dimmed">
          In ChatGPT Plugins, add this link as a custom MCP server and
          choose No authentication.
        </Text>
        {url && (
          <Paper withBorder p="sm" radius="md">
            <Text
              size="sm"
              ff="monospace"
              style={{ wordBreak: "break-all" }}
            >
              {url}
            </Text>
          </Paper>
        )}
        <Group>
          <Button
            size="sm"
            variant="light"
            disabled={pending !== null}
            loading={pending === "copy"}
            onClick={() => void handleAction("copy")}
          >
            Copy link
          </Button>
          <Button
            size="sm"
            variant="outline"
            color="red"
            disabled={!url || pending !== null}
            loading={pending === "regenerate"}
            onClick={() => void handleAction("regenerate")}
          >
            Regenerate link
          </Button>
          <Button
            size="sm"
            variant="subtle"
            color="red"
            disabled={!url || pending !== null}
            loading={pending === "disable"}
            onClick={() => void handleAction("disable")}
          >
            Disable
          </Button>
        </Group>
      </Stack>
    </SectionCard>
  );
}
