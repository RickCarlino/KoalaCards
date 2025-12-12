import { WordDefinition } from "@/koala/components/writing-practice/types";
import { shouldShowLemma } from "@/koala/components/writing-practice/word-utils";
import { Box, Stack, Text } from "@mantine/core";
import { alphabetical } from "radash";

type DefinitionsListProps = {
  definitions: WordDefinition[];
};

export function DefinitionsList({ definitions }: DefinitionsListProps) {
  return (
    <Stack gap="xs">
      <Text fw={600}>Word Definitions</Text>
      {alphabetical(definitions, (x) => x.definition).map(
        (definition, index) => {
          const showLemma = shouldShowLemma(
            definition.word,
            definition.lemma,
          );

          return (
            <Box key={index}>
              <Text fw={700} component="span">
                {definition.word}
              </Text>
              {showLemma ? (
                <Text component="span" c="dimmed" fs="italic">
                  {" "}
                  ({definition.lemma})
                </Text>
              ) : null}
              <Text component="span">: {definition.definition}</Text>
            </Box>
          );
        },
      )}
    </Stack>
  );
}
