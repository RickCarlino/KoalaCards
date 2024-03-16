import { CardTable } from "@/koala/card-table";
import { trpc } from "@/koala/trpc-config";
import { Button, Container } from "@mantine/core";
import { z } from "zod";

export const BACKUP_SCHEMA = z.array(
  z.object({
    term: z.string(),
    definition: z.string(),
    langCode: z.string(),
    createdAt: z.coerce.date(),
    quizzes: z.array(
      z.object({
        firstReview: z.number(),
        lapses: z.number(),
        lastReview: z.number(),
        nextReview: z.number(),
        quizType: z.string(),
        repetitions: z.number(),
        difficulty: z.number(),
        stability: z.number(),
      }),
    ),
  }),
);

const Edit: React.FC = () => {
  /** Call the "getAllCards" trpc method. */
  const cards = trpc.getAllCards.useQuery({});
  const deleteFlagged = trpc.deleteFlaggedCards.useMutation();
  const exportCards = trpc.exportCards.useMutation();
  const doDeleteFlagged = () => {
    const warning = "Are you sure you want to delete all flagged cards?";
    if (!confirm(warning)) return;
    deleteFlagged.mutateAsync({}).then(() => location.reload());
  };
  const doExport = () => {
    exportCards.mutateAsync({}).then((cards) => {
      const data = JSON.stringify(cards, null, 2);
      const blob = new Blob([data], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      // Start download:
      a.download = "koala-srs-export.json";
      a.click();
    });
  };
  let content = <div>Loading...</div>;
  if (cards.data) {
    content = <CardTable onDelete={() => cards.refetch()} cards={cards.data} />;
  }
  return (
    <Container size="s">
      <h1>Manage Cards</h1>
      <Button onClick={doDeleteFlagged}>Delete Flagged Cards</Button>
      <Button onClick={doExport}>Export Cards (V3)</Button>
      <hr />
      {content}
    </Container>
  );
};

export default Edit;
