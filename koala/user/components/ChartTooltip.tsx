import { Paper, Text } from "@mantine/core";

type TooltipItem = { name: string; value: number | string; color: string };

export function ChartTooltip(props: {
  label: string | number | undefined;
  items: readonly TooltipItem[];
}) {
  if (props.items.length === 0) {
    return null;
  }

  return (
    <Paper px="md" py="sm" withBorder shadow="md" radius="md">
      <Text fw={500} mb={5}>
        {props.label}
      </Text>
      {props.items.map((item) => (
        <Text key={item.name} c={item.color} fz="sm">
          {item.name}: {item.value}
        </Text>
      ))}
    </Paper>
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export function toChartTooltipItems(payload: unknown): TooltipItem[] {
  if (!Array.isArray(payload)) {
    return [];
  }

  const items: TooltipItem[] = [];

  for (const candidate of payload) {
    if (!isRecord(candidate)) {
      continue;
    }

    const { name, value, color } = candidate;

    const hasValidValue =
      typeof value === "number" || typeof value === "string";
    if (
      typeof name === "string" &&
      hasValidValue &&
      typeof color === "string"
    ) {
      items.push({ name, value, color });
    }
  }

  return items;
}
