import { Card, Center, Stack } from "@mantine/core";

/** The faucet component has a button that when clicked
 * calls the "faucet" trpc mutation:
 */
export default function Faucet(_props: {}) {
  return (
    <Center style={{ width: "100%" }}>
      <Card
        shadow="sm"
        padding="lg"
        radius="md"
        withBorder
        style={{ width: "80%" }}
      >
        <Stack>TODO</Stack>
      </Card>
    </Center>
  );
}
