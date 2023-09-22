import { trpc } from "@/utils/trpc";
import {
  Textarea,
  Button,
  Paper,
  Notification,
  Loader,
  Container,
} from "@mantine/core";
import { useState } from "react";

interface Phrase {
  korean: string;
  english: string;
  rootWord: string;
}

interface ImportPageProps {
  // onSubmit: (phrases: Phrase[]) => void;
}

const ImportPage: React.FC<ImportPageProps> = ({}) => {
  const [text, setText] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<[string, string][]>([]);
  const importPhrase = trpc.importPhrases.useMutation();

  const handleSubmit = async () => {
    setIsLoading(true);
    setError(null);

    const lines = text.split("\n");
    const phrases: Phrase[] = [];
    let lineIndex = 0;
    let total = lines.length;
    for (let line of lines) {
      lineIndex = lineIndex + 1;
      if (line.length < 3) continue;
      if (line.split("\t")[0].length > 80) {
        setError(`(Line ${lineIndex}/${total}) Is too long. KoalaSRS is optimized for short phrases.`);
        setIsLoading(false);
        return;
      }
      let [korean, english, rootWord] = line.split("\t");

      if (!korean) {
        setError(`(Line ${lineIndex}/${total}) line must start with a vocabulary word.`);
        setIsLoading(false);
        return;
      }

      if (!english) {
        setError(`(Line ${lineIndex}/${total}) A definition is required after a tab character.`);
        setIsLoading(false);
        return;
      }

      korean = korean.trim();
      english = english.trim();
      phrases.push({ korean, english, rootWord });
    }

    importPhrase.mutateAsync({ input: phrases }).then((imports) => {
      setResult(imports.map((x) => [x.ko, x.en]));
    });

    setIsLoading(false);
    setText("");
  };
  const start = (
    <Paper>
      <h1>Import New Cards</h1>
      <p>
        Enter a list of phrases below, one per line.
        Each line has three parts, separated by a tab character.
        The order is as follows:
      </p>
      <ol>
        <li>Korean sentence</li>
        <li>(tab character) English translation or example sentence.</li>
        <li>(tab character) Optional key vocab word in the sentence.</li>
      </ol>
      <h3>Example of phrase input:</h3>
      <pre>여러가지 음식을 먹어 봤어요. I tried various foods. 여러가지</pre>
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
  return (
    <Container>
      {result.length > 0 ? finish : start}
    </Container>
  );
};

export default ImportPage;
