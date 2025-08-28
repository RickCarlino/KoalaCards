import { trpc } from "@/koala/trpc-config";
import { Button, Card, Center } from "@mantine/core";

export async function getServerSideProps() {
  return { props: {} };
}

export default function TestZone() {
  // Define the expected schema for the RPC response items.
  const runRPC = trpc.testZone.useMutation();

  // Call the RPC method on button click and update results.
  const onClick = async () => {
    await runRPC.mutateAsync({});
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
        <Button onClick={onClick}>Run Fixtures</Button>
      </Card>
    </Center>
  );
}
