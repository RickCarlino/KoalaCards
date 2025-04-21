import { useState, useRef, useEffect, useReducer } from "react"; // Added useReducer
import { useRouter } from "next/router";
import { trpc } from "@/koala/trpc-config";
import {
  Button,
  Card,
  Center,
  Checkbox,
  // Select, // Replaced by DeckPicker
  Stack,
  Textarea,
  Text,
  Box,
} from "@mantine/core";
import { backfillDecks } from "@/koala/decks/backfill-decks";
import { getServersideUser } from "@/koala/get-serverside-user";
import { prismaClient } from "@/koala/prisma-client";
import { GetServerSideProps } from "next";
// import { getLangName } from "@/koala/get-lang-name"; // Handled by DeckPicker
import { LangCode } from "@/koala/shared-types";
import { DeckPicker, Deck } from "@/koala/deck-picker"; // Import DeckPicker and Deck type
import { reducer, INITIAL_STATE } from "@/koala/types/create-reducer"; // Import shared reducer

// Use Deck type from DeckPicker
type Props = {
  decks: Deck[];
};

export const getServerSideProps: GetServerSideProps<Props> = async (
  context,
) => {
  const dbUser = await getServersideUser(context);

  if (!dbUser) {
    return { redirect: { destination: "/api/auth/signin", permanent: false } };
  }

  // Ensure user has a default set of decks
  await backfillDecks(dbUser.id);

  // Fetch user decks
  const decks = await prismaClient.deck.findMany({
    where: {
      userId: dbUser?.id,
    },
  });

  return {
    props: {
      decks: decks.map((deck) => ({
        id: deck.id,
        name: deck.name,
        langCode: deck.langCode,
      })),
    },
  };
};

