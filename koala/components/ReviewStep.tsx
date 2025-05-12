import {
  Button,
  Paper,
  Title,
  Divider,
  Flex,
  Card,
  TextInput,
  Text,
  useMantineTheme,
  Group,
} from "@mantine/core";
import { ReviewStepProps } from "../types/create-types";
import { buttonShadow, paperStyle, titleStyle } from "../styles";

export function ReviewStep({
  state,
  dispatch,
  onBack,
  onSave,
  loading,
}: ReviewStepProps) {
  const theme = useMantineTheme();

  return (
    <Paper withBorder p="xl" radius="lg" style={paperStyle(theme)}>
      <Flex direction="column" gap="md">
        <Title order={3} mb="xs" style={titleStyle(theme)}>
          Step 3: Review & Edit Cards
        </Title>

        <Text size="sm" c={theme.colors.gray[7]} mb="md">
          Verify each card is correct. You can edit the term or definition
          if needed, or remove cards that you don't want. When satisfied,
          click "Save Cards".
        </Text>

        {state.processedCards.length === 0 && (
          <Text
            size="sm"
            c={theme.colors.gray[6]}
            ta="center"
            p="xl"
            style={{
              backgroundColor: theme.colors.pink[0],
              borderRadius: theme.radius.md,
              border: `1px dashed ${theme.colors.pink[3]}`,
            }}
          >
            No cards to edit yet. Please go back and process input.
          </Text>
        )}

        {state.processedCards.map((card, index) => (
          <Card
            key={index}
            p="md"
            radius="md"
            style={{
              border: `1px solid ${theme.colors.pink[2]}`,
              backgroundColor: theme.white,
              boxShadow: "0 2px 4px rgba(0,0,0,0.03)",
            }}
          >
            <Flex direction="column" gap="md">
              <TextInput
                label={
                  <Text fw={500} c={theme.colors.gray[7]}>
                    Term
                  </Text>
                }
                value={card.term}
                onChange={(e) =>
                  dispatch({
                    type: "EDIT_CARD",
                    card: { ...card, term: e.currentTarget.value },
                    index,
                  })
                }
                styles={{
                  input: {
                    borderColor: theme.colors.pink[1],
                    "&:focus": {
                      borderColor: theme.colors.pink[5],
                    },
                  },
                }}
              />
              <TextInput
                label={
                  <Text fw={500} c={theme.colors.gray[7]}>
                    Definition
                  </Text>
                }
                value={card.definition}
                onChange={(e) =>
                  dispatch({
                    type: "EDIT_CARD",
                    card: { ...card, definition: e.currentTarget.value },
                    index,
                  })
                }
                styles={{
                  input: {
                    borderColor: theme.colors.pink[1],
                    "&:focus": {
                      borderColor: theme.colors.pink[5],
                    },
                  },
                }}
              />
              <Group justify="flex-end">
                <Button
                  variant="light"
                  color="red"
                  radius="md"
                  onClick={() => dispatch({ type: "REMOVE_CARD", index })}
                  style={buttonShadow}
                >
                  Remove
                </Button>
              </Group>
            </Flex>
          </Card>
        ))}

        <Divider my="lg" color={theme.colors.pink[1]} />

        <Flex justify="space-between">
          <Button
            variant="outline"
            onClick={onBack}
            disabled={loading}
            color="pink"
            radius="md"
            style={buttonShadow}
          >
            Back
          </Button>
          <Button
            onClick={onSave}
            disabled={loading || state.processedCards.length === 0}
            color="pink"
            radius="md"
            style={buttonShadow}
          >
            Save Cards
          </Button>
        </Flex>
      </Flex>
    </Paper>
  );
}
