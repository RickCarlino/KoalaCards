import { trpc } from "@/utils/trpc";
import { Button, Checkbox, Container, Paper, TextInput } from "@mantine/core";
import { useForm } from "@mantine/form";
import { useRouter } from "next/router";

function Card({ id }: { id: number }) {
  const form = useForm({
    initialValues: {
      en: "loading...",
      ko: "Loading...",
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
          en: data.en,
          ko: data.ko,
          flagged: data.flagged,
        });
      },
    },
  );
  if (card.error)
    return <pre>{JSON.stringify(card.error.message, null, 2)}</pre>;
  if (!card.data) return <div>Loading data...</div>;
  // Define updateForm function
  const updateForm = (values: { en: string; ko: string; flagged: boolean }) => {
    // Logic to update the card will go here
    m.mutateAsync({
      id,
      en: values.en,
      ko: values.ko,
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
              disabled={true}
              {...form.getInputProps("en")}
            />
            <TextInput
              label="Term"
              placeholder="Enter Term"
              error={form.errors.ko && "Please enter a Term"}
              disabled={true}
              {...form.getInputProps("ko")}
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
