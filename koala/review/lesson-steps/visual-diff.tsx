import { Text, Box } from "@mantine/core";
import { diffWords } from "diff";
import { stripFinalPunctuation } from "../../quiz-evaluators/evaluator-utils";

interface SentencecorrectionProps {
  expected: string;
  actual: string;
  heading?: string;
}

export const VisualDiff: React.FC<SentencecorrectionProps> = ({
  expected,
  actual,
  heading,
}) => {
  const a = stripFinalPunctuation(actual);
  const e = stripFinalPunctuation(expected);
  const diff = diffWords(a, e, {
    ignoreCase: true,
    ignoreWhitespace: true,
  });

  return (
    <Box>
      <Text size="md" mb={heading ? "xs" : 0}>
        {heading}
      </Text>
      <Text size="md" lh={1.6}>
        {diff.map((part, index) => {
          let fontSize = 1;

          if (part.added) {
            fontSize = 1.1;
          }

          if (part.removed) {
            fontSize = 0.8;
          }

          const style = {
            // Make incorrect text lighter weight, and correct text bold
            fontWeight: part.added ? "bold" : "normal",
            textDecoration: part.removed ? "line-through" : "none",
            fontSize: `${fontSize}em`,
            padding: part.added ? "0 2px" : "0",
          };

          return (
            <span key={index} style={style}>
              {part.value}
            </span>
          );
        })}
      </Text>
    </Box>
  );
};
