import { GetServerSideProps } from "next";
import { useRouter } from "next/router";
import { useState, useMemo } from "react";
import {
  Button,
  Container,
  Divider,
  Flex,
  Loader,
  Overlay,
  Paper,
  Select,
  Table,
  Text,
  Textarea,
  TextInput,
  Title,
} from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { LangCode, supportedLanguages } from "@/koala/shared-types";
import { getLangName } from "@/koala/get-lang-name";
import { trpc } from "@/koala/trpc-config";
import { prismaClient } from "@/koala/prisma-client";
import { backfillDecks } from "@/koala/decks/backfill-decks";
import { getServersideUser } from "@/koala/get-serverside-user";

type Deck = {
  id: number;
  name: string;
  langCode: LangCode;
};

interface CreateRawPageProps {
  decks: Deck[];
}

export default function CreateRawPage({ decks }: CreateRawPageProps) {
  // The user can either pick an existing deck or create a new one:
  type DeckMode = "existing" | "new";
  const [deckMode, setDeckMode] = useState<DeckMode>(
    decks.length > 0 ? "existing" : "new",
  );
  const [deckId, setDeckId] = useState<number | undefined>(
    decks.length > 0 ? decks[0].id : undefined,
  );
  const [deckName, setDeckName] = useState("");
  const [deckLang, setDeckLang] = useState<LangCode>(
    decks.length > 0 ? decks[0].langCode : "ko",
  );

  // The user-supplied field separator (for term vs. definition)
  // The line separator is always a newline, so we don't store it in state.
  const [separator, setSeparator] = useState(","); // default to comma (user can change)

  // The raw text area
  const [rawInput, setRawInput] = useState("");

  // We'll always split lines by newline (\n), ignoring the user-supplied separator
  // Limit to 1500 lines
  const lines = useMemo(() => {
    return rawInput
      .split("\n") // line = carriage return
      .map((line) => line.trim())
      .filter(Boolean)
      .slice(0, 1500);
  }, [rawInput]);

  // For each line, we split by the user-supplied "separator"
  // The first part is the term, the rest is combined as the definition
  const parsedRows = useMemo(() => {
    return lines.map((line) => {
      const parts = line.split(separator);
      const term = parts[0]?.trim() ?? "";
      const definition = parts.slice(1).join(separator).trim();
      return { term, definition };
    });
  }, [lines, separator]);

  // tRPC mutation
  const bulkCreateCards = trpc.bulkCreateCards.useMutation();

  // For loading overlay
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleUpload() {
    if (!parsedRows.length) {
      notifications.show({
        title: "No data",
        message: "You have no lines to upload!",
        color: "red",
      });
      return;
    }

    setLoading(true);
    try {
      // If using an existing deck, override deckName/deckLang from that deck
      let finalDeckName = deckName.trim();
      let finalDeckLang = deckLang;

      if (deckMode === "existing") {
        const existing = decks.find((d) => d.id === deckId);
        if (existing) {
          finalDeckName = existing.name;
          finalDeckLang = existing.langCode;
        }
      }

      // Convert lines into card-like data
      const cardData = parsedRows.map(({ term, definition }) => ({
        term,
        definition,
        gender: "N" as const,
      }));

      // Upload via tRPC
      await bulkCreateCards.mutateAsync({
        langCode: finalDeckLang,
        input: cardData,
        cardType: "speaking", // or "listening" / "both" depending on your needs
        deckName: finalDeckName,
      });

      notifications.show({
        title: "Success",
        message: `Uploaded ${cardData.length} lines to deck: ${finalDeckName}`,
        color: "green",
      });

      // e.g., navigate to the review page
      router.push("/review");
    } catch (error) {
      console.error(error);
      notifications.show({
        title: "Error",
        message: "Something went wrong. Please try again or contact support.",
        color: "red",
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <Container size="sm" mt="xl" style={{ position: "relative" }}>
      {/* LOADING OVERLAY */}
      {loading && (
        <Overlay blur={2} opacity={0.6} color="#fff" zIndex={9999}>
          <Loader size="lg" variant="dots" />
        </Overlay>
      )}

      <Title order={2} mb="md">
        Advanced Raw Input
      </Title>

      {/* STEP 1: Deck selection */}
      <Paper withBorder p="md" radius="md" mb="md">
        <Title order={4} mb="sm">
          Deck Selection
        </Title>
        <Flex direction="column" gap="md">
          {/* We must handle null values for Mantine’s Select */}
          <Select
            label="Mode"
            data={[
              { label: "Use existing deck", value: "existing" },
              { label: "Create new deck", value: "new" },
            ]}
            value={deckMode}
            // onChange expects (value: string | null) => void
            onChange={(val) => {
              if (!val) return;
              // We know val must be either "existing" or "new"
              setDeckMode(val as DeckMode);
              if (val === "existing") {
                // Reset new deck fields
                setDeckName("");
                // If we have decks, pick the first by default
                if (decks.length > 0) {
                  setDeckId(decks[0].id);
                  setDeckLang(decks[0].langCode);
                }
              } else {
                // Reset existing deck fields
                setDeckId(undefined);
              }
            }}
          />

          {deckMode === "existing" && decks.length > 0 && (
            <Select
              label="Existing Deck"
              placeholder="Select deck"
              value={deckId ? String(deckId) : null}
              data={decks.map((d) => ({
                label: `${d.name} (${getLangName(d.langCode)})`,
                value: String(d.id),
              }))}
              onChange={(val) => {
                // If user picks a deck from the list
                if (!val) return;
                setDeckId(parseInt(val, 10));
              }}
            />
          )}

          {deckMode === "new" && (
            <>
              <TextInput
                label="New Deck Name"
                placeholder="e.g. 'Spanish Travel Phrases'"
                value={deckName}
                onChange={(e) => setDeckName(e.currentTarget.value)}
              />
              <Select
                label="Language"
                value={deckLang}
                data={Object.entries(supportedLanguages).map(
                  ([code, name]) => ({
                    label: name,
                    value: code,
                  }),
                )}
                // TS: val could be null, so guard or cast
                onChange={(val) => {
                  if (!val) return;
                  setDeckLang(val as LangCode);
                }}
              />
            </>
          )}
        </Flex>
      </Paper>

      {/* STEP 2: Raw input (each line is separated by newline) */}
      <Paper withBorder p="md" radius="md" mb="md">
        <Title order={4} mb="sm">
          Raw Text Input
        </Title>
        <Text size="sm" mb="xs">
          Paste or upload your large text file content here. Each line will be
          treated as a separate card. Within each line, we’ll split the term
          from the definition using the separator below. (Up to 1500 lines.)
        </Text>

        <Flex gap="sm" mb="sm">
          <TextInput
            label="Term→Definition Separator"
            placeholder=","
            style={{ flex: 1 }}
            value={separator}
            onChange={(e) => setSeparator(e.currentTarget.value)}
          />
        </Flex>

        <Textarea
          label="Raw Input (max 1500 lines)"
          placeholder={`Term1,Definition1\nTerm2,Definition2\n...`}
          minRows={10}
          autosize
          value={rawInput}
          onChange={(e) => setRawInput(e.currentTarget.value)}
        />

        <Divider my="sm" />

        {/* Info about how many lines were parsed */}
        <Text size="sm" mt="xs">
          <strong>{lines.length}</strong> lines parsed
          {rawInput.split("\n").length > 1500 && (
            <Text component="span" color="red" ml="xs">
              (over 1500 lines detected, truncated!)
            </Text>
          )}
        </Text>

        {/* Preview Table (first 10 lines) */}
        <Title order={5} mt="md" mb="xs">
          Preview (first 10 lines)
        </Title>
        <Table withColumnBorders striped>
          <thead>
            <tr>
              <th>Term</th>
              <th>Definition</th>
            </tr>
          </thead>
          <tbody>
            {parsedRows.slice(0, 10).map((row, i) => (
              <tr key={i}>
                <td>
                  {row.term || <em style={{ color: "gray" }}>No term</em>}
                </td>
                <td>
                  {row.definition || (
                    <em style={{ color: "gray" }}>No definition</em>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </Table>
      </Paper>

      {/* STEP 3: Upload */}
      <Flex justify="flex-end">
        <Button onClick={handleUpload} disabled={loading}>
          Upload
        </Button>
      </Flex>
    </Container>
  );
}

/**
 * If you want to ensure the user is logged in and fetch user decks
 */
export const getServerSideProps: GetServerSideProps = async (ctx) => {
  const dbUser = await getServersideUser(ctx);
  if (!dbUser) {
    return { redirect: { destination: "/api/auth/signin", permanent: false } };
  }

  // Ensure user has a default set of decks
  await backfillDecks(dbUser.id);

  // Fetch user’s existing decks
  const decksData = await prismaClient.deck.findMany({
    where: { userId: dbUser.id },
  });

  return {
    props: {
      decks: decksData.map((deck) => ({
        id: deck.id,
        name: deck.name,
        langCode: deck.langCode,
      })),
    },
  };
};
