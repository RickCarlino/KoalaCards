import { QuizState } from "./types";

type ReviewOverProps = {
  state: QuizState[];
};

export const ReviewOver = ({ state }: ReviewOverProps) => {
  return (
    <div>
      <h2>Review Summary</h2>
      <table>
        <thead>
          <tr>
            <th>Card</th>
            <th>Status</th>
            <th>Difficulty</th>
          </tr>
        </thead>
        <tbody>
          {state.map((quizState, index) => (
            <tr key={index} style={{ backgroundColor: getColor(quizState) }}>
              <td>{quizState.quiz.term}</td>
              <td>{quizState.serverGradingResult || "Pending"}</td>
              <td>{quizState.grade || "Not graded"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

function getColor(quizState: QuizState): string {
  switch (quizState.serverGradingResult) {
    case "correct":
      return "white";
    case "incorrect":
      return "red";
    case "error":
      return "yellow";
    default:
      return "gray";
  }
}
