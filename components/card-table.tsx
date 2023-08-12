import { Button, Grid, Table } from "@mantine/core";
import { IconPencil } from "@tabler/icons-react";
import { useRouter } from "next/router";
import React from "react";

type CardWithPhrase = {
  id: number;
  flagged: boolean;
  phrase: {
    id: number;
    term: string;
    definition: string;
  };
};
interface PhraseTableProps {
  cards: CardWithPhrase[];
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
            <th>Edit</th>
          </tr>
        </thead>
        <tbody>
          {cards.map((card) => (
            <tr key={card.id}>
              <td>{card.id}</td>
              <td>{card.flagged ? "🚩" : ""}</td>
              <td>{card.phrase.definition}</td>
              <td>{card.phrase.term}</td>
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
