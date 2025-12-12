import { getServersideUser } from "@/koala/get-serverside-user";
import { prismaClient } from "@/koala/prisma-client";
import { LangCode } from "@/koala/shared-types";
import { WritingPractice } from "@/koala/components/writing-practice/WritingPractice";
import { Container, Title } from "@mantine/core";
import { GetServerSideProps } from "next";

type WritingPageProps = { deckId: number; langCode: LangCode };

export const getServerSideProps: GetServerSideProps<
  WritingPageProps
> = async (ctx) => {
  const dbUser = await getServersideUser(ctx);
  if (!dbUser) {
    return {
      redirect: { destination: "/api/auth/signin", permanent: false },
    };
  }
  const { deckId } = ctx.params as { deckId: string };
  const parsedId = parseInt(deckId, 10);
  if (isNaN(parsedId)) {
    return { notFound: true };
  }

  const deckExists = await prismaClient.deck.findUnique({
    where: { id: parsedId, userId: dbUser.id },
    select: { id: true },
  });

  if (!deckExists) {
    return { redirect: { destination: "/review", permanent: false } };
  }
  return {
    props: {
      deckId: parsedId,
      langCode: "ko" as LangCode,
    },
  };
};

export default function WritingPage({
  deckId,
  langCode,
}: WritingPageProps) {
  return (
    <Container size="sm" py="md">
      <Title order={2} mb="md">
        Writing Practice
      </Title>
      <WritingPractice deckId={deckId} langCode={langCode} />
    </Container>
  );
}
