import { Text } from "@mantine/core";
import { diffWords } from "diff";

interface SentencecorrectionProps {
  expected: string;
  actual: string;
}

export const VisualDiff: React.FC<SentencecorrectionProps> = ({
  expected,
  actual,
}) => {
  const diff = diffWords(actual, expected);

  return (
    <Text>
      {diff.map((part, index) => {
        const style = {
          // Make incorrect text lighter weight, and correct text bold
          fontWeight: part.added ? "bold" : "normal",
          textDecoration: part.removed ? "line-through" : "none",
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
