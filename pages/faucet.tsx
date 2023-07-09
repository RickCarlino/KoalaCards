import React from "react";
import { trpc } from "@/utils/trpc";

/** The faucet component has a button that when clicked
 * calls the "faucet" trpc mutation:
 */
export default function Faucet(_props: {}) {
  const f = trpc.faucet.useMutation();
  const [phrase, setPhrase] = React.useState<string | null>("Press Button");
  const onClick = () => {
    const no = () => {
      setPhrase("Nope");
    };
    setPhrase("Loading...");
    f.mutateAsync({}).then(({ message }) => {
      setPhrase(message);
    }, no);
  };
  return (
    <div>
      <button onClick={onClick}>Again</button>
      <p>{phrase}</p>
    </div>
  );
}
