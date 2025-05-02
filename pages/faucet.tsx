import { trpc } from "@/koala/trpc-config";
import { Button, Card, Center, Text, Stack } from "@mantine/core";
import { useState } from "react";

export async function getServerSideProps() {
  return { props: {} };
}

export default function Faucet() {
  // Define the expected schema for the RPC response items.
  const runRPC = trpc.faucet.useMutation();
  const edit = trpc.editCard.useMutation();
  const [count, setCount] = useState(0);
  const [results, setResults] = useState<
    {
      id: number;
      term: string;
      definition: string;
      result: string;
      userMessage: string;
    }[]
  >([]);

  // Call the RPC method on button click and update results.
  const onClick = async () => {
    setCount((prev) => prev + 1);
    const res = await runRPC.mutateAsync({});
    setResults(res);
    setCount((prev) => prev + 1);
  };

  const flagCard = async (id: number) => {
    setCount((prev) => prev + 1);
    await edit.mutateAsync({ id, flagged: true });
    setCount((prev) => prev + 1);
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
        <Button onClick={onClick}>Run ({count})</Button>

        <Stack mt="md">
          Diff: {(results.length / 30) * 100}%
          {results.map((item) => (
            <Card
              key={item.id}
              shadow="xs"
              padding="sm"
              radius="sm"
              withBorder
            >
              <Text>Term: {item.term}</Text>
              <Text>Definition: {item.definition}</Text>
              {item.userMessage.split("\n").map((line, index) => (
                <Text key={index}>{line}</Text>
              ))}
              <Button onClick={() => flagCard(item.id)}>Flag</Button>
            </Card>
          ))}
        </Stack>
      </Card>
    </Center>
  );
}
