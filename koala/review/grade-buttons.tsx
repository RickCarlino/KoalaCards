import { Button, Group } from "@mantine/core";
import { useHotkeys } from "@mantine/hooks";
import { Grade } from "femto-fsrs";
import React from "react";
import { HOTKEYS } from "./hotkeys";

// Define the props for the component
interface DifficultyButtonsProps {
  current: Grade | undefined;
  onSelectDifficulty: (difficulty: Grade) => void;
  disableHotkeys?: boolean;
}

export const DifficultyButtons: React.FC<DifficultyButtonsProps> = ({
  current,
  onSelectDifficulty,
  disableHotkeys,
}) => {
  const labels = ["FAIL", "HARD", "GOOD", "EASY"] as const;
  const LOOKUP: Record<(typeof labels)[number], Grade> = {
    FAIL: Grade.AGAIN,
    HARD: Grade.HARD,
    GOOD: Grade.GOOD,
    EASY: Grade.EASY,
  };
  if (!disableHotkeys) {
    useHotkeys([
      [HOTKEYS.GRADE_AGAIN, () => onSelectDifficulty(Grade.AGAIN)],
      [HOTKEYS.GRADE_HARD, () => onSelectDifficulty(Grade.HARD)],
      [HOTKEYS.GRADE_GOOD, () => onSelectDifficulty(Grade.GOOD)],
      [HOTKEYS.GRADE_EASY, () => onSelectDifficulty(Grade.EASY)],
    ]);
  }
  const list = labels.map((label: (typeof labels)[number]) => {
    return (
      <Button
        key={label}
        disabled={current === LOOKUP[label]}
        onClick={() => onSelectDifficulty(LOOKUP[label])}
      >
        {label}
      </Button>
    );
  });
  return <Group grow>{list}</Group>;
};
