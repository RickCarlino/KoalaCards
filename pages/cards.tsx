import { PhraseTable } from "@/components/phrase-table";
import { trpc } from "@/utils/trpc";
import { Container } from "@mantine/core";

const Edit: React.FC = () => {
  /** Call the "getAllPhrases" trpc method. */
  const phrases = trpc.getAllPhrases.useQuery({});
  let content = <div>Loading...</div>;
  if (phrases.data) {
    content = <PhraseTable phrases={phrases.data} />;
  }
  return <Container size="s">{content}</Container>;
};

export default Edit;
