import { Card, Center, Stack } from "@mantine/core";

export async function getServerSideProps() {
  return { props: {} };
}

export default function Faucet() {
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
        </Stack>
      </Card>
    </Center>
  );
}
