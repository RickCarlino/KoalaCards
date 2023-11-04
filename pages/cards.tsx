import { CardTable } from "@/components/card-table";
import { trpc } from "@/utils/trpc";
import { Button, Container } from "@mantine/core";
import Authed from "../components/authed";

const Edit: React.FC = () => {
  /** Call the "getAllCards" trpc method. */
  const cards = trpc.getAllCards.useQuery({});
  const deleteFlagged = trpc.deleteFlaggedCards.useMutation();
  const doDeleteFlagged = () => {
    const warning = "Are you sure you want to delete all flagged cards?";
    if (!confirm(warning)) return;
    deleteFlagged.mutateAsync({}).then(() => location.reload());
  };
  let content = <div>Loading...</div>;
  if (cards.data) {
    content = <CardTable cards={cards.data} />;
  }
  return Authed(
    <Container size="s">
      <h1>Manage Cards</h1>
      <Button onClick={doDeleteFlagged}>
        Delete Flagged Cards
      </Button>
      <hr/>
      {content}
    </Container>,
  );
};

export default Edit;
