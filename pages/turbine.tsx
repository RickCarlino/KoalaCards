import { useState } from "react";
import { trpc } from "@/koala/trpc-config";
import { Button, Card, Center, Stack, Textarea } from "@mantine/core";

export async function getServerSideProps() {
  return { props: {} };
}

export default function Faucet() {
  const [inputText, setInputText] = useState("");
  const [output, setOutput] = useState("");
  const turbineMutation = trpc.turbine.useMutation();
  const handleSubmit = async () => {
    setOutput("Loading...");
    const result = await turbineMutation.mutateAsync({ words: inputText });
    const asCSV = result
      .map(({ term, definition }) =>
        [term, definition].join("|"),
      )
      .join("\n");
    setOutput(asCSV);
  };

  return (
    <Center style={{ width: "100%", padding: "2rem" }}>
      <Card
        shadow="sm"
        padding="lg"
        radius="md"
        withBorder
        style={{ width: "80%" }}
      >
        <Stack>
          <Textarea
            label="Input"
            placeholder="Enter text here..."
            value={inputText}
            onChange={(event) => setInputText(event.currentTarget.value)}
            autosize
            minRows={3}
          />
          <Button onClick={handleSubmit}>Submit</Button>
          <Textarea
            label="Output (JSON)"
            placeholder="Output will appear here..."
            value={output}
            readOnly
            autosize
            minRows={3}
          />
        </Stack>
      </Card>
    </Center>
  );
}
