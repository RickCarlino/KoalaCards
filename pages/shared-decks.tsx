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
} from "@mantine/core";
import { useRouter } from "next/router";
import React from "react";
import { trpc } from "../koala/trpc-config";

export const getServerSideProps: GetServerSideProps = async (context) => {
  const { search, lang } = context.query;
  const decksRaw = await prisma.deck.findMany({
    where: {
      ...(search ? { name: { contains: String(search), mode: "insensitive" } } : {}),
      ...(lang && lang !== "" ? { langCode: String(lang) } : {}),
    },
    include: {
      _count: { select: { Card: true } }
    }
  });
  // Since Deck model does not have a createdAt field, provide a fallback null
  const decks = decksRaw.map((deck) => ({
    ...deck,
    createdAt: null,
  }));
  
  const languagesGroup = await prisma.deck.groupBy({
    by: ["langCode"],
  });
  const languages = languagesGroup.map((item) => item.langCode);
  
  return {
    props: {
      decks,
      languages,
    },
  };
};

interface Deck {
  id: number;
  name: string;
  description: string | null;
  createdAt: string;
  langCode: string;
  userId: string;
  _count: {
    Card: number;
  };
}

interface SharedDecksProps {
  decks: Deck[];
  languages: string[];
}

const SharedDecks = ({ decks, languages }: SharedDecksProps) => {
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
            ...languages.map((lang) => ({ value: lang, label: lang }))
          ]}
        />
        <Button type="submit">Search</Button>
      </form>

      {decks.length === 0 ? (
        <Text color="dimmed" style={{ textAlign: "center" }}>
          No community decks available.
        </Text>
      ) : (
        <SimpleGrid cols={1} spacing="md">
          {decks.map((deck) => (
            <Card key={deck.id} shadow="sm" padding="lg" radius="md" withBorder>
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
                Created on: {
                  !deck.createdAt || isNaN(new Date(deck.createdAt).getTime())
                    ? "N/A"
                    : new Date(deck.createdAt).toLocaleDateString()
                }
              </Text>
              <Group mt="md">
                <Button variant="outline" color="red" size="xs" onClick={() => handleReport(deck.id)}>
                  Report
                </Button>
                <Button variant="outline" size="xs" onClick={() => handleImport(deck.id)}>
                  Import
                </Button>
              </Group>
            </Card>
          ))}
        </SimpleGrid>
      )}
    </Container>
  );
};

export default SharedDecks;
