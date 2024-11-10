import { diffWords } from "diff";

interface SentencecorrectionProps {
  input: string;
  correction: string;
}

export const VisualDiff: React.FC<SentencecorrectionProps> = ({
  input,
  correction,
}) => {
  const diff = diffWords(input, correction);

  return (
    <span style={{ background: "white", color: "black" }}>
      {diff.map((part, index) => {
        const removedColor = part.removed ? "salmon" : "transparent";
        const style = {
          backgroundColor: part.added ? "lightgreen" : removedColor,
          textDecoration: part.removed ? "line-through" : "none",
        };

        return (
          <span key={index} style={style}>
            {part.value}
          </span>
        );
      })}
    </span>
  );
};
