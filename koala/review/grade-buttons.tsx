import { Button, Group } from "@mantine/core";
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
        key={label}
        disabled={current === grade}
        onClick={() => onSelectDifficulty(grade)}
      >
        {label}
      </Button>
    );
  });
  return <Group grow>{list}</Group>;
};
