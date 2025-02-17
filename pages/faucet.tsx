import { trpc } from "@/koala/trpc-config";
import { Button, Card, Center, Stack } from "@mantine/core";

export async function getServerSideProps() {
  return { props: {} };
}

const WORDS = `정모, 수도, 동지, 쪼개다, 촬영장, 스크린, 트랙, 상상력, 미연, 프로듀서`;

export default function Faucet(_props: {}) {
  const x = trpc.faucet.useMutation();
  const handler = () => {
    x.mutateAsync({ words: WORDS }).then(() => {
      alert("OK");
    });
  };
  return (
    <Center style={{ width: "100%" }}>
      <Card
        shadow="sm"
        padding="lg"
        radius="md"
        withBorder
        style={{ width: "80%" }}
      >
        <Stack>
          <Button onClick={handler}>TODO</Button>
        </Stack>
      </Card>
    </Center>
  );
}
