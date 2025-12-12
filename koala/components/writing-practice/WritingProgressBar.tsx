import { Group, Progress, Text, useMantineTheme } from "@mantine/core";
import { IconCheck } from "@tabler/icons-react";

type WritingProgressBarProps = {
  currentCount: number;
  goal: number | null;
};

function clampPercent(value: number) {
  if (!Number.isFinite(value)) {
    return 0;
  }
  if (value <= 0) {
    return 0;
  }
  if (value >= 100) {
    return 100;
  }
  return value;
}

export function WritingProgressBar({
  currentCount,
  goal,
}: WritingProgressBarProps) {
  const theme = useMantineTheme();
  const hasGoal = typeof goal === "number" && goal > 0;
  const goalReached = hasGoal ? currentCount >= goal : false;
  const percent = hasGoal ? clampPercent((currentCount / goal) * 100) : 0;

  return (
    <>
      <Group justify="space-between">
        <Text size="sm" c="dimmed">
          {currentCount} characters{hasGoal ? ` / ${goal} goal` : ""}
        </Text>
        {goalReached ? (
          <Group gap="xs">
            <IconCheck size={16} color={theme.colors.teal[6]} />
            <Text size="sm" c="teal">
              Goal reached!
            </Text>
          </Group>
        ) : null}
      </Group>
      {hasGoal ? (
        <Progress
          value={percent}
          size="sm"
          color="blue"
          striped={goalReached}
          animated={goalReached}
        />
      ) : null}
    </>
  );
}
