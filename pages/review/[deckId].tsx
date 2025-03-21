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
    // Get the "take" param from the URL using NextJS router.
    const take = Math.min(
      parseInt(new URLSearchParams(window.location.search).get("take") || "7"),
      44,
    );
    mutation
      .mutateAsync({ take, deckId }, { onSuccess: (data) => setData(data) })
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
    el = <div>Fetching New Quizzes. This could take a while for new words...</div>;
  } else if (data.quizzes.length > 0) {
    el = (
      <ReviewPage
        quizzesDue={data.quizzesDue}
        quizzes={data.quizzes}
        onSave={onSave}
      />
    );
  } else {
    el = (
      <div>
        No quizzes found. Add more words to this deck or come back later when
        cards are due for review.
      </div>
    );
  }

  return MicrophonePermissions(el);
}
