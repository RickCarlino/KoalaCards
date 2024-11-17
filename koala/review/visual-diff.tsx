import { Text } from "@mantine/core";
import { diffWords } from "diff";

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
  const stripFinalPunctuation = (str: string) => {
    return str.replace(/[.,!?]$/, "");
  };
  const a = stripFinalPunctuation(actual);
  const e = stripFinalPunctuation(expected);
  const diff = diffWords(a, e);

  return (
    <Text>
      {heading}
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
        };

        return (
          <span key={index} style={style}>
            {part.value}
          </span>
        );
      })}
    </Text>
  );
};
