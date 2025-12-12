import type { ParsedRow } from "@/koala/types/create-types";
import {
  Button,
  Divider,
  Group,
  Table,
  Text,
  Textarea,
  TextInput,
} from "@mantine/core";
import React from "react";

type CsvContentProps = {
  textColor: string;
  separator: string;
  setSeparator: (sep: string) => void;
  rawInput: string;
  setRawInput: (text: string) => void;
  linesCount: number;
  parsedRows: ParsedRow[];
  onParse: () => void;
};

export function CsvContent(props: CsvContentProps) {
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
          <tr key={getRowKey(row, index)}>
            <td>{row.term || <EmptyCell text="No term" />}</td>
            <td>{row.definition || <EmptyCell text="No definition" />}</td>
          </tr>
        ))}
      </tbody>
    </Table>
  );
}

function EmptyCell(props: { text: string }) {
  const { text } = props;
  return (
    <Text component="span" c="dimmed" style={{ fontStyle: "italic" }}>
      {text}
    </Text>
  );
}

function getRowKey(row: ParsedRow, index: number) {
  return `${index}:${row.term}:${row.definition}`;
}
