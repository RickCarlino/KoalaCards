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
  return (
    <div>
      {grades.map((grade) => (
        <button
          key={grade}
          disabled={current === Grade[grade]}
          onClick={() => onSelectDifficulty(Grade[grade])}
        >
          {grade}
        </button>
      ))}
    </div>
  );
};
