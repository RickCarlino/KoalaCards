import { trpc } from "@/utils/trpc";
import { Button, Table } from "@mantine/core";
import { IconPencil, IconTrash } from "@tabler/icons-react";
import { useRouter } from "next/router";
import React, { useState } from "react";

type Card = {
  id: number;
  flagged: boolean;
  term: string;
  definition: string;
};
interface CardTableProps {
  cards: Card[];
}

type CardRowProps = {
  card: Card;
};
const CardRow = ({ card }: CardRowProps) => {
  const router = useRouter();
  const deleteCard = trpc.deleteCard.useMutation();
  const [color, setColor] = useState("red");

  return (
    <tr key={card.id}>
      <td>{card.id}</td>
      <td>{card.flagged ? "🚩" : ""}</td>
      <td>{card.definition}</td>
      <td>{card.term}</td>
      <td>
        <Button
          color={color}
          onClick={() => {
            deleteCard.mutate({ id: card.id });
            setColor("gray");
          }}
        >
          <IconTrash stroke={1.5} />
        </Button>
      </td>
      <td>
        <Button onClick={() => router.push(`/cards/${card.id}`)}>
          <IconPencil stroke={1.5} />
        </Button>
      </td>
    </tr>
  );
};

export const CardTable: React.FC<CardTableProps> = ({ cards }) => {
  return (
    <Table>
      <thead>
        <tr>
          <th>ID</th>
          <th>Flagged</th>
          <th>Definition</th>
          <th>Term</th>
          <th>Delete</th>
          <th>Edit</th>
        </tr>
      </thead>
      <tbody>
        {cards.map((c) => (
          <CardRow card={c} key={c.id} />
        ))}
      </tbody>
    </Table>
  );
};
