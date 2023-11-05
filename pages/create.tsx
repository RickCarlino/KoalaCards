import { trpc } from "@/utils/trpc";
import {
  Textarea,
  Button,
  Paper,
  Notification,
  Container,
} from "@mantine/core";
import { useState } from "react";

interface Card {
  term: string;
  definition: string;
}

interface CreateCardProps {}

const CreateCardPage: React.FC<CreateCardProps> = ({}) => {
  const [text, setText] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<[string, string][]>([]);
  const importCard = trpc.bulkCreateCards.useMutation();
  const resetAllState = () => {
    setIsLoading(false);
    setError(null);
    setResult([]);
  };
  const handleSubmit = async () => {
    setIsLoading(true);
    setError(null);

    const lines = text.split("\n");
    const cards: Card[] = [];
    let lineIndex = 0;
    let total = lines.length;
    for (let line of lines) {
      lineIndex = lineIndex + 1;
      if (line.length < 3) continue;
      if (line.split("\t")[0].length > 80) {
        setError(
          `(Line ${lineIndex}/${total}) Is too long. KoalaSRS is optimized for short cards.`,
        );
        setIsLoading(false);
        return;
      }
      let [term, english] = line.split("\t");

      if (!term) {
        setError(
          `(Line ${lineIndex}/${total}) line must start with a vocabulary word.`,
        );
        setIsLoading(false);
        return;
      }

      if (!english) {
        setError(
          `(Line ${lineIndex}/${total}) A definition is required after a tab character.`,
        );
        setIsLoading(false);
        return;
      }

      term = term.trim();
      english = english.trim();
      cards.push({ term: term, definition: english });
    }

    importCard.mutateAsync({ input: cards }).then((imports) => {
      setResult(imports.map((x) => [x.term, x.definition]));
      setIsLoading(false);
      setText("");
    });

  };
  const start = (
    <Paper>
      <h1>Create New Cards</h1>
      <p>
        Enter a list of cards below, one per line. Each line has two parts,
        separated by a tab character. The order is as follows:
      </p>
      <ol>
        <li>Target language term</li>
        <li>A Tab character</li>
        <li>The translation</li>
      </ol>
      <p>
        <b>Pro Tip:</b>
        Edit your cards in a spreadsheet program like Excel or Google Sheets,
        then copy and paste them here.
      </p>
      <h3>Example of card input:</h3>
      <pre>그는 나를 웃게 했어요. He made me laugh.</pre>
      <Textarea
        minRows={10}
        placeholder="Korean sentence <tab> English translation or example sentence"
        value={text}
        onChange={(event) => setText(event.currentTarget.value)}
      />
      {error && <Notification color="red">{error}</Notification>}
      <Button
        color={isLoading ? "gray" : "blue"}
        onClick={handleSubmit}
        style={{ marginTop: "1em" }}
        disabled={isLoading}
      >
        {isLoading ? "Uploading..." : "Import"}
      </Button>
    </Paper>
  );

  const finish = (
    <Paper>
      <h1>Imported Cards</h1>
      <Button onClick={resetAllState}>Add More Cards</Button>
      <table>
        <thead>
          <tr>
            <th>Term</th>
            <th>Definition</th>
          </tr>
        </thead>
        <tbody>
          {result.map((x, i) => (
            <tr key={i}>
              <td>{x[0]}</td>
              <td>{x[1]}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </Paper>
  );
  return <Container>{result.length > 0 ? finish : start}</Container>;
};

export default CreateCardPage;
