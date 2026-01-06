import { getServersideUser } from "@/koala/get-serverside-user";
import { prismaClient } from "@/koala/prisma-client";
import { trpc } from "@/koala/trpc-config";
import { DeckExport, deckExportSchema } from "@/koala/types/deck-export";
import {
  Badge,
  Button,
  Container,
  Group,
  Paper,
  Stack,
  Table,
  Text,
  Title,
} from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { IconDownload, IconUpload } from "@tabler/icons-react";
import { GetServerSideProps } from "next";
import { useRef, useState } from "react";

type DeckRow = {
  id: number;
  name: string;
  cardCount: number;
};

type Props = {
  decks: DeckRow[];
};

export const getServerSideProps: GetServerSideProps<Props> = async (
  ctx,
) => {
  const dbUser = await getServersideUser(ctx);

  if (!dbUser) {
    return {
      redirect: { destination: "/api/auth/signin", permanent: false },
    };
  }

  const decks = await prismaClient.deck.findMany({
    where: { userId: dbUser.id },
    select: { id: true, name: true, _count: { select: { Card: true } } },
    orderBy: { createdAt: "desc" },
  });

  return {
    props: {
      decks: decks.map((deck) => ({
        id: deck.id,
        name: deck.name,
        cardCount: deck._count.Card,
      })),
    },
  };
};

const buildFileName = (name: string) => {
  const safeName = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-+|-+$)/g, "");
  return `${safeName || "deck"}-export.json`;
};

const downloadDeck = (name: string, payload: DeckExport) => {
  const blob = new Blob([JSON.stringify(payload, null, 2)], {
    type: "application/json",
  });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = buildFileName(name);
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(link.href);
};

type DeckActionsTableProps = {
  decks: DeckRow[];
  exportingDeckId: number | null;
  importingDeckId: number | null;
  onExport: (deck: DeckRow) => void;
  onImport: (deckId: number) => void;
};

function DeckActionsTable({
  decks,
  exportingDeckId,
  importingDeckId,
  onExport,
  onImport,
}: DeckActionsTableProps) {
  return (
    <Table verticalSpacing="sm" highlightOnHover>
      <thead>
        <tr>
          <th>Deck</th>
          <th>Cards</th>
          <th>Actions</th>
        </tr>
      </thead>
      <tbody>
        {decks.map((deck) => {
          const isExporting = exportingDeckId === deck.id;
          const isImporting = importingDeckId === deck.id;

          return (
            <tr key={deck.id}>
              <td>
                <Text fw={600}>{deck.name}</Text>
              </td>
              <td>
                <Badge variant="light" color="blue">
                  {deck.cardCount} cards
                </Badge>
              </td>
              <td>
                <Group gap="sm">
                  <Button
                    leftSection={<IconDownload size={16} />}
                    variant="light"
                    onClick={() => onExport(deck)}
                    loading={isExporting}
                  >
                    Export
                  </Button>
                  <Button
                    leftSection={<IconUpload size={16} />}
                    variant="outline"
                    onClick={() => onImport(deck.id)}
                    loading={isImporting}
                  >
                    Import
                  </Button>
                </Group>
              </td>
            </tr>
          );
        })}
      </tbody>
    </Table>
  );
}

export default function DeckExportPage({ decks }: Props) {
  const exportDeck = trpc.exportDeck.useMutation();
  const importDeck = trpc.importDeck.useMutation();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [exportingDeckId, setExportingDeckId] = useState<number | null>(
    null,
  );
  const [importingDeckId, setImportingDeckId] = useState<number | null>(
    null,
  );
  const [importTargetId, setImportTargetId] = useState<number | null>(
    null,
  );

  const handleExport = async (deck: DeckRow) => {
    setExportingDeckId(deck.id);
    try {
      const payload = await exportDeck.mutateAsync({ deckId: deck.id });
      downloadDeck(deck.name, payload);
      notifications.show({
        title: "Export ready",
        message: `Downloaded ${deck.name}`,
        color: "green",
      });
    } catch (error) {
      notifications.show({
        title: "Export failed",
        message:
          error instanceof Error
            ? error.message
            : "Unable to export this deck right now.",
        color: "red",
      });
    } finally {
      setExportingDeckId(null);
    }
  };

  const resetFileInput = () => {
    setImportingDeckId(null);
    setImportTargetId(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleImportClick = (deckId: number) => {
    setImportTargetId(deckId);
    fileInputRef.current?.click();
  };

  const handleFileChange = async (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = event.target.files?.[0];
    const targetDeckId = importTargetId;
    if (!file || targetDeckId === null) {
      resetFileInput();
      return;
    }

    setImportingDeckId(targetDeckId);
    try {
      const text = await file.text();
      const parsed = deckExportSchema.safeParse(JSON.parse(text));
      if (!parsed.success) {
        notifications.show({
          title: "Invalid file",
          message: "Please select a deck export JSON file.",
          color: "red",
        });
        return;
      }

      const result = await importDeck.mutateAsync({
        deckId: targetDeckId,
        payload: parsed.data,
      });

      notifications.show({
        title: "Import complete",
        message: `Added ${result.importedCount} cards. ${result.skippedDuplicateCount} skipped as duplicates.`,
        color: "green",
      });
    } catch (error) {
      notifications.show({
        title: "Import failed",
        message:
          error instanceof Error
            ? error.message
            : "Unable to import this file right now.",
        color: "red",
      });
    } finally {
      resetFileInput();
    }
  };

  return (
    <Container size="lg" py="lg">
      <Stack gap="md">
        <Stack gap={4}>
          <Title order={2}>Import / Export Decks</Title>
          <Text c="dimmed">
            Download deck data as JSON or import a previous export into an
            existing deck.
          </Text>
        </Stack>

        <Paper withBorder p="md" radius="md">
          {decks.length === 0 ? (
            <Text>
              No decks available yet. Create one to start exporting.
            </Text>
          ) : (
            <DeckActionsTable
              decks={decks}
              exportingDeckId={
                exportDeck.isLoading ? exportingDeckId : null
              }
              importingDeckId={
                importDeck.isLoading ? importingDeckId : null
              }
              onExport={handleExport}
              onImport={handleImportClick}
            />
          )}
        </Paper>
      </Stack>

      <input
        ref={fileInputRef}
        type="file"
        accept="application/json"
        style={{ display: "none" }}
        onChange={handleFileChange}
      />
    </Container>
  );
}
