const style = {
  background: "salmon",
  border: "1px dashed pink",
};

export function QuizFailure(props: {
  id: number;
  ko: string;
  en: string;
  lessonType: string;
  userTranscription: string;
  rejectionText: string;
  onFlag: () => void;
  onDiscard: () => void;
}) {
  return (
    <div style={style}>
      <button onClick={props.onFlag}>
        Flag Item
      </button>
      {/* <button onClick={props.onDiscard}>
        Discard Results
      </button> */}
      <p>You answered the last question incorrectly:</p>
      <p>Quiz type: {props.lessonType}</p>
      <p>Korean: {props.ko}</p>
      <p>English: {props.en}</p>
      <p>What you said: {props.userTranscription}</p>
      <p>Why it's wrong: {props.rejectionText}</p>
    </div>
  );
}
