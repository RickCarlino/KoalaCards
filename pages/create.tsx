import React, { useState, ChangeEvent } from "react";
import { trpc } from "@/utils/trpc";
import {
  Textarea,
  Button,
  Paper,
  Notification,
  Container,
} from "@mantine/core";

interface Card {
  term: string;
  definition: string;
}

const CreateCardPage: React.FC = () => {
  const [input, setInput] = useState("");
  const [cards, setCards] = useState<Card[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [buttonText, setButtonText] = useState<string | null>("Continue");
  const bulkCreateCards = trpc.bulkCreateCards.useMutation();
  const parseCards = trpc.parseCards.useMutation();

  const handleInputChange = (event: ChangeEvent<HTMLTextAreaElement>) => {
    setInput(event.target.value);
    if (event.target.value.length > 3000) {
      setError("Input exceeds the maximum limit of 3000 characters.");
    } else {
      setError(null);
    }
  };

  const handleContinue = async () => {
    if (input.length > 3000) {
      setError("Input exceeds the maximum limit of 3000 characters.");
      return;
    }
    setButtonText("Processing...");
    try {
      const result = await parseCards.mutateAsync({ text: input });
      setCards(result.cards);
      setInput(
        result.cards
          .map(
            ({ term, definition }) =>
              `${JSON.stringify(definition)}, ${JSON.stringify(term)}`,
          )
          .join("\n"),
      );
      setError(null);
      setButtonText(null);
    } catch (e) {
      setError("An error occurred while parsing the cards.");
      setButtonText("Error - Try Again?");
      console.error(e);
    }
  };

  const handleSave = async () => {
    try {
      await bulkCreateCards.mutateAsync({ input: cards });
      setError(null);
      // Reset input and cards for next entry
      setInput("");
      setCards([]);
    } catch (e) {
      setError("An error occurred while saving the cards.");
    }
  };

  return (
    <Container>
      <Paper>
        <h1>Create New Cards</h1>
        <p>Enter a list of cards below.</p>
        <p>
          <b>Pro Tip:</b> Edit your cards in a spreadsheet program like Excel or
          Google Sheets, then copy and paste them here.
        </p>
        <h3>Example of card input:</h3>
        <pre>그는 나를 웃게 했어요. He made me laugh.</pre>
        <Textarea
          minRows={10}
          placeholder="Korean sentence <tab> English translation or example sentence"
          value={input}
          onChange={handleInputChange}
        />
        <Notification color={input.length > 3000 ? "red" : "blue"}>
          {input.length}/3000 characters
        </Notification>
        {error && <Notification color="red">{error}</Notification>}
        {buttonText && <Button onClick={handleContinue}>{buttonText}</Button>}
        {cards.length > 0 && (
          <>
            {/* Implement the two-column layout for editing cards here */}
            <Button onClick={handleSave}>Save</Button>
          </>
        )}
      </Paper>
    </Container>
  );
};

export default CreateCardPage;
