import { Badge, Button, Group, Switch, Table, Text } from "@mantine/core";
import { IconPencil, IconTrash } from "@tabler/icons-react";
import { useRouter } from "next/router";
import React from "react";
import { trpc } from "./trpc-config";

type Card = {
  id: number;
  flagged: boolean;
  term: string;
  definition: string;
  createdAt: string; // ISO
  langCode: string;
  gender: string;
  repetitions: number;
  lapses: number;
  lastReview: number;
  nextReview: number;
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
  const edit = trpc.editCard.useMutation();
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

  const [paused, setPaused] = React.useState(card.flagged);
  const [toggling, setToggling] = React.useState(false);
  const togglePaused = async () => {
    try {
      setToggling(true);
      const next = !paused;
      setPaused(next);
      await edit.mutateAsync({ id: card.id, flagged: next });
    } catch (e) {
      console.error(e);
      setPaused((v) => !v);
    } finally {
      setToggling(false);
    }
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

  const formatDateISO = (iso: string) => iso.slice(0, 10);
  const formatEpoch = (ms: number) =>
    ms ? new Date(ms).toISOString().slice(0, 10) : "—";

  return (
    <tr>
      <td>
        <Group gap="xs" align="center">
          <Switch
            checked={paused}
            onChange={togglePaused}
            disabled={toggling}
            size="sm"
          />
          {paused && (
            <Badge size="xs" color="red" variant="light">
              Paused
            </Badge>
          )}
        </Group>
      </td>
      <td>
        <Text fw={600}>{card.term}</Text>
        <Text size="sm" c="dimmed">
          {card.definition}
        </Text>
      </td>
      <td>{card.repetitions}</td>
      <td>{card.lapses}</td>
      <td>{formatEpoch(card.nextReview)}</td>
      <td>{formatDateISO(card.createdAt)}</td>
      <td>
        <Group gap="xs" wrap="nowrap">
          <Button
            onClick={() => router.push(`/cards/${card.id}`)}
            variant="light"
          >
            <IconPencil stroke={1.5} />
          </Button>
          <Button
            disabled={disabled}
            color={color}
            onClick={deleteCard}
            variant="outline"
          >
            <IconTrash stroke={1.5} />
          </Button>
        </Group>
      </td>
    </tr>
  );
}

export const CardTable: React.FC<CardTableProps> = ({
  cards,
  onDelete,
}) => {
  return (
    <Table striped highlightOnHover withTableBorder withColumnBorders>
      <thead>
        <tr>
          <th>Paused</th>
          <th>Card</th>
          <th>Reps</th>
          <th>Lapses</th>
          <th>Next Review</th>
          <th>Created</th>
          <th>Actions</th>
        </tr>
      </thead>
      <tbody>
        {cards.map((card) => (
          <CardRow card={card as Card} onDelete={onDelete} key={card.id} />
        ))}
      </tbody>
    </Table>
  );
};
