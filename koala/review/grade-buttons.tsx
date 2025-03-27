import { Button, Group, Stack } from "@mantine/core";
import { useHotkeys } from "@mantine/hooks";
import { Grade } from "femto-fsrs";
import React from "react";
import { HOTKEYS } from "./hotkeys";
import { Quiz } from "./types";
import { getGradeButtonText } from "../trpc-routes/calculate-scheduling-data";

// Define the props for the component
interface DifficultyButtonsProps {
  quiz: Quiz;
  current: Grade | undefined;
  onSelectDifficulty: (difficulty: Grade) => void;
  disableHotkeys?: boolean;
}

export const DifficultyButtons: React.FC<DifficultyButtonsProps> = ({
  quiz,
  current,
  onSelectDifficulty,
  disableHotkeys,
}) => {
  if (!disableHotkeys) {
    useHotkeys([
      [HOTKEYS.GRADE_AGAIN, () => onSelectDifficulty(Grade.AGAIN)],
      [HOTKEYS.GRADE_HARD, () => onSelectDifficulty(Grade.HARD)],
      [HOTKEYS.GRADE_GOOD, () => onSelectDifficulty(Grade.GOOD)],
      [HOTKEYS.GRADE_EASY, () => onSelectDifficulty(Grade.EASY)],
    ]);
  }
  const list = getGradeButtonText(quiz).map(([grade, label]) => {
    return (
      <Button
        key={grade}
        disabled={current === grade}
        onClick={() => onSelectDifficulty(grade)}
        size="md"
        h={45}
      >
        {label}
      </Button>
    );
  });

  // On mobile, stack the buttons in two rows for better touch targets
  return (
    <Stack gap="sm">
      <Group grow gap="sm">
        {list.slice(0, 2)}
      </Group>
      <Group grow gap="sm">
        {list.slice(2)}
      </Group>
    </Stack>
  );
};
