import MicrophonePermissions from "@/koala/microphone-permissions";
import { ReviewPage } from "@/koala/review/review-page";
import { trpc } from "@/koala/trpc-config";
import { useRouter } from "next/router";
import { useEffect, useState } from "react";

function useDeckID() {
  const router = useRouter();
  const { deckId } = router.query;

  if (!deckId) {
    throw new Error("deckId is required in the URL");
  }

  return Number(deckId);
}

export default function Review() {
  const mutation = trpc.getNextQuizzes.useMutation();
  const [data, setData] = useState({
    quizzesDue: 0,
    quizzes: [],
  } as {
    quizzesDue: number;
    quizzes: any[];
  });
  const deckId = useDeckID();
  const [isFetching, setIsFetching] = useState(false);

  const fetchQuizzes = () => {
    setIsFetching(true);
    mutation
      .mutateAsync({ take: 12, deckId }, { onSuccess: (data) => setData(data) })
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
