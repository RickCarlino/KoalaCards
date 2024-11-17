import { VisualDiff } from "@/koala/review/visual-diff";
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
        <Stack>
          <VisualDiff actual="Hello, world!" expected="Hello, whirled!" />
        </Stack>
      </Card>
    </Center>
  );
}
