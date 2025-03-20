import { useState, useRef, useEffect } from "react";
import { trpc } from "@/koala/trpc-config";
import { Button, Card, Center, Stack, Textarea } from "@mantine/core";

export async function getServerSideProps() {
  return { props: {} };
}

export default function Faucet() {
  const [inputText, setInputText] = useState("");
  const [output, setOutput] = useState("");
  const [elapsedTime, setElapsedTime] = useState(0);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const startTimeRef = useRef<number | null>(null);
  const turbineMutation = trpc.turbine.useMutation();
  
  // Clean up timer on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, []);

  const handleSubmit = async () => {
    // Reset and start the timer
    setElapsedTime(0);
    if (timerRef.current) {
      clearInterval(timerRef.current);
    }
    
    startTimeRef.current = Date.now();
    timerRef.current = setInterval(() => {
      if (startTimeRef.current) {
        const secondsElapsed = Math.floor((Date.now() - startTimeRef.current) / 1000);
        setElapsedTime(secondsElapsed);
      }
    }, 100); // Update every 100ms for smoother display
    
    setOutput("Loading...");
    const result = await turbineMutation.mutateAsync({ words: inputText });
    const asCSV = result
      .map(({ term, definition }) => [term, definition].join("|"))
      .join("\n");
    
    // Stop the timer when setting the actual output
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    
    setOutput(asCSV);
  };

  return (
    <Center style={{ width: "100%", padding: "2rem" }}>
      <Card
        shadow="sm"
        padding="lg"
        radius="md"
        withBorder
        style={{ width: "80%" }}
      >
        <Stack>
          <Textarea
            label="Input"
            placeholder="Enter text here..."
            value={inputText}
            onChange={(event) => setInputText(event.currentTarget.value)}
            autosize
            minRows={3}
          />
          <Button onClick={handleSubmit}>
            Submit {elapsedTime > 0 ? `(${elapsedTime}s elapsed)` : ''}
          </Button>
          <Textarea
            label="Output (JSON)"
            placeholder="Output will appear here..."
            value={output}
            readOnly
            autosize
            minRows={3}
          />
        </Stack>
      </Card>
    </Center>
  );
}
