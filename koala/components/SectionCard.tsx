import { Group, Paper, Stack, Text, Title } from "@mantine/core";
import React from "react";

type SectionCardProps = {
  title: string;
  description?: string;
  action?: React.ReactNode;
  titleOrder?: 1 | 2 | 3 | 4 | 5 | 6;
  children: React.ReactNode;
};

export function SectionCard({
  title,
  description,
  action,
  titleOrder = 4,
  children,
}: SectionCardProps) {
  return (
    <Paper withBorder p="lg" radius="lg">
      <Stack gap="md">
        <Group justify="space-between" align="flex-start" wrap="wrap">
          <Stack gap={4}>
            <Title order={titleOrder}>{title}</Title>
            {description && (
              <Text size="sm" c="dimmed">
                {description}
              </Text>
            )}
          </Stack>
          {action}
        </Group>
        {children}
      </Stack>
    </Paper>
  );
}
