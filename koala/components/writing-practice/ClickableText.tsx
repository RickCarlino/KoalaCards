import { SelectedWords } from "@/koala/components/writing-practice/types";
import { normalizeWordToken } from "@/koala/components/writing-practice/word-utils";
import { Text, useMantineTheme } from "@mantine/core";

type ClickableTextProps = {
  text: string;
  selectedWords: SelectedWords;
  onToggleWord: (rawWord: string) => void;
};

function splitPreservingWhitespace(text: string) {
  return text.split(/(\s+)/);
}

export function ClickableText({
  text,
  selectedWords,
  onToggleWord,
}: ClickableTextProps) {
  const theme = useMantineTheme();

  if (!text) {
    return null;
  }

  return (
    <Text size="sm" style={{ whiteSpace: "pre-wrap" }}>
      {splitPreservingWhitespace(text).map((token, index) => {
        if (/\s+/.test(token)) {
          return <span key={index}>{token}</span>;
        }

        const normalized = normalizeWordToken(token);
        const isSelected = Boolean(selectedWords[normalized]);

        return (
          <Text
            component="span"
            key={index}
            style={{
              cursor: "pointer",
              backgroundColor: isSelected
                ? theme.colors.yellow[2]
                : undefined,
              borderRadius: theme.radius.sm,
              padding: "0 2px",
              margin: "0 1px",
              display: "inline-block",
            }}
            onClick={() => onToggleWord(token)}
          >
            {token}
          </Text>
        );
      })}
    </Text>
  );
}
