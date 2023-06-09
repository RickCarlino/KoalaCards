import { Button, Grid, Table } from "@mantine/core";
import { Phrase } from "@prisma/client";
import { IconPencil } from "@tabler/icons-react";
import { useRouter } from "next/router";
import React from "react";

type Keys =
  | "en"
  | "id"
  | "ko"
  | "total_attempts"
  | "win_percentage"
  | "flagged";

type LocalPhrase = Pick<Phrase, Keys>;
interface PhraseTableProps {
  phrases: LocalPhrase[];
}

export const PhraseTable: React.FC<PhraseTableProps> = ({ phrases }) => {
  const router = useRouter();
  return (
    <Grid>
      <Table>
        <thead>
          <tr>
            <th>ID</th>
            <th>Flagged</th>
            <th>English</th>
            <th>Korean</th>
            <th>Total Attempts</th>
            <th>Win Percentage</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {phrases.map((phrase) => (
            <tr key={phrase.id}>
              <td>{phrase.id}</td>
              <td>{phrase.flagged ? "🚩" : ""}</td>
              <td>{phrase.en}</td>
              <td>{phrase.ko}</td>
              <td>{phrase.total_attempts}</td>
              <td>{phrase.win_percentage}</td>
              <td>
                <Button onClick={() => router.push(`/cards/${phrase.id}`)}>
                  <IconPencil stroke={1.5} />
                </Button>
              </td>
            </tr>
          ))}
        </tbody>
      </Table>
    </Grid>
  );
};
