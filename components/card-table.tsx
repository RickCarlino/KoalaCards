import { Button, Table } from "@mantine/core";
import { IconPencil } from "@tabler/icons-react";
import { useRouter } from "next/router";
import React from "react";

type Card = {
  id: number;
  flagged: boolean;
  term: string;
  definition: string;
};
interface PhraseTableProps {
  cards: Card[];
}

export const CardTable: React.FC<PhraseTableProps> = ({ cards }) => {
  const router = useRouter();
  return (
    <Table>
      <thead>
        <tr>
          <th>ID</th>
          <th>Flagged</th>
          <th>Definition</th>
          <th>Term</th>
          <th>Edit</th>
        </tr>
      </thead>
      <tbody>
        {cards.map((card) => (
          <tr key={card.id}>
            <td>{card.id}</td>
            <td>{card.flagged ? "🚩" : ""}</td>
            <td>{card.definition}</td>
            <td>{card.term}</td>
            <td>
              <Button onClick={() => router.push(`/cards/${card.id}`)}>
                <IconPencil stroke={1.5} />
              </Button>
            </td>
          </tr>
        ))}
      </tbody>
    </Table>
  );
};
