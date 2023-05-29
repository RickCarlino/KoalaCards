import { PhraseTable } from "@/components/phrase-table";
import { Container } from "@mantine/core";

const Edit: React.FC = () => {
  return (
    <Container size="s">
      <PhraseTable phrases={[]} />
    </Container>
  );
};

export default Edit;
