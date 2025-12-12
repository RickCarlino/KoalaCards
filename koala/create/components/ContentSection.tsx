import type { CreateMode } from "@/koala/create/modes";
import {
  Button,
  Divider,
  Group,
  Paper,
  SegmentedControl,
  Table,
  Text,
  Textarea,
  TextInput,
  Title,
  useMantineTheme,
} from "@mantine/core";
import React from "react";

type ParsedRow = { term: string; definition: string };

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
          onChange={(value) => setMode(value as CreateMode)}
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

type ContentBaseProps = {
  textColor: string;
  rawInput: string;
  setRawInput: (text: string) => void;
};

function VibeContent(
  props: ContentBaseProps & {
    deckLangName: string;
    onGenerate: () => void;
  },
) {
  const { textColor, deckLangName, rawInput, setRawInput, onGenerate } =
    props;
  return (
    <>
      <Text size="sm" c={textColor} mb="xs">
        What cards shall we create? Example:{" "}
        {`"Please make 25 ${deckLangName} example sentences about food."`}
      </Text>
      <Textarea
        minRows={6}
        autosize
        placeholder={`Please make 25 ${deckLangName} example sentences about travel.`}
        value={rawInput}
        onChange={(e) => setRawInput(e.currentTarget.value)}
      />
      <Group justify="flex-end" mt="md">
        <Button onClick={onGenerate}>Generate</Button>
      </Group>
    </>
  );
}

function WordlistContent(
  props: ContentBaseProps & {
    onEnrich: () => void;
  },
) {
  const { textColor, rawInput, setRawInput, onEnrich } = props;
  return (
    <>
      <Text size="sm" c={textColor} mb="xs">
        Paste one word per line. We’ll fetch definitions.
      </Text>
      <Textarea
        minRows={6}
        autosize
        placeholder={`hola\nadiós\npor favor`}
        value={rawInput}
        onChange={(e) => setRawInput(e.currentTarget.value)}
      />
      <Group justify="flex-end" mt="md">
        <Button onClick={onEnrich}>Enrich</Button>
      </Group>
    </>
  );
}

function CsvContent(
  props: ContentBaseProps & {
    separator: string;
    setSeparator: (sep: string) => void;
    linesCount: number;
    parsedRows: ParsedRow[];
    onParse: () => void;
  },
) {
  const {
    textColor,
    separator,
    setSeparator,
    rawInput,
    setRawInput,
    linesCount,
    parsedRows,
    onParse,
  } = props;

  return (
    <>
      <Text size="sm" c={textColor} mb="xs">
        Each line: term{separator}definition. First value is term, the rest
        is definition.
      </Text>
      <Group align="flex-end" gap="md" mb="sm">
        <TextInput
          label="Separator"
          placeholder=","
          value={separator}
          onChange={(e) => setSeparator(e.currentTarget.value)}
          style={{ maxWidth: 200 }}
        />
        <Button onClick={onParse}>Parse</Button>
      </Group>
      <Textarea
        minRows={6}
        autosize
        placeholder={`hola, hello\nadiós, goodbye`}
        value={rawInput}
        onChange={(e) => setRawInput(e.currentTarget.value)}
      />
      <Divider my="sm" />
      <Text size="sm">{linesCount} lines detected • showing first 10</Text>
      <CsvPreview rows={parsedRows.slice(0, 10)} />
    </>
  );
}

function CsvPreview(props: { rows: ParsedRow[] }) {
  const { rows } = props;
  return (
    <Table withColumnBorders striped mt="xs">
      <thead>
        <tr>
          <th>Term</th>
          <th>Definition</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row, index) => (
          <tr key={index}>
            <td>
              {row.term || <em style={{ color: "gray" }}>No term</em>}
            </td>
            <td>
              {row.definition || (
                <em style={{ color: "gray" }}>No definition</em>
              )}
            </td>
          </tr>
        ))}
      </tbody>
    </Table>
  );
}
