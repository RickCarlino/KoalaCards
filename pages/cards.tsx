import { CardTable } from "@/components/card-table";
import { trpc } from "@/utils/trpc";
import { Button, Container, FileButton } from "@mantine/core";
import Authed from "../components/authed";
import { z } from "zod";
export const BACKUP_SCHEMA = z.array(
  z.object({
    definition: z.string(),
    term: z.string(),
    ease: z.number(),
    interval: z.number(),
    lapses: z.number(),
    repetitions: z.number(),
    nextReviewAt: z.number(),
    createdAt: z.coerce.date(),
    firstReview: z.nullable(z.coerce.date()),
    lastReview: z.nullable(z.coerce.date()),
  }),
);

interface FileImportButtonProps {
  onReady: (data: z.infer<typeof BACKUP_SCHEMA>) => void;
}

// Create a file import button.
// It's a file picker that has an "onReady" callback.
// When the user selects a file, it calls the callback with the file contents:
const FileImportButton = ({ onReady }: FileImportButtonProps) => {
  const onChange = (file: File | null) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      const data = e.target?.result as string;
      // Ensure that `data` complies with the backup schema:
      const parsed = BACKUP_SCHEMA.safeParse(JSON.parse(data));
      if (parsed.success) {
        onReady(parsed.data);
      } else {
        const e = parsed.error.message.slice(0, 80);
        alert("Invalid backup file: " + e);
        return;
      }
    };
    reader.readAsText(file);
  };
  return (
    <FileButton onChange={onChange} accept="application/jpeg">
      {(props) => <Button {...props}>Import Cards</Button>}
    </FileButton>
  );
};

const Edit: React.FC = () => {
  /** Call the "getAllCards" trpc method. */
  const cards = trpc.getAllCards.useQuery({});
  const deleteFlagged = trpc.deleteFlaggedCards.useMutation();
  const exportCards = trpc.exportCards.useMutation();
  const importCards = trpc.importCards.useMutation();

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
    content = <CardTable cards={cards.data} />;
  }
  return Authed(
    <Container size="s">
      <h1>Manage Cards</h1>
      <Button onClick={doDeleteFlagged}>Delete Flagged Cards</Button>
      <Button onClick={doExport}>Export Cards</Button>
      <FileImportButton
        onReady={(data) => {
          const desired = data.length;
          alert("This is going to take a while. Are you ready?");
          importCards.mutateAsync(data).then(({ count }) => {
            alert(`Imported ${count}/${desired} cards.`);
            location.reload();
          });
        }}
      />
      <hr />
      {content}
    </Container>,
  );
};

export default Edit;
