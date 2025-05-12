import { useReducer, useState } from "react";
import { Container, Stepper, Title, Overlay, Loader } from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { trpc } from "@/koala/trpc-config";
import { LangCode } from "@/koala/shared-types";
import { GetServerSideProps } from "next";
import { prismaClient } from "@/koala/prisma-client";
import { backfillDecks } from "@/koala/decks/backfill-decks";
import { getServersideUser } from "@/koala/get-serverside-user";
import { useRouter } from "next/router";
import { DeckStep } from "@/koala/components/DeckStep";
import { InputStep } from "@/koala/components/InputStep";
import { ReviewStep } from "@/koala/components/ReviewStep";
import { LanguageInputPageProps } from "@/koala/types/create-types";
import { reducer, INITIAL_STATE } from "@/koala/types/create-reducer";

function handleError(error: unknown) {
  console.error(error);
  notifications.show({
    title: "Error",
    message:
      "Something went wrong. Please report this issue if it persists.",
    color: "red",
  });
}

export const getServerSideProps: GetServerSideProps = async (context) => {
  const dbUser = await getServersideUser(context);

  if (!dbUser) {
    return {
      redirect: { destination: "/api/auth/signin", permanent: false },
    };
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

const LanguageInputPage = (props: LanguageInputPageProps) => {
  const { decks } = props;
  const [state, dispatch] = useReducer(reducer, {
    ...INITIAL_STATE,
    // Improve first time user experience:
    deckLang: (decks?.[0]?.langCode as LangCode) || INITIAL_STATE.deckLang,
    deckSelection: decks.length > 0 ? "existing" : "new",
  });
  const [activeStep, setActiveStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const parseCards = trpc.parseCards.useMutation();
  const bulkCreateCards = trpc.bulkCreateCards.useMutation();

  /* Move from Step 1 (deck) -> Step 2 (input) */
  const handleDeckNext = () => {
    setActiveStep(1);
  };

  /* Process the raw input (Step 2 -> Step 3) */
  const handleRawInputSubmit = async () => {
    setLoading(true);
    try {
      const { cards } = await parseCards.mutateAsync({
        langCode: state.deckLang,
        text: state.rawInput,
      });
      dispatch({ type: "SET_PROCESSED_CARDS", processedCards: cards });
      setActiveStep(2); // Move to editing step
    } catch (error) {
      handleError(error);
    } finally {
      setLoading(false);
    }
  };

  /* Save the final cards to the chosen or newly created deck (Step 3 finalize) */
  const handleSave = async () => {
    setLoading(true);
    try {
      // If existing deck, use that deck's name; otherwise, use the new deck name
      let finalDeckName = state.deckName;
      if (state.deckSelection === "existing") {
        const existingDeck = decks.find((d) => d.id === state.deckId);
        if (existingDeck) {
          finalDeckName = existingDeck.name;
        }
      }

      await bulkCreateCards.mutateAsync({
        langCode: state.deckLang,
        input: state.processedCards,
        deckName: finalDeckName, // find-or-create by deck name
      });

      // Reset and start over
      dispatch({ type: "SET_PROCESSED_CARDS", processedCards: [] });
      dispatch({ type: "SET_RAW_INPUT", rawInput: "" });
      setActiveStep(0);

      notifications.show({
        title: "Success",
        message: "Your cards have been created successfully!",
        color: "green",
      });
      router.push("/review");
    } catch (error) {
      handleError(error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Container size="sm" mt="xl" style={{ position: "relative" }}>
      {loading && (
        <Overlay blur={2} opacity={0.6} color="#fff" zIndex={9999}>
          <Loader size="lg" variant="dots" />
        </Overlay>
      )}

      <Title order={1} mb="lg">
        Create New Cards
      </Title>
      <Stepper active={activeStep} onStepClick={setActiveStep} mb="xl">
        <Stepper.Step label="Deck Selection">
          <DeckStep
            decks={decks}
            state={state}
            dispatch={dispatch}
            onNext={handleDeckNext}
          />
        </Stepper.Step>

        <Stepper.Step label="Input">
          <InputStep
            state={state}
            dispatch={dispatch}
            onSubmit={handleRawInputSubmit}
            loading={loading}
          />
        </Stepper.Step>

        <Stepper.Step label="Review & Edit">
          <ReviewStep
            state={state}
            dispatch={dispatch}
            onBack={() => setActiveStep(1)}
            onSave={handleSave}
            loading={loading}
          />
        </Stepper.Step>
      </Stepper>
    </Container>
  );
};

export default LanguageInputPage;
