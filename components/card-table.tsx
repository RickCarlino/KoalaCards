import { Button, Grid, Table } from "@mantine/core";
import { Card } from "@prisma/client";
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

type LocalPhrase = Pick<Card, Keys>;
interface PhraseTableProps {
  cards: LocalPhrase[];
}

export const CardTable: React.FC<PhraseTableProps> = ({ cards }) => {
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
          {cards.map((card) => (
            <tr key={card.id}>
              <td>{card.id}</td>
              <td>{card.flagged ? "🚩" : ""}</td>
              <td>{card.en}</td>
              <td>{card.ko}</td>
              <td>{card.total_attempts}</td>
              <td>{Math.round(card.win_percentage * 100)}</td>
              <td>
                <Button onClick={() => router.push(`/cards/${card.id}`)}>
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
