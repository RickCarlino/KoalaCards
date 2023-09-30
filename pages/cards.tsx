import { CardTable } from "@/components/card-table";
import { trpc } from "@/utils/trpc";
import { Container } from "@mantine/core";
import Authed from "../components/authed";

const Edit: React.FC = () => {
  /** Call the "getAllPhrases" trpc method. */
  const cards = trpc.getAllPhrases.useQuery({});
  let content = <div>Loading...</div>;
  if (cards.data) {
    content = <CardTable cards={cards.data} />;
  }
  return Authed(
    <Container size="s">
      <h1>Manage Cards</h1>
      {content}
    </Container>,
  );
};

export default Edit;
