import { getCardOrFail } from "@/koala/get-card-or-fail";
import { getServersideUser } from "@/koala/get-serverside-user";
import { maybeGetCardImageUrl } from "@/koala/image";
import { timeUntil } from "@/koala/time-until";
import { trpc } from "@/koala/trpc-config";
import {
  Button,
  Checkbox,
  Container,
  Flex,
  Paper,
  Stack,
  Table,
  TextInput,
  Title,
} from "@mantine/core";
import { useForm } from "@mantine/form";
import { GetServerSideProps } from "next";
import { useRouter } from "next/router";

type CardData = {
  cardData: {
    id: number;
    definition: string;
    term: string;
    flagged: boolean;
    imageURL: string | null;
    quizzes: {
      quizId: number;
      repetitions: number;
      lapses: number;
      lessonType: string;
      lastReview: number;
    }[];
  };
};

function Card({ cardData }: CardData) {
  const router = useRouter();
  const form = useForm({
    initialValues: {
      definition: cardData.definition,
      term: cardData.term,
      flagged: cardData.flagged,
    },
  });
  const updateMutation = trpc.editCard.useMutation();
  const deleteMutation = trpc.deleteCard.useMutation();
  const id = cardData.id;

  const updateForm = (values: {
    definition: string;
    term: string;
    flagged: boolean;
  }) => {
    updateMutation
      .mutateAsync({ id, ...values })
      .then(() => router.back());
  };

  const deleteCard = () => {
    deleteMutation.mutate({ id });
    router.back();
  };

  return (
    <Container size="sm" py="xl">
      <Paper withBorder p="xl" radius="md" shadow="xs">
        <Title order={2} mb="md">
          Edit Card #{cardData.id}
        </Title>
        <form onSubmit={form.onSubmit(updateForm)}>
          <Stack gap="md">
            <TextInput
              label="Term"
              placeholder="Enter the term"
              {...form.getInputProps("term")}
            />
            <TextInput
              label="Definition"
              placeholder="Enter the definition"
              {...form.getInputProps("definition")}
            />
            <Checkbox
              label="Pause reviews of this card"
              {...form.getInputProps("flagged", { type: "checkbox" })}
            />
            <Flex justify="space-between" mt="md" gap="md">
              <Button type="submit">Save Changes</Button>
              <Button variant="outline" color="red" onClick={deleteCard}>
                Delete Card
              </Button>
            </Flex>
            {cardData.quizzes.length > 0 && (
              <Stack gap="md" mt="xl">
                <Title order={3}>Quiz History</Title>
                <Table
                  withTableBorder
                  withRowBorders
                  withColumnBorders
                  highlightOnHover
                  verticalSpacing="sm"
                >
                  <thead>
                    <tr>
                      <th>Lesson Type</th>
                      <th>Repetitions</th>
                      <th>Lapses</th>
                      <th>Last Review</th>
                    </tr>
                  </thead>
                  <tbody>
                    {cardData.quizzes.map((quiz) => (
                      <tr key={quiz.quizId}>
                        <td>{quiz.lessonType.toUpperCase()}</td>
                        <td>{quiz.repetitions}</td>
                        <td>{quiz.lapses}</td>
                        <td>
                          {quiz.lastReview
                            ? timeUntil(quiz.lastReview)
                            : "never"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              </Stack>
            )}
            {cardData.imageURL && (
              <Paper withBorder p="sm" radius="md">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  width="100%"
                  src={cardData.imageURL}
                  alt="Card illustration"
                />
              </Paper>
            )}
          </Stack>
        </form>
      </Paper>
    </Container>
  );
}

export default function CardPage({ cardData }: CardData) {
  return <Card cardData={cardData} />;
}

export const getServerSideProps: GetServerSideProps = async (context) => {
  const { card_id } = context.query;
  const dbUser = await getServersideUser(context);
  const cardId = parseInt(card_id as string, 10);

  const card = await getCardOrFail(cardId, dbUser?.id);
  const imageURL = await maybeGetCardImageUrl(card.imageBlobId);

  const quizzes = card.Quiz.map((quiz) => ({
    quizId: quiz.id,
    repetitions: quiz.repetitions,
    lapses: quiz.lapses,
    lessonType: quiz.quizType,
    lastReview: quiz.lastReview,
  }));

  return {
    props: {
      cardData: {
        id: card.id,
        definition: card.definition,
        term: card.term,
        flagged: card.flagged,
        imageURL: imageURL || null,
        quizzes,
      },
    },
  };
};
