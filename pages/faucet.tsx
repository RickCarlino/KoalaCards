import { trpc } from "@/koala/trpc-config";
import { Button, Card, Center, Stack } from "@mantine/core";

export async function getServerSideProps() {
  return { props: {} };
}

const WORDS = `인마, 펼치다, 높아지다, 상상, 숙소, 거대하다, 승리, 의식, 사모님, 벌어지다`;

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
