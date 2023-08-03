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
  korean: string;
  english?: string;
}

interface ImportPageProps {
  onSubmit: (phrases: Phrase[]) => void;
}

const ImportPage: React.FC<ImportPageProps> = ({ onSubmit }) => {
  const [text, setText] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    setIsLoading(true);
    setError(null);

    const lines = text.split("\n");
    const phrases: Phrase[] = [];

    for (let line of lines) {
      let [korean, english] = line.split(",");
      korean = korean.trim();
      english = english?.trim();
      if (!korean) {
        setError("Each line must start with a Korean phrase.");
        setIsLoading(false);
        return;
      }
      phrases.push({ korean, english });
    }

    await onSubmit(phrases);
    setIsLoading(false);
    setText("");
  };

  return (
    <Grid>
      <Col style={{ maxWidth: 600 }}>
        <Paper>
          <h1>Import New Cards</h1>
          <p>
            Enter a list of phrases below, one per line as a comma separated
            list. Separate the Korean sentence and English translation with a
            comma. The first item should be the Korean sentence, and the second
            item (optional) should be the English translation. If you do not
            provide a translation, we will translate it for you.
          </p>
          <p>
            <strong>Ensure your sentences do not contain any commas!</strong>{" "}
            Lines with more than one comma will be rejected. I will fix this
            limitation later.
          </p>
          <p>Example:</p>
          <pre>안녕하세요, Hello</pre>
          <pre>실패하지 마세요.,</pre>
          <pre>아니요. 괜찮아요., No it's okay.</pre>

          <Textarea
            minRows={10}
            placeholder="Korean sentence, [Optional] English translation"
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
      </Col>
    </Grid>
  );
};

export default ImportPage;
