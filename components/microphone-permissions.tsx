import * as React from "react";
import { useEffect, useState } from "react";

type Element = React.ReactNode;

export default function MicrophonePermissions<T extends Element>(el: T) {
  const [isReady, setReady] = useState(false);
  useEffect(() => {
    navigator.mediaDevices
      .getUserMedia({ audio: true })
      .then((_stream) => setReady(true));
  }, []);
  if (!isReady) {
    return <div>Requesting microphone permission...</div>;
  }
  return el;
}
