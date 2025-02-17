import { trpc } from "@/koala/trpc-config";
import { Button, Card, Center, Stack } from "@mantine/core";

export async function getServerSideProps() {
  return { props: {} };
}

const WORDS = `휴대, 자물쇠, 일명, 마주하다, 알아차리다, 시동, 돋보이다, 남매, 도전자, 시위, 뛰어다니다, 음원, 날아다니다, 목격하다, 동선, 두께, 순경, 구조대, 신원, 개인기, 불태우다`;

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
