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
  const grades: (keyof typeof Grade)[] = ["AGAIN", "HARD", "GOOD", "EASY"];
  useHotkeys([
    ["a", () => onSelectDifficulty(Grade.AGAIN)],
    ["s", () => onSelectDifficulty(Grade.HARD)],
    ["d", () => onSelectDifficulty(Grade.GOOD)],
    ["f", () => onSelectDifficulty(Grade.EASY)],
  ]);

  return (
    <Group>
      {grades.map((grade) => (
        <Button
          key={grade}
          disabled={current === Grade[grade]}
          onClick={() => onSelectDifficulty(Grade[grade])}
        >
          {grade}
        </Button>
      ))}
    </Group>
  );
};
