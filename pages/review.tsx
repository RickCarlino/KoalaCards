import MicrophonePermissions from "@/koala/microphone-permissions";
import { ReviewPage } from "@/koala/review/review-page";
import { trpc } from "@/koala/trpc-config";
import { useEffect, useState } from "react";

export default function Review() {
  const mutation = trpc.getNextQuizzes.useMutation();
  const [quizzes, setQuizzes] = useState([] as any);

  const fetchQuizzes = () => {
    mutation.mutate(
      { notIn: [], take: 7 },
      { onSuccess: (data) => setQuizzes(data.quizzes) },
    );
  };

  useEffect(() => {
    fetchQuizzes();
  }, []);

  const onSave = async () => {
    // Called by child component when it wants more quizzes.
    fetchQuizzes();
  };

  let el = <div>Loading...</div>;

  if (mutation.isError) {
    el = <div>Error occurred: {mutation.error.message}</div>;
  } else if (quizzes.length > 0) {
    el = <ReviewPage quizzes={quizzes} onSave={onSave} />;
  }

  return MicrophonePermissions(el);
}
