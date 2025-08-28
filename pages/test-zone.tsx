import { Card, Center, Group, Stack, Text } from "@mantine/core";

export default function TestZone() {
  return (
    <Center style={{ width: "100%", padding: "2rem" }}>
      <Card
        shadow="sm"
        padding="lg"
        radius="md"
        withBorder
        style={{ width: "min(800px, 90%)" }}
      >
        <Stack gap="md">
          <Group justify="space-between">
            <Text fw={600}>Audio Transcription (PoC)</Text>
            <Text c="dimmed" size="sm">
              Foo
            </Text>
          </Group>
          <Text c="red">Bar</Text>
          <Text c="dimmed" size="xs">
            Baz
          </Text>
        </Stack>
      </Card>
    </Center>
  );
}
