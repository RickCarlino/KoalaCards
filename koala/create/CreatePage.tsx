import { ContentSection } from "@/koala/create/components/ContentSection";
import { DeckSection } from "@/koala/create/components/DeckSection";
import { LoadingOverlay } from "@/koala/create/components/LoadingOverlay";
import { PreviewSection } from "@/koala/create/components/PreviewSection";
import { useCreatePageController } from "@/koala/create/useCreatePageController";
import { getLangName } from "@/koala/get-lang-name";
import type { LanguageInputPageProps } from "@/koala/types/create-types";
import { Container, Grid, Text, Title } from "@mantine/core";
import React from "react";

export default function CreatePage(props: LanguageInputPageProps) {
  const { decks } = props;
  const controller = useCreatePageController(decks);

  return (
    <Container size="lg" py="lg" style={{ position: "relative" }}>
      <LoadingOverlay visible={controller.loading} />

      <Title order={1} mb="sm">
        Create Cards
      </Title>
      <Text c="dimmed" mb="lg">
        Choose a deck, add content, preview live, then save.
      </Text>

      <Grid gutter="lg">
        <Grid.Col span={{ base: 12, md: 6 }}>
          <DeckSection
            deckOptions={controller.deckOptions}
            deckSelection={controller.state.deckSelection}
            deckId={controller.state.deckId}
            deckName={controller.state.deckName}
            onSelectExistingDeck={controller.onExistingDeckChange}
            onSetSelection={controller.setDeckSelection}
            onSetDeckName={controller.setDeckName}
          />

          <ContentSection
            deckLangName={getLangName(controller.state.deckLang)}
            linesCount={controller.lines.length}
            mode={controller.mode}
            parsedRows={controller.parsedRows}
            rawInput={controller.state.rawInput}
            separator={controller.separator}
            setMode={controller.setMode}
            setRawInput={controller.setRawInput}
            setSeparator={controller.setSeparator}
            onParseCsv={controller.onParseCsv}
            onProcessWordlist={controller.onProcessWordlist}
            onSubmitVibe={controller.onSubmitVibe}
          />
        </Grid.Col>

        <Grid.Col span={{ base: 12, md: 6 }}>
          <PreviewSection
            canSave={controller.canSave}
            onEdit={controller.onEditCard}
            onRemove={controller.onRemoveCard}
            onSave={controller.onSave}
            processedCards={controller.state.processedCards}
          />
        </Grid.Col>
      </Grid>
    </Container>
  );
}
