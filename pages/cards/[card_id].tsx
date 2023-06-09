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
  const phrase = trpc.getOnePhrase.useQuery(
    { id },
    {
      onSuccess: (data) => {
        form.setValues({
          en: data.en,
          ko: data.ko,
          flagged: data.flagged,
        });
      },
    }
  );
  if (phrase.error) return <pre>{JSON.stringify(phrase.error.message, null, 2)}</pre>;
  if (!phrase.data) return <div>Loading data...</div>;
  // Define updateForm function
  const updateForm = (values: { en: string; ko: string; flagged: boolean }) => {
    // Logic to update the phrase will go here
    console.log(values);
  };

  return (
    <div>
      <Paper shadow="xs">
        <form onSubmit={form.onSubmit(updateForm)}>
          <Container size="md">
            <TextInput
              label="English Phrase"
              placeholder="Enter English Phrase"
              error={form.errors.en && "Please enter an English phrase"}
              {...form.getInputProps("en")}
            />
            <TextInput
              label="Korean Phrase"
              placeholder="Enter Korean Phrase"
              error={form.errors.ko && "Please enter a Korean phrase"}
              {...form.getInputProps("ko")}
            />
            <Checkbox label="Flagged" {...form.getInputProps("flagged")} />
          </Container>

          <Button type="submit" variant="outline" color="blue">
            Update
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