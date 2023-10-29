import { trpc } from "@/utils/trpc";
import { Button, Checkbox, Container, Paper, TextInput } from "@mantine/core";
import { useForm } from "@mantine/form";
import { useRouter } from "next/router";

function Card({ id }: { id: number }) {
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
      location.assign(`/cards`);
    });
  };
  const deleteCard = () => {
    d.mutate({ id });
    location.assign(`/cards`);
  };
  return (
    <div>
      <Paper shadow="xs">
        <form onSubmit={form.onSubmit(updateForm)}>
          <Container size="md">
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
        </form>
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
