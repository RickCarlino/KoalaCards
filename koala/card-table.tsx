import { ActionIcon, Group, Switch, Table, Text } from "@mantine/core";
import { IconPencil, IconTrash } from "@tabler/icons-react";
import { useRouter } from "next/router";
import React from "react";
import { notifications } from "@mantine/notifications";
import { trpc } from "./trpc-config";

type Card = {
  id: number;
  paused: boolean;
  term: string;
  definition: string;
  createdAt: string;
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
  const [deleted, setDeleted] = React.useState(false);
  const deleteCard = () => {
    del.mutate(
      { id: card.id },
      {
        onSuccess: () => {
          setDeleted(true);
          onDelete();
        },
        onError: () => {
          notifications.show({
            color: "red",
            message: "Couldn't delete the card. Try again.",
          });
        },
      },
    );
  };

  const [paused, setPaused] = React.useState(card.paused);
  const [toggling, setToggling] = React.useState(false);
  const togglePaused = async () => {
    try {
      setToggling(true);
      const next = !paused;
      setPaused(next);
      await edit.mutateAsync({ id: card.id, paused: next });
    } catch (e) {
      console.error(e);
      setPaused((v) => !v);
      notifications.show({
        color: "red",
        message: "Couldn't update the card. Try again.",
      });
    } finally {
      setToggling(false);
    }
  };

  if (deleted) {
    return null;
  }

  const formatDateISO = (iso: string) => iso.slice(0, 10);
  const formatEpoch = (ms: number) =>
    ms ? new Date(ms).toISOString().slice(0, 10) : "—";

  return (
    <Table.Tr>
      <Table.Td>
        <Group gap="xs" align="center">
          <Switch
            checked={paused}
            onChange={togglePaused}
            disabled={toggling || del.isPending}
            size="sm"
            aria-label={`Pause reviews of ${card.term}`}
          />
        </Group>
      </Table.Td>
      <Table.Td miw={200}>
        <Text fw={500} lang="ko">
          {card.term}
        </Text>
        <Text size="sm" c="pastel.6">
          {card.definition}
        </Text>
      </Table.Td>
      <Table.Td>{card.repetitions}</Table.Td>
      <Table.Td>{card.lapses}</Table.Td>
      <Table.Td>{formatEpoch(card.nextReview)}</Table.Td>
      <Table.Td>{formatDateISO(card.createdAt)}</Table.Td>
      <Table.Td>
        <Group gap="xs" wrap="nowrap">
          <ActionIcon
            onClick={() => router.push(`/cards/${card.id}`)}
            variant="subtle"
            size="lg"
            aria-label="Edit card"
            disabled={toggling || del.isPending}
          >
            <IconPencil stroke={1.5} />
          </ActionIcon>
          <ActionIcon
            loading={del.isPending}
            disabled={toggling}
            color="red.8"
            onClick={deleteCard}
            variant="subtle"
            size="lg"
            aria-label="Delete card"
          >
            <IconTrash stroke={1.5} />
          </ActionIcon>
        </Group>
      </Table.Td>
    </Table.Tr>
  );
}

export const CardTable: React.FC<CardTableProps> = ({
  cards,
  onDelete,
}) => {
  return (
    <Table
      highlightOnHover
      horizontalSpacing="md"
      verticalSpacing="sm"
      styles={{ th: { whiteSpace: "nowrap" } }}
    >
      <Table.Thead>
        <Table.Tr>
          <Table.Th>Paused</Table.Th>
          <Table.Th>Card</Table.Th>
          <Table.Th>Reps</Table.Th>
          <Table.Th>Lapses</Table.Th>
          <Table.Th>Next Review</Table.Th>
          <Table.Th>Created</Table.Th>
          <Table.Th>Actions</Table.Th>
        </Table.Tr>
      </Table.Thead>
      <Table.Tbody>
        {cards.map((card) => (
          <CardRow card={card as Card} onDelete={onDelete} key={card.id} />
        ))}
      </Table.Tbody>
    </Table>
  );
};
