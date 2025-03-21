import { useState, useRef, useEffect } from "react";
import { trpc } from "@/koala/trpc-config";
import {
  Button,
  Card,
  Center,
  Checkbox,
  Select,
  Stack,
  Textarea,
  Text,
  Box,
} from "@mantine/core";
import { backfillDecks } from "@/koala/decks/backfill-decks";
import { getServersideUser } from "@/koala/get-serverside-user";
import { prismaClient } from "@/koala/prisma-client";
import { GetServerSideProps } from "next";
import { getLangName } from "@/koala/get-lang-name";
import { LangCode } from "@/koala/shared-types";

type Props = {
  decks: {
    id: number;
    name: string;
    langCode: string;
  }[];
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
  const [selectedDeck, setSelectedDeck] = useState<number | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const startTimeRef = useRef<number | null>(null);
  const turbineMutation = trpc.turbine.useMutation();
  const selectedWords = output.filter((item) => item.selected);
  const bulkCreateCards = trpc.bulkCreateCards.useMutation();

  // Function to handle saving selected words to the deck
  const handleSaveWordsToDeck = async () => {
    if (!selectedDeck) {
      alert("Please select a deck first");
      return;
    }
    const deck = props.decks.find((d) => d.id === selectedDeck);
    if (!deck) {
      alert("Deck not found");
      return;
    }

    await bulkCreateCards.mutateAsync({
      langCode: deck.langCode as LangCode,
      input: selectedWords.map((item) => ({
        term: item.term,
        definition: item.definition,
        gender: "N",
      })),
      cardType: "both",
      deckName: deck.name,
    });
    // Reset state:
    setOutput([]);
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
    }, 100); // Update every 100ms for smoother display

    const result = await turbineMutation.mutateAsync({ words: inputText });
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
        <Stack>
          <Select
            label="Deck"
            placeholder="Select your deck"
            value={String(selectedDeck)}
            onChange={(val) => setSelectedDeck(Number(val))}
            data={props.decks.map((d) => ({
              label: `${d.name} (${getLangName(d.langCode)})`,
              value: String(d.id),
            }))}
          />
          <Textarea
            label="Input"
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
              disabled={selectedWords.length < 1 || !selectedDeck}
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
