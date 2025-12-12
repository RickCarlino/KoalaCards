import {
  Button,
  Card,
  Container,
  Stack,
  Text,
  Title,
} from "@mantine/core";
import { IconPlus } from "@tabler/icons-react";
import Link from "next/link";

export function NoDecksState() {
  return (
    <Container size="md" py="xl">
      <Stack align="center" gap="md">
        <Stack align="center" gap={4}>
          <Title order={2} c="pink.7">
            Welcome to Koala Cards
          </Title>
          <Text c="dimmed">
            Start your learning journey by adding some cards.
          </Text>
        </Stack>

        <Card withBorder radius="md" p="xl" bg="pink.0">
          <Button
            component={Link}
            href="/create"
            leftSection={<IconPlus size={18} />}
            color="pink"
            size="md"
            radius="md"
          >
            Add Your First Cards
          </Button>
        </Card>
      </Stack>
    </Container>
  );
}
