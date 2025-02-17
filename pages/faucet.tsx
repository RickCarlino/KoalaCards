import { useState } from "react";
import { trpc } from "@/koala/trpc-config";
import { Button, Card, Center, Stack, Textarea } from "@mantine/core";

export async function getServerSideProps() {
  return { props: {} };
}

export default function Faucet() {
  const [inputText, setInputText] = useState("");
  const [output, setOutput] = useState("");
  const faucetMutation = trpc.faucet.useMutation();

  const handleSubmit = async () => {
    try {
      const result = await faucetMutation.mutateAsync({ words: inputText });
      // Format the result as pretty JSON
      setOutput(JSON.stringify(result, null, 2));
    } catch (error: any) {
      // Display error as JSON
      setOutput(JSON.stringify(error, null, 2));
    }
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
