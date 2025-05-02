import { Button, Table } from "@mantine/core";
import { IconPencil, IconTrash } from "@tabler/icons-react";
import { useRouter } from "next/router";
import React from "react";
import { trpc } from "./trpc-config";

type Card = {
  id: number;
  flagged: boolean;
  term: string;
  definition: string;
};
interface CardTableProps {
  cards: Card[];
  onDelete: () => void;
}

interface CardRowProps {
  card: Card;
  onDelete: () => void;
}

function CardRow({ card, onDelete }: CardRowProps) {
  const router = useRouter();
  const del = trpc.deleteCard.useMutation();
  const [color, setColor] = React.useState("red");
  const disabled = color !== "red";
  const deleteCard = () => {
    setColor("yellow");
    del.mutateAsync({ id: card.id }).then(
      () => {
        setColor("gray");
        onDelete();
      },
      (e) => {
        console.error(e);
        setColor("blue");
      },
    );
  };

  if (disabled) {
    return (
      <tr>
        <td></td>
        <td></td>
        <td></td>
        <td></td>
        <td></td>
      </tr>
    );
  }

  return (
    <tr>
      <td>{card.flagged ? "⏸️" : ""}</td>
      <td>{card.definition}</td>
      <td>{card.term}</td>
      <td>
        <Button disabled={disabled} color={color} onClick={deleteCard}>
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
}

export const CardTable: React.FC<CardTableProps> = ({
  cards,
  onDelete,
}) => {
  return (
    <Table>
      <thead>
        <tr>
          <th></th>
          <th>Definition</th>
          <th>Term</th>
          <th>Delete</th>
          <th>Edit</th>
        </tr>
      </thead>
      <tbody>
        {cards.map((card) => (
          <CardRow card={card} onDelete={onDelete} key={card.id} />
        ))}
      </tbody>
    </Table>
  );
};
