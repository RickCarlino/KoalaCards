import { useState } from "react";
import { Button, Group, Paper, Stack, Text } from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { SectionCard } from "@/koala/components/SectionCard";
import { getStudyReportPath } from "@/koala/study-report-link";

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
    ? new URL(
        getStudyReportPath(data.token),
        window.location.origin,
      ).toString()
    : null;
}

export function StudyReportLinkCard({
  studyReportUrl,
}: {
  studyReportUrl: string | null;
}) {
  const [url, setUrl] = useState(studyReportUrl);
  const [pending, setPending] = useState<LinkAction | null>(null);

  const handleAction = async (action: LinkAction) => {
    if (
      action !== "copy" &&
      !window.confirm(
        action === "disable"
          ? "Disable your report link? Anyone using it will lose access."
          : "Regenerate your report link? The old link will stop working right away.",
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
          regenerate: "New link ready. The old link no longer works.",
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
      title="Study Report Link"
      titleOrder={3}
      description="Anyone with this link can read your recent writing, highlights, and answers."
    >
      <Stack gap="md">
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
