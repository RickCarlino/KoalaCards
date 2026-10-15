import { Group, Stack, Text, Title } from "@mantine/core";
import { ReactNode } from "react";

type PageHeaderProps = {
  title: string;
  description?: string;
  actions?: ReactNode;
};

export function PageHeader({
  title,
  description,
  actions,
}: PageHeaderProps) {
  return (
    <Group justify="space-between" align="flex-start" gap="md" mb="xl">
      <Stack gap={6} miw={0} style={{ flex: "1 1 160px" }}>
        <Title order={1} size="h2">
          {title}
        </Title>
        {description && (
          <Text size="sm" c="pastel.6">
            {description}
          </Text>
        )}
      </Stack>
      {actions && <Group gap="sm">{actions}</Group>}
    </Group>
  );
}
