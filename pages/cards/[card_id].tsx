import { timeUntil } from "@/koala/time-until";
import { GetServerSideProps } from "next";
import { getCardOrFail } from "@/koala/get-card-or-fail";
import { maybeGetCardImageUrl } from "@/koala/image";
import { getSession } from "next-auth/react"; // Assuming you're using NextAuth for authentication
import { Button, Checkbox, Container, Paper, TextInput } from "@mantine/core";
import { useForm } from "@mantine/form";
import { useRouter } from "next/router";
import { trpc } from "@/koala/trpc-config";
import { prismaClient } from "@/koala/prisma-client";

type LocalQuiz = {
  repetitions: number;
  lapses: number;
  lessonType: string;
  lastReview: number;
};
type CardData = {
  cardData: {
    id: number;
    definition: string;
    term: string;
    flagged: boolean;
    imageURL: string | null;
    quizzes: {
      quizId: number;
      // cardId: number;
      // definition: string;
      // definitionAudio: string;
      // langCode: string;
      lapses: number;
      lastReview: number;
      lessonType: string;
      repetitions: number;
      // term: string;
      // termAudio: string;
    }[];
  };
};

function CardQuiz(props: LocalQuiz) {
  const when = props.lastReview ? timeUntil(props.lastReview) : "never";
  return (
    <div>
      <h2>{props.lessonType.toUpperCase()}</h2>
      <p>Repetitions: {props.repetitions}</p>
      <p>Lapses: {props.lapses}</p>
      <p>Last Review: {when}</p>
    </div>
  );
}

function Card({ cardData }: CardData) {
  // Replace 'any' with appropriate type
  const router = useRouter();
  const form = useForm({
    initialValues: {
      definition: cardData.definition,
      term: cardData.term,
      flagged: cardData.flagged,
    },
  });
  const m = trpc.editCard.useMutation();
  const d = trpc.deleteCard.useMutation();
  const id = cardData.id;
  // Define updateForm function
  const updateForm = (values: {
    definition: string;
    term: string;
    flagged: boolean;
  }) => {
    // Logic to update the card will go here
    m.mutateAsync({
      id,
      definition: values.definition,
      term: values.term,
      flagged: values.flagged,
    }).then(() => {
      router.back();
    });
  };
  const deleteCard = () => {
    d.mutate({ id });
    router.back();
  };
  return (
    <div>
      <Paper shadow="xs">
        <form onSubmit={form.onSubmit(updateForm)}>
          <Container size="md">
            <h1>Card {cardData.id}</h1>
            <TextInput
              label="Definition"
              placeholder="Enter Definition"
              error={form.errors.en && "Please enter an Definition"}
              {...form.getInputProps("definition")}
            />
            <TextInput
              label="Term"
              placeholder="Enter Term"
              error={form.errors.ko && "Please enter a Term"}
              {...form.getInputProps("term")}
            />
            <Checkbox
              label="Flagged"
              checked={form.values.flagged}
              {...form.getInputProps("flagged")}
            />
          </Container>
          <Button type="submit">Update</Button>
          <Button color="red" type="submit" onClick={deleteCard}>
            Delete
          </Button>
          {cardData.imageURL && (
            <img
              width={"100%"}
              src={cardData.imageURL}
              alt={"Card illustration"}
            />
          )}
        </form>
        <h1>Quiz Data</h1>
        {cardData.quizzes.map((quiz) => {
          return <CardQuiz key={quiz.quizId} {...quiz} />;
        })}
      </Paper>
    </div>
  );
}

export default function CardPage({ cardData }: CardData) {
  return <Card cardData={cardData} />;
}

export const getServerSideProps: GetServerSideProps = async (context) => {
  const { card_id } = context.query;
  const session = await getSession(context);

  if (!session) {
    throw new Error("You must be logged in to view this page");
  }

  if (!session.user) {
    throw new Error("User not found");
  }

  if (!session) {
    return {
      redirect: {
        destination: "/api/auth/signin",
        permanent: false,
      },
    };
  }
  const userEmail = session.user.email;

  if (!userEmail) {
    throw new Error("User email not found");
  }

  const dbUser = await prismaClient.user.findUnique({
    where: {
      email: userEmail,
    },
  });
  const cardId = parseInt(card_id as string, 10);

  try {
    const card = await getCardOrFail(cardId, dbUser?.id);

    const imageURL = await maybeGetCardImageUrl(card.imageBlobId);

    const quizzes = card.Quiz.map((quiz) => ({
      quizId: quiz.id,
      cardId: card.id,
      definition: card.definition,
      term: card.term,
      repetitions: quiz.repetitions,
      lapses: quiz.lapses,
      lessonType: quiz.quizType,
      definitionAudio: "",
      termAudio: "",
      langCode: card.langCode,
      lastReview: quiz.lastReview,
    }));

    const cardData = {
      id: card.id,
      definition: card.definition,
      term: card.term,
      flagged: card.flagged,
      imageURL: imageURL || null,
      quizzes,
    };

    console.log(JSON.stringify(cardData, null, 2));
    return {
      props: {
        cardData,
      },
    };
  } catch (error) {
    return {
      notFound: true,
    };
  }
};
