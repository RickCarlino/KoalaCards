-- CreateTable
CREATE TABLE "TrainingData" (
    "id" SERIAL NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "quizType" TEXT NOT NULL,
    "yesNo" TEXT NOT NULL,
    "explanation" TEXT NOT NULL,
    "term" TEXT NOT NULL,
    "definition" TEXT NOT NULL,
    "langCode" TEXT NOT NULL,
    "userInput" TEXT NOT NULL,
    "englishTranslation" TEXT NOT NULL,

    CONSTRAINT "TrainingData_pkey" PRIMARY KEY ("id")
);
