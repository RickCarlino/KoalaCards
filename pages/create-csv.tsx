import { GetServerSideProps } from "next";
import { useRouter } from "next/router";
import { useState, useMemo, useReducer } from "react"; // Added useReducer
import {
  Button,
  Container,
  Divider,
  // Flex, // No longer needed directly here
  Loader,
  Overlay,
  Paper,
  // Select, // No longer needed directly here
  Table,
  Text,
  Textarea,
  TextInput,
  Title,
  Flex, // Keep Flex for layout
} from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { LangCode } from "@/koala/shared-types"; // Removed supportedLanguages, getLangName (handled by DeckPicker)
// import { getLangName } from "@/koala/get-lang-name"; // Handled by DeckPicker
import { trpc } from "@/koala/trpc-config";
import { prismaClient } from "@/koala/prisma-client";
import { backfillDecks } from "@/koala/decks/backfill-decks";
import { getServersideUser } from "@/koala/get-serverside-user";
import { DeckPicker, Deck } from "@/koala/deck-picker"; // Import DeckPicker and its Deck type
import { reducer, INITIAL_STATE } from "@/koala/types/create-reducer"; // Import shared reducer

// Removed local Deck type definition, using the imported one from deck-picker

interface CreateRawPageProps {
  decks: Deck[]; // Use Deck type from DeckPicker
}

export default function CreateRawPage({ decks }: CreateRawPageProps) {
  // Use reducer for state management (deck + rawInput)
  const [state, dispatch] = useReducer(reducer, {
    ...INITIAL_STATE,
    // Initialize based on fetched decks
    deckLang: (decks?.[0]?.langCode as LangCode) || INITIAL_STATE.deckLang,
    deckSelection: decks.length > 0 ? "existing" : "new",
    // Set initial deckId if using existing and decks are available
    deckId: decks.length > 0 ? decks[0].id : undefined,
    // Set initial deckName if using existing and decks are available
    deckName: decks.length > 0 ? decks[0].name : "",
  });

  // Keep separator state local as it's specific to this page
  const [separator, setSeparator] = useState(",");

  // We'll always split lines by newline (\n), ignoring the user-supplied separator
  // Limit to 1500 lines
  // Use state.rawInput from reducer
  const lines = useMemo(() => {
    return state.rawInput
      .split("\n") // line = carriage return
      .map((line) => line.trim())
      .filter(Boolean)
      .slice(0, 1500);
  }, [state.rawInput]);

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
      // Read deck info from reducer state
      let finalDeckName = state.deckName.trim();
      let finalDeckLang = state.deckLang;

      // If using an existing deck, ensure the name/lang are from the selected deck
      // The DeckPicker's handleExistingDeckChange should already set state.deckName
      // and state.deckLang correctly when an existing deck is chosen.
      // We just need to ensure finalDeckName isn't empty if 'new' mode was selected.
      if (state.deckSelection === "new" && !finalDeckName) {
        notifications.show({
          title: "Missing Deck Name",
          message: "Please provide a name for the new deck.",
          color: "red",
        });
        setLoading(false);
        return;
      }
      // If existing deck mode, deckId must be set
      if (state.deckSelection === "existing" && !state.deckId) {
        notifications.show({
          title: "Missing Deck Selection",
          message: "Please select an existing deck.",
          color: "red",
        });
        setLoading(false);
        return;
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
        Create Cards from CSV/Text
      </Title>

      {/* STEP 1: Use DeckPicker Component */}
      <DeckPicker
        decks={decks}
        state={state}
        dispatch={dispatch}
        onNext={() => {
          /* This page doesn't have explicit steps, so onNext might not do much */
          /* Could potentially scroll to the next section or just be ignored */
          console.log("Deck selected/created");
        }}
        title="Step 1: Choose or Create Deck" // Override default title
      />

      {/* STEP 2: Raw input (each line is separated by newline) */}
      <Paper withBorder p="md" radius="md" my="md">
        {" "}
        {/* Added my="md" for spacing */}
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
          placeholder={`Term1${separator}Definition1\nTerm2${separator}Definition2\n...`}
          minRows={10}
          autosize
          value={state.rawInput} // Use rawInput from reducer state
          onChange={(e) =>
            dispatch({ type: "SET_RAW_INPUT", rawInput: e.currentTarget.value })
          } // Dispatch action to update rawInput
        />
        <Divider my="sm" />
        {/* Info about how many lines were parsed */}
        <Text size="sm" mt="xs">
          <strong>{lines.length}</strong> lines parsed
          {state.rawInput.split("\n").length > 1500 && ( // Check length from state.rawInput
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
