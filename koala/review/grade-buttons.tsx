import { Button, Group } from "@mantine/core";
import { useHotkeys } from "@mantine/hooks";
import { Grade } from "femto-fsrs";
import React from "react";

// Define the props for the component
interface DifficultyButtonsProps {
  current: Grade | undefined;
  onSelectDifficulty: (difficulty: Grade) => void;
}

export const DifficultyButtons: React.FC<DifficultyButtonsProps> = ({
  current,
  onSelectDifficulty,
}) => {
  const labels = ["FAIL", "HARD", "GOOD", "EASY"] as const;
  const LOOKUP: Record<(typeof labels)[number], Grade> = {
    FAIL: Grade.AGAIN,
    HARD: Grade.HARD,
    GOOD: Grade.GOOD,
    EASY: Grade.EASY,
  };
  useHotkeys([
    ["a", () => onSelectDifficulty(Grade.AGAIN)],
    ["s", () => onSelectDifficulty(Grade.HARD)],
    ["d", () => onSelectDifficulty(Grade.GOOD)],
    ["f", () => onSelectDifficulty(Grade.EASY)],
  ]);
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
  return <Group>{list}</Group>;
};
