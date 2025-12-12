import { parseCreateMode, type CreateMode } from "@/koala/create/modes";
import { CsvContent } from "@/koala/create/components/content/CsvContent";
import { VibeContent } from "@/koala/create/components/content/VibeContent";
import { WordlistContent } from "@/koala/create/components/content/WordlistContent";
import type { ParsedRow } from "@/koala/types/create-types";
import {
  Group,
  Paper,
  SegmentedControl,
  Title,
  useMantineTheme,
} from "@mantine/core";
import React from "react";

type ContentSectionProps = {
  mode: CreateMode;
  setMode: (mode: CreateMode) => void;
  rawInput: string;
  setRawInput: (text: string) => void;
  separator: string;
  setSeparator: (sep: string) => void;
  linesCount: number;
  parsedRows: ParsedRow[];
  deckLangName: string;
  onSubmitVibe: () => void;
  onProcessWordlist: () => void;
  onParseCsv: () => void;
};

export function ContentSection(props: ContentSectionProps) {
  const {
    mode,
    setMode,
    rawInput,
    setRawInput,
    separator,
    setSeparator,
    linesCount,
    parsedRows,
    deckLangName,
    onSubmitVibe,
    onProcessWordlist,
    onParseCsv,
  } = props;

  const theme = useMantineTheme();

  const contentByMode: Record<CreateMode, React.ReactNode> = {
    vibe: (
      <VibeContent
        deckLangName={deckLangName}
        rawInput={rawInput}
        setRawInput={setRawInput}
        onGenerate={onSubmitVibe}
        textColor={theme.colors.gray[7]}
      />
    ),
    wordlist: (
      <WordlistContent
        rawInput={rawInput}
        setRawInput={setRawInput}
        onEnrich={onProcessWordlist}
        textColor={theme.colors.gray[7]}
      />
    ),
    csv: (
      <CsvContent
        separator={separator}
        setSeparator={setSeparator}
        rawInput={rawInput}
        setRawInput={setRawInput}
        linesCount={linesCount}
        parsedRows={parsedRows}
        onParse={onParseCsv}
        textColor={theme.colors.gray[7]}
      />
    ),
  };

  return (
    <Paper withBorder p="md" radius="md">
      <Group justify="space-between" mb="xs">
        <Title order={4}>Content</Title>
        <SegmentedControl
          value={mode}
          onChange={(value) => {
            const nextMode = parseCreateMode(value);
            if (nextMode) {
              setMode(nextMode);
            }
          }}
          data={[
            { label: "Free Form", value: "vibe" },
            { label: "Word list", value: "wordlist" },
            { label: "CSV/Text", value: "csv" },
          ]}
        />
      </Group>
      {contentByMode[mode]}
    </Paper>
  );
}
