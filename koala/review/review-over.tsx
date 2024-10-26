import { QuizState } from "./types";
import { Card, Table, Text, Title } from "@mantine/core";

type ReviewOverProps = {
  state: QuizState[];
};

export const ReviewOver = ({ state }: ReviewOverProps) => {
  return (
    <Card shadow="sm" padding="lg" radius="md" withBorder>
      <Title order={2}>Review Summary</Title>
      <Table highlightOnHover>
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
              <td><Text>{quizState.quiz.term}</Text></td>
              <td><Text>{quizState.serverGradingResult || "Pending"}</Text></td>
              <td><Text>{quizState.grade || "Not graded"}</Text></td>
            </tr>
          ))}
        </tbody>
      </Table>
    </Card>
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
