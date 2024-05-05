import { timeUntil } from "@/koala/time-until";
import { trpc } from "@/koala/trpc-config";
import { Button, Checkbox, Container, Paper, TextInput } from "@mantine/core";
import { useForm } from "@mantine/form";
import { useRouter } from "next/router";

type LocalQuiz = {
  repetitions: number;
  lapses: number;
  lessonType: string;
  lastReview: number;
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

function Card({ id }: { id: number }) {
  const router = useRouter();
  const form = useForm({
    initialValues: {
      definition: "loading...",
      term: "Loading...",
      flagged: false,
    },
  });
  const m = trpc.editCard.useMutation();
  const d = trpc.deleteCard.useMutation();
  const card = trpc.getOneCard.useQuery(
    { id },
    {
      onSuccess: (data) => {
        form.setValues({
          definition: data.definition,
          term: data.term,
          flagged: data.flagged,
        });
      },
    },
  );
  if (card.error)
    return <pre>{JSON.stringify(card.error.message, null, 2)}</pre>;
  if (!card.data) return <div>Loading data...</div>;
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
            <h1>Card {card.data.id}</h1>
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
          {card.data.imageURL && (
              <img width={"100%"} src={card.data.imageURL} alt={"Card illustration"} />
            )}
        </form>
        <h1>Quiz Data</h1>
        {card.data.quizzes.map((quiz) => {
          return <CardQuiz key={quiz.quizId} {...quiz} />;
        })}
      </Paper>
    </div>
  );
}

function CardWrapper() {
  const router = useRouter();
  const id = router.query.card_id as string;
  if (typeof id === "string") {
    return <Card id={parseInt(id)} />;
  }
  return <div>Loading page...</div>;
}

export default CardWrapper;
