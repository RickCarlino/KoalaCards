import MicrophonePermissions from "@/koala/microphone-permissions";
import { ReviewPage } from "@/koala/review/review-page";
import { trpc } from "@/koala/trpc-config";
import { useEffect } from "react";

export default function Review() {
  const mutation = trpc.getNextQuizzes.useMutation();
  let el = <div>Loading...</div>;

  useEffect(() => {
    mutation.mutate({ notIn: [], take: 10 });
  }, []);

  if (mutation.isError) {
    el = <div>Error occurred: {mutation.error.message}</div>;
  }

  if (mutation.isSuccess) {
    el = <ReviewPage {...mutation.data} />;
  }

  return MicrophonePermissions(el);
}
