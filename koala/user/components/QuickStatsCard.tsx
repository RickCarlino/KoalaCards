import { QuickStat } from "@/koala/user/types";
import { Card, Group, Stack, Text, Title } from "@mantine/core";

export function QuickStatsCard(props: { stats: QuickStat[] }) {
  return (
    <Card withBorder shadow="xs" p="md" radius="md">
      <Title order={5} mb="xs">
        Quick Stats
      </Title>
      <Stack gap={6}>
        {props.stats.map((stat) => (
          <Group
            key={stat.label}
            gap="xs"
            justify="space-between"
            wrap="nowrap"
          >
            <Text c="dimmed" size="sm">
              {stat.label}
            </Text>
            <Text fw={600}>{stat.value}</Text>
          </Group>
        ))}
      </Stack>
    </Card>
  );
}
