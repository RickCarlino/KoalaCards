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
  const m = trpc.editPhrase.useMutation();
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
    console.log(values);
    m.mutateAsync({
      id,
      en: values.en,
      ko: values.ko,
      flagged: values.flagged,
    }).then(() => {
      location.assign(`/cards`);
    });
  };

  return (
    <div>
      <Paper shadow="xs">
        <form onSubmit={form.onSubmit(updateForm)}>
          <Container size="md">
            <TextInput
              label="English Card"
              placeholder="Enter English Card"
              error={form.errors.en && "Please enter an English card"}
              {...form.getInputProps("en")}
            />
            <TextInput
              label="Korean Card"
              placeholder="Enter Korean Card"
              error={form.errors.ko && "Please enter a Korean card"}
              {...form.getInputProps("ko")}
            />
            <Checkbox label="Flagged" {...form.getInputProps("flagged")} />
          </Container>

          <Button type="submit">Update</Button>
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
