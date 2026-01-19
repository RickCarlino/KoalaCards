import { Text, Box } from "@mantine/core";
import { diffWords } from "diff";
import { stripFinalPunctuation } from "../../quiz-evaluators/evaluator-utils";

interface SentencecorrectionProps {
  expected: string;
  actual: string;
  heading?: string;
}

type DiffTokenVariant = "added" | "removed" | "base";

const getDiffVariant = (part: { added?: boolean; removed?: boolean }) => {
  if (part.added) {
    return "added";
  }
  if (part.removed) {
    return "removed";
  }
  return "base";
};

const diffTokenProps: Record<
  DiffTokenVariant,
  {
    fw?: number;
    td?: "line-through";
    fz?: "sm" | "md" | "lg";
    px?: number;
  }
> = {
  added: { fw: 600, fz: "lg", px: 2 },
  removed: { fz: "sm", td: "line-through" },
  base: { fz: "md" },
};

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
          const variant = getDiffVariant(part);
          const tokenProps = diffTokenProps[variant];

          return (
            <Text key={index} component="span" {...tokenProps}>
              {part.value}
            </Text>
          );
        })}
      </Text>
    </Box>
  );
};
