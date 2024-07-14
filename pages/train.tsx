import { trpc } from "@/koala/trpc-config";

function formatTrainingData(props: {}) {
  const viewTrainingData = trpc.viewTrainingData.useQuery(props);

  if (viewTrainingData.isLoading) {
    return <div>Loading...</div>;
  }

  if (viewTrainingData.error) {
    return <div>Error: {viewTrainingData.error.message}</div>;
  }

  if (!viewTrainingData.data) {
    return <div>No data</div>;
  }
  // Display the following data for each array item in a table:
  // id, createdAt, englishTranslation, explanation, definition, userInput, quizType, langCode, yesNo, term
  return (
    <table>
      <thead>
        <tr>
          <th>ID</th>
          <th>Lang</th>
          <th>Time</th>
          <th>Type</th>
          <th>Definition</th>
          <th>Term</th>
          <th>Response</th>
          <th>Translation</th>
          {/* <th>explanation</th> */}
        </tr>
      </thead>
      <tbody>
        {viewTrainingData.data.map((trainingData) => (
          <tr
            style={{
              /* Color row red if yesNo is no */
              color: trainingData.yesNo === "no" ? "orange" : "",
            }}
            key={trainingData.id}
          >
            <td>{trainingData.id}</td>
            <td>{trainingData.langCode}</td>
            <td>{trainingData.createdAt.toLocaleDateString()}</td>
            <td>{trainingData.quizType}</td>
            <td>{trainingData.definition}</td>
            <td>{trainingData.term}</td>
            <td>{trainingData.userInput}</td>
            <td>{trainingData.englishTranslation}</td>
            {/* <td>{trainingData.explanation}</td> */}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export default function Train() {
  return (
    <div>
      <h1>Train</h1>
      {formatTrainingData({})}
    </div>
  );
}
