import { trpc } from "@/utils/trpc";
import {
  Textarea,
  Button,
  Col,
  Paper,
  Notification,
  Loader,
  Grid,
} from "@mantine/core";
import { useState } from "react";

interface Phrase {
  term: string;
  definition: string;
}

interface ImportPageProps {
  // onSubmit: (phrases: Phrase[]) => void;
}

const ImportPage: React.FC<ImportPageProps> = ({}) => {
  const [text, setText] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<[string, string, string][]>([]);
  const importPhrase = trpc.importPhrases.useMutation();

  const handleSubmit = async () => {
    setIsLoading(true);
    setError(null);

    const lines = text.split("\n");
    const phrases: Phrase[] = [];

    for (let line of lines) {
      let [term, definition] = line.split("\t");

      if (!term) {
        setError("Each line must start with a vocabulary word.");
        setIsLoading(false);
        return;
      }

      if (!definition) {
        setError(
          "A definition or example context is required after a tab character."
        );
        setIsLoading(false);
        return;
      }

      term = term.trim();
      definition = definition?.trim();
      phrases.push({ term: term, definition: definition });
    }

    importPhrase.mutateAsync({ input: phrases }).then((imports) => {
      setResult(imports.map((x) => [x.input, x.ko, x.en]));
    });

    setIsLoading(false);
    setText("");
  };
  const start = (
    <Paper>
      <h1>Import New Cards</h1>
      <p>
        Enter a list of phrases below, one per line. Each line should contain a
        Korean word, followed by a tab character, followed by an either an
        English definition or a Korean sentence that contains the word.
      </p>
      <h3>Example of contextual import:</h3>
      <pre>실무 대부분의 [[실무]] 환경에서는 CI/CD를 진행하죠.</pre>
      <h3>Examples of definition import:</h3>
      <pre>최신순 newest</pre>
      <Textarea
        minRows={10}
        placeholder="Korean sentence <tab> English translation or example sentence"
        value={text}
        onChange={(event) => setText(event.currentTarget.value)}
      />
      {error && <Notification color="red">{error}</Notification>}
      <Button
        color="blue"
        onClick={handleSubmit}
        style={{ marginTop: "1em" }}
        disabled={isLoading}
      >
        {isLoading ? <Loader /> : "Import"}
      </Button>
    </Paper>
  );

  const finish = (
    <Paper>
      <h1>Imported Phrases</h1>
      <table>
        <thead>
          <tr>
            <th>Korean</th>
            <th>English</th>
            <th>Example</th>
          </tr>
        </thead>
        <tbody>
          {result.map((x) => (
            <tr>
              <td>{x[0]}</td>
              <td>{x[1]}</td>
              <td>{x[2]}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </Paper>
  );
  return (
    <Grid>
      <Col style={{ maxWidth: 600 }}></Col>
      {result.length > 0 ? finish : start}
    </Grid>
  );
};

export default ImportPage;
