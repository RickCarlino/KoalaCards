import React from "react";
import { trpc } from "@/utils/trpc";

/** The faucet component has a button that when clicked
 * calls the "faucet" trpc mutation:
 */
export default function Faucet(_props: {}) {
  const f = trpc.faucet.useMutation();
  const [result, setResult] = React.useState<string | null>("Press Button");
  const onClick = () => {
    const no = () => {
      setResult("Nope");
    };
    setResult("Loading...");
    f.mutateAsync({}).then(({ message }) => {
      setResult(message);
    }, no);
  };
  return (
    <div>
      <button onClick={onClick}>Again</button>
      <p>{result}</p>
    </div>
  );
}
