export const linkToEditPage = (id: number) => {
  return <a href={["cards", id].join("/")}>Edit Card</a>;
};

const style = {
  background: "#FFF0F5",
  font: "1em sans-serif",
  color: "black",
  border: "1px dashed pink",
};

export function QuizFailure(props: {
  id: number;
  term: string;
  definition: string;
  lessonType: string;
  userTranscription: string;
  rejectionText: string;
  onFlag: () => void;
  onDiscard: () => void;
}) {
  return (
    <div style={style}>
      <button onClick={props.onFlag}>Flag Item</button>
      {/* <button onClick={props.onDiscard}>
        Discard Results
      </button> */}
      <p>You answered the last question incorrectly:</p>
      <p>Quiz type: {props.lessonType}</p>
      <p>Term: {props.term}</p>
      <p>Definition: {props.definition}</p>
      <p>What you said: {props.userTranscription}</p>
      <p>Why it's wrong: {props.rejectionText}</p>
      <p>{linkToEditPage(props.id)}</p>
    </div>
  );
}
