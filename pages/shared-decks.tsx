import { GetServerSideProps } from "next";
import { prismaClient as prisma } from "../koala/prisma-client";
import {
  Container,
  Title,
  Text,
  SimpleGrid,
  Card,
  Group,
  TextInput,
  Button,
  Select,
  Pagination,
} from "@mantine/core";
import { useRouter } from "next/router";
import React from "react";
import { trpc } from "../koala/trpc-config";
import Link from "next/link";

export const getServerSideProps: GetServerSideProps = async (context) => {
  const { search, page } = context.query;
  const pageNum = parseInt((page as string) || "1", 10);
  const filter = {
    ...(search
      ? {
          name: { contains: String(search), mode: "insensitive" as const },
        }
      : {}),
    published: true,
  };
  const take = 15;
  const totalCount = await prisma.deck.count({ where: filter });
  const totalPages = Math.ceil(totalCount / take);
  const decksRaw = await prisma.deck.findMany({
    where: filter,
    include: { _count: { select: { Card: true } } },
    skip: (pageNum - 1) * take,
    take,
  });
  const decks = decksRaw.map((deck) => ({
    ...deck,
    createdAt: null,
  }));
  const languages = ["ko"];

  return {
    props: {
      decks,
      languages,
      page: pageNum,
      totalPages,
    },
  };
};

interface Deck {
  id: number;
  name: string;
  description: string | null;
  createdAt: string;
  userId: string;
  _count: {
    Card: number;
  };
}

interface SharedDecksProps {
  decks: Deck[];
  languages: string[];
  page: number;
  totalPages: number;
}

const SharedDecks = ({
  decks,
  languages,
  page,
  totalPages,
}: SharedDecksProps) => {
  const router = useRouter();
  const reportDeckMutation = trpc.reportDeck.useMutation();
  const copyDeckMutation = trpc.copyDeck.useMutation();
  const handleReport = (deckId: number) => {
    reportDeckMutation.mutate({ deckId });
  };
  const handleImport = (deckId: number) => {
    copyDeckMutation.mutate({ deckId });
  };
  const searchQuery = router.query.search || "";
  const langQuery = router.query.lang || "";

  return (
    <Container mt="xl">
      <Title order={1} mb="md" style={{ textAlign: "center" }}>
        Community Decks
      </Title>

      <form
        method="get"
        style={{
          marginBottom: "1rem",
          display: "flex",
          gap: "0.5rem",
          justifyContent: "center",
        }}
      >
        <TextInput
          placeholder="Search decks"
          name="search"
          defaultValue={String(searchQuery)}
          style={{ maxWidth: "300px" }}
        />
        <Select
          name="lang"
          defaultValue={String(langQuery)}
          variant="filled"
          style={{ maxWidth: "150px" }}
          data={[
            { value: "", label: "All Languages" },
            ...languages.map((lang) => ({ value: lang, label: lang })),
          ]}
        />
        <Button type="submit">Search</Button>
      </form>

      {decks.length === 0 ? (
        <Text color="dimmed" style={{ textAlign: "center" }}>
          No community decks available. Want to try an{" "}
          <Link href="/create">AI generated deck</Link> instead?
        </Text>
      ) : (
        <>
          <SimpleGrid cols={1} spacing="md">
            {decks.map((deck) => (
              <Card
                key={deck.id}
                shadow="sm"
                padding="lg"
                radius="md"
                withBorder
              >
                <Group justify="space-between" mb="sm">
                  <Title order={4}>{deck.name}</Title>
                </Group>
                <Text size="xs" color="dimmed" mb="xs">
                  Contains {deck._count.Card} cards
                </Text>
                <Text size="xs" color="dimmed" mb="sm">
                  By: {deck.userId}
                </Text>
                {deck.description && (
                  <Text size="sm" color="dimmed" mb="md">
                    {deck.description}
                  </Text>
                )}
                <Text size="xs" color="dimmed">
                  Created on:{" "}
                  {!deck.createdAt ||
                  isNaN(new Date(deck.createdAt).getTime())
                    ? "N/A"
                    : new Date(deck.createdAt).toLocaleDateString()}
                </Text>
                <Group mt="md" style={{ gap: "8px" }}>
                  <Button
                    variant="outline"
                    color="red"
                    size="xs"
                    onClick={() => handleReport(deck.id)}
                  >
                    Report
                  </Button>
                  <Button
                    variant="outline"
                    size="xs"
                    onClick={() => handleImport(deck.id)}
                  >
                    Import
                  </Button>
                </Group>
              </Card>
            ))}
          </SimpleGrid>
          <Group style={{ justifyContent: "center" }} mt="md">
            <Pagination
              value={page}
              total={totalPages}
              onChange={(newPage) =>
                router.push({
                  pathname: router.pathname,
                  query: { ...router.query, page: newPage },
                })
              }
            />
          </Group>
        </>
      )}
    </Container>
  );
};

export default SharedDecks;
