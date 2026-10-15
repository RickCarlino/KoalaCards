import { Button, Container, Stack, Text, Title } from "@mantine/core";
import Link from "next/link";

export default function Custom404() {
  return (
    <Container size="sm" py="xl">
      <Stack align="flex-start" gap="md">
        <Title order={1} size="h2">
          Page not found
        </Title>
        <Text c="pastel.6">This page may have moved or been removed.</Text>
        <Button component={Link} href="/" variant="filled">
          Go home
        </Button>
      </Stack>
    </Container>
  );
}
