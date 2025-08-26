import { Stack, Text, Button } from "@mantine/core";
import { useState } from "react";
import { LangCode } from "@/koala/shared-types";
import { useRemedialOutroValidation } from "../hooks/use-remedial-outro-validation";
import { GradingResult } from "../types";

interface RemedialOutroValidatorProps {
  targetText: string;
  langCode: LangCode;
  cardId: number;
  cardUUID: string;
  userTranscription: string;
  onValidationComplete: (isValid: boolean, result: GradingResult) => void;
  onRetry?: () => void;
}

/**
 * Component for validating remedial outro responses in speaking exams
 * This can be used when you already have a transcription and just need to validate it
 */
export const RemedialOutroValidator: React.FC<
  RemedialOutroValidatorProps
> = ({
  targetText,
  langCode,
  cardId,
  cardUUID,
  userTranscription,
  onValidationComplete,
  onRetry,
}) => {
  const [hasValidated, setHasValidated] = useState(false);

  const { validateTranscription, isValidating, validationResult } =
    useRemedialOutroValidation({
      targetText,
      langCode,
      cardId,
      cardUUID,
      onValidationComplete: (isValid, result) => {
        setHasValidated(true);
        onValidationComplete(isValid, result);
      },
    });

  const handleValidate = async () => {
    await validateTranscription(userTranscription);
  };

  const handleRetry = () => {
    setHasValidated(false);
    if (onRetry) {
      onRetry();
    }
  };

  // Show validation button if not yet validated
  if (!hasValidated) {
    return (
      <Stack align="center" gap="md">
        <Text ta="center" size="sm" c="dimmed">
          Your response: "{userTranscription}"
        </Text>
        <Button
          onClick={handleValidate}
          loading={isValidating}
          disabled={!userTranscription || isValidating}
        >
          Validate Response
        </Button>
      </Stack>
    );
  }

  // Show validation result
  if (validationResult) {
    const isCorrect = validationResult.isCorrect;

    return (
      <Stack align="center" gap="md">
        <Text
          ta="center"
          c={isCorrect ? "green" : "red"}
          fw={500}
          size="lg"
        >
          {isCorrect ? "Correct!" : "Not quite right"}
        </Text>

        <Text ta="center" size="sm">
          {validationResult.feedback}
        </Text>

        {!isCorrect && onRetry && (
          <Button onClick={handleRetry} variant="light">
            Try Again
          </Button>
        )}
      </Stack>
    );
  }

  return null;
};