export default function Turbine(props: Props) {
  type CheckBoxItem = {
    selected: boolean;
    term: string;
    definition: string;
  };
  const [inputText, setInputText] = useState("");
  const [output, setOutput] = useState<CheckBoxItem[]>([]);
  const [elapsedTime, setElapsedTime] = useState(0);
  // Replace selectedDeck state with reducer
  const [state, dispatch] = useReducer(reducer, {
    ...INITIAL_STATE,
    // Initialize based on fetched decks
    deckLang:
      (props.decks?.[0]?.langCode as LangCode) || INITIAL_STATE.deckLang,
    deckSelection: props.decks.length > 0 ? "existing" : "new",
    deckId: props.decks.length > 0 ? props.decks[0].id : undefined,
    deckName: props.decks.length > 0 ? props.decks[0].name : "",
  });
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const startTimeRef = useRef<number | null>(null);
  const turbineMutation = trpc.turbine.useMutation();
  const selectedWords = output.filter((item) => item.selected);
  const bulkCreateCards = trpc.bulkCreateCards.useMutation();
  // Deck info will now come from 'state' (reducer)
  // const deck = props.decks.find((d) => d.id === state.deckId); // Example: Access via state.deckId
  const router = useRouter();

  // Effect to pre-fill textarea from URL query parameter (remains the same)
  useEffect(() => {
    if (router.isReady) {
      // Ensure router query is populated
      const wordsQuery = router.query.words;
      if (typeof wordsQuery === "string") {
        try {
          const decodedWords = decodeURIComponent(wordsQuery);
          const wordsArray = decodedWords.split(",");
          setInputText(wordsArray.join("\n"));
        } catch (e) {
          console.error("Failed to parse words from URL:", e);
          // Optionally show a notification to the user
        }
      }
    }
  }, [router.isReady, router.query]);

  // Function to handle saving selected words to the deck
  const handleSaveWordsToDeck = async () => {
    // Validate based on reducer state
    const finalDeckName = state.deckName.trim();
    if (state.deckSelection === "existing" && !state.deckId) {
      alert("Please select an existing deck.");
      return;
    }
    if (state.deckSelection === "new" && !finalDeckName) {
      alert("Please provide a name for the new deck.");
      return;
    }

    try {
      await bulkCreateCards.mutateAsync({
        langCode: state.deckLang, // Use lang from state
        input: selectedWords.map((item) => ({
          term: item.term,
          definition: item.definition,
          gender: "N",
        })),
        deckName: finalDeckName, // Use finalDeckName (handles both new/existing)
      });
      // Reset state:
      setOutput([]);
      // Optionally show success notification
      alert(`Saved ${selectedWords.length} words to deck: ${finalDeckName}`);
    } catch (error) {
      console.error("Failed to save words:", error);
      alert("An error occurred while saving words.");
    }
  };

  // Clean up timer on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, []);

  const handleSubmit = async () => {
    // Reset and start the timer
    setElapsedTime(0);
    if (timerRef.current) {
      clearInterval(timerRef.current);
    }

    startTimeRef.current = Date.now();
    timerRef.current = setInterval(() => {
      if (startTimeRef.current) {
        const secondsElapsed = Math.floor(
          (Date.now() - startTimeRef.current) / 1000,
        );
        setElapsedTime(secondsElapsed);
      }
    }, 100);

    // Validate deck selection from state
    if (state.deckSelection === "existing" && !state.deckId) {
      alert("Please select an existing deck first.");
      clearInterval(timerRef.current); // Stop timer
      timerRef.current = null;
      startTimeRef.current = null;
      setElapsedTime(0);
      return;
    }
    if (state.deckSelection === "new" && !state.deckName.trim()) {
      alert("Please provide a name for the new deck first.");
      clearInterval(timerRef.current); // Stop timer
      timerRef.current = null;
      startTimeRef.current = null;
      setElapsedTime(0);
      return;
    }

    const result = await turbineMutation.mutateAsync({
      words: inputText,
      langCode: state.deckLang, // Use langCode from state
    });
    const checkBoxes = result.map((item) => ({ selected: true, ...item }));

    // Stop the timer when setting the actual output
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    setOutput(checkBoxes);
  };

  return (
    <Center style={{ width: "100%", padding: "2rem" }}>
      <Card
        shadow="sm"
        padding="lg"
        radius="md"
        withBorder
        style={{ width: "80%" }}
      >
        <Stack gap="lg">
          {" "}
          {/* Changed spacing to gap */}
          {/* Replace Select with DeckPicker */}
          <DeckPicker
            decks={props.decks}
            state={state}
            dispatch={dispatch}
            onNext={() => {
              /* No explicit next step here, maybe focus input? */
              console.log("Deck selected/created");
            }}
            title="Choose or Create Deck" // Custom title
          />
          <Textarea
            label="Input Words (one per line)" // Updated label
            placeholder="Enter text here..."
            value={inputText}
            onChange={(event) => setInputText(event.currentTarget.value)}
            autosize
            minRows={3}
          />
          <div style={{ display: "flex", gap: "1rem" }}>
            <Button onClick={handleSubmit}>
              Generate Sentences{" "}
              {elapsedTime > 0 ? `(${elapsedTime}s elapsed)` : ""}
            </Button>
            <Button
              disabled={
                selectedWords.length < 1 ||
                (state.deckSelection === "existing" && !state.deckId) ||
                (state.deckSelection === "new" && !state.deckName.trim())
              }
              color="green"
              onClick={handleSaveWordsToDeck}
            >
              Save
            </Button>
          </div>
          <Box>
            <Text fw={500} size="sm" style={{ marginBottom: "0.5rem" }}>
              Output (Select items to include)
            </Text>
            {output.length > 0 ? (
              output.map((item, index) => (
                <Checkbox
                  key={index}
                  label={`${item.term} - ${item.definition}`}
                  checked={item.selected}
                  onChange={(event) => {
                    const newOutput = [...output];
                    newOutput[index].selected = event.currentTarget.checked;
                    setOutput(newOutput);
                  }}
                  style={{ marginBottom: "0.5rem" }}
                />
              ))
            ) : (
              <Text>Output will appear here...</Text>
            )}
          </Box>
        </Stack>
      </Card>
    </Center>
  );
}
