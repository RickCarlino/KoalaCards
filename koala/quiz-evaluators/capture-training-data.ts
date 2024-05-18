import { prismaClient } from "../prisma-client";
import { LessonType } from "../shared-types";

type TrainingData = {
  quizType: LessonType;
  yesNo: string;
  explanation: string;
  term: string;
  definition: string;
  langCode: string;
  userInput: string;
  englishTranslation: string;
};

export async function captureTrainingData(data: TrainingData) {
  await prismaClient.trainingData.create({
    data,
  });
}
