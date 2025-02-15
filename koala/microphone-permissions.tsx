import * as React from "react";
import { useEffect, useState } from "react";

type Element = React.ReactNode;
type PermissionState = "waiting" | "ready" | "error";

export default function MicrophonePermissions<T extends Element>(el: T) {
  const [state, setState] = useState<PermissionState>("waiting");
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    navigator.mediaDevices
      .getUserMedia({ audio: true })
      .then((_stream) => {
        setState("ready");
        setErrorMessage("");
      })
      .catch((error: Error) => {
        setState("error");
        setErrorMessage(error.message || "Failed to access microphone");
      });
  }, []);

  if (state === "waiting") {
    return (
      <div className="flex flex-col items-center justify-center">
        <div className="text-2xl font-bold mb-4">
          Requesting microphone permission...
        </div>
        <div className="text-gray-600">
          Please allow microphone access to continue
        </div>
      </div>
    );
  }

  if (state === "error") {
    return (
      <div className="flex flex-col items-center justify-center">
        <div className="text-2xl font-bold mb-4 text-red-600">
          Microphone Access Error
        </div>
        <div className="text-gray-600 text-center max-w-md">{errorMessage}</div>
      </div>
    );
  }

  return el;
}
