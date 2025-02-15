import { Button, Paper, Title, Divider, Flex, Card, TextInput } from "@mantine/core";
import { ReviewStepProps } from "../types/create-types";

export function ReviewStep({
  state,
  dispatch,
  onBack,
  onSave,
  loading,
}: ReviewStepProps) {
  return (
    <Paper withBorder p="md" radius="md">
      <Flex direction="column" gap="md">
        <Title order={3}>Step 3: Review & Edit Cards</Title>
        <div style={{ fontSize: 14, color: "gray" }}>
          Verify each card is correct. You can edit the term or definition if
          needed, or remove cards that you don't want. When satisfied, click
          "Save Cards".
        </div>

        {state.processedCards.length === 0 && (
          <div style={{ fontSize: 14, color: "gray" }}>
            No cards to edit yet. Please go back and process input.
          </div>
        )}

        {state.processedCards.map((card, index) => (
          <Card withBorder key={index} p="sm">
            <Flex direction="column" gap="xs">
              <TextInput
                label="Term"
                value={card.term}
                onChange={(e) =>
                  dispatch({
                    type: "EDIT_CARD",
                    card: { ...card, term: e.currentTarget.value },
                    index,
                  })
                }
              />
              <TextInput
                label="Definition"
                value={card.definition}
                onChange={(e) =>
                  dispatch({
                    type: "EDIT_CARD",
                    card: { ...card, definition: e.currentTarget.value },
                    index,
                  })
                }
              />
              <Flex justify="flex-end">
                <Button
                  variant="outline"
                  color="red"
                  onClick={() =>
                    dispatch({ type: "REMOVE_CARD", index })
                  }
                >
                  Remove
                </Button>
              </Flex>
            </Flex>
          </Card>
        ))}

        <Divider my="sm" />
        <Flex justify="space-between">
          <Button variant="default" onClick={onBack} disabled={loading}>
            Back
          </Button>
          <Button
            onClick={onSave}
            disabled={loading || state.processedCards.length === 0}
          >
            Save Cards
          </Button>
        </Flex>
      </Flex>
    </Paper>
  );
}
