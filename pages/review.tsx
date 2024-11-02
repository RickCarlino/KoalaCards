import MicrophonePermissions from "@/koala/microphone-permissions";
import { ReviewPage } from "@/koala/review/review-page";
import { trpc } from "@/koala/trpc-config";
import { useEffect, useState } from "react";

export default function Review() {
  const mutation = trpc.getNextQuizzes.useMutation();
  const [data, setData] = useState({
    quizzesDue: 0,
    quizzes: [],
  } as {
    quizzesDue: number;
    quizzes: any[];
  });
  const [isFetching, setIsFetching] = useState(false);

  const fetchQuizzes = () => {
    setIsFetching(true);
    mutation
      .mutateAsync({ take: 6 }, { onSuccess: (data) => setData(data) })
      .finally(() => setIsFetching(false));
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
  } else if (isFetching) {
    el = <div>Fetching New Quizzes...</div>;
  } else if (data.quizzes.length > 0) {
    el = (
      <ReviewPage
        quizzesDue={data.quizzesDue}
        quizzes={data.quizzes}
        onSave={onSave}
      />
    );
  } else {
    el = <div>No quizzes found</div>;
  }

  return MicrophonePermissions(el);
}
