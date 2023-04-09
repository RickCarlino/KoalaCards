import "./utils/env";
import { Phrase } from "@prisma/client";
import { prismaClient } from "./prisma-client";
import { ask } from "./utils/ask";
import { transcribeSpeech } from "./utils/transcribe-speech";
import { map, shuffle } from "radash";
import { speak } from "./utils/speak";
import { play } from "./utils/play";
import { keyboardInput } from "./utils/keyboard-input";

const ssml = (...text: string[]) => {
  return `<speak>${text.join(" ")}</speak>`;
};

const slow = (text: string) => {
  return `<prosody rate="slow">${text}</prosody>`;
};

const en = (text: string) => {
  return `<voice language="en-US" gender="female">${text}</voice>`;
};

const pause = (ms: number) => {
  return `<break time="${ms}ms"/>`;
};

const cleanYesNo = (answer?: string) => {
  return (answer ?? "?")
    .replace(/(\s|\W)+/g, " ")
    .trim()
    .toUpperCase()
    .split(" ")[0];
};

const inspectResult = async (
  userSaid: string,
  gptSaid: string = "",
  phrase: Phrase
) => {
  if (cleanYesNo(gptSaid) === "NO") {
    const hmm = `
    Korean Sentence:  ${phrase.ko}
    English Translation: ${phrase.en}
    Student Response: ${userSaid}`;
    console.log(hmm);
    console.log(`GPT Says: ${gptSaid}`);
    const resp = await keyboardInput("Why did you fail? Ask for help, or press enter to skip:");
    if (resp.length < 4) {
      return
    }
    const [x] = await ask(`
    A Korean language learning student uses a voice-only speaking/listening
    app to drill on Korean sentences.

    Unfortunately, the student failed a drill for the following sentence:
    ${hmm}

    We asked the student why they failed. Here is their response:
    ${resp}

    Can you please provide them some help to improve?
    `);

    console.log("GPT Says: ");
    console.log(x ?? "?");
    await keyboardInput("Press enter to continue...");
  }
  // const data = [
  // ];
  // console.log(data.join("\n"));
};

const translationPrompt = (ko: string, response: string) => {
  return `
    A Korean language student was asked to translate the following phrase to english: ${ko}.
    The student provided this translation: ${response}
    Was the student correct?
    Slight variations in spacing and punctuation are acceptable.
    The meanings of the two sentences must express the exact same idea.
    Punctuation and word choice do not need to be exact.
    Reply "YES" if it is a correct translation.
    Reply "NO" if it is incorrect, then provide a reason why it is wrong
    `;
};

const NEXT_QUIZ_TYPES: Record<string, string | undefined> = {
  dictation: "listening",
  listening: "speaking",
  speaking: "listening",
};

const markCorrect = async (phrase: Phrase) => {
  /** Increase `win_count`, `total_attempts`.
    Recalculate `win_percentage`.
    Set last `last_win_at` to current time.
    Calculate next value of `next_quiz_type` based
    on the following table:

    | Previous Val  | Next Val      |
    |---------------|---------------|
    | "dictation"   | "listening"   |
    | "listening"   | "speaking"    |
    | All others    | "dictation"   | */
  await prismaClient.phrase.update({
    where: { id: phrase.id },
    data: {
      win_count: { increment: 1 },
      total_attempts: { increment: 1 },
      win_percentage: (phrase.win_count + 1) / (phrase.total_attempts + 1),
      last_win_at: { set: new Date() },
      next_quiz_type:
        NEXT_QUIZ_TYPES[phrase.next_quiz_type ?? "dictation"] ?? "dictation",
    },
  });
};

const markIncorrect = async (phrase: Phrase) => {
  await prismaClient.phrase.update({
    where: { id: phrase.id },
    data: {
      loss_count: { increment: 1 },
      total_attempts: { increment: 1 },
      win_percentage: phrase.win_count / (phrase.total_attempts + 1),
      last_win_at: undefined,
      next_quiz_type: "dictation",
    },
  });
};

async function gradeResp(answer: string = "", phrase: Phrase) {
  const cleanAnswer = cleanYesNo(answer);
  switch (cleanAnswer) {
    case "YES":
      play("sfx/tada.mp3");
      await markCorrect(phrase);
      return true;
    case "NO":
      play("sfx/beep.mp3");
      await markIncorrect(phrase);
      return false;
    default:
      throw new Error("Invalid answer: " + JSON.stringify(answer));
  }
}

async function dictationTest(phrase: Phrase) {
  await speak(ssml(en("Repeat after me: "), pause(250), phrase.ko, pause(250), slow(phrase.ko)));
  const { transcript } = await transcribeSpeech();
  const [answer] = await ask(
    `
  A Korean language student was asked to read the following phrase aloud: ${phrase.ko}.
  The student read: ${transcript}
  Was the student correct?
  Slight variations in spacing and punctuation are acceptable.
  The meanings of the two sentences must express the exact same idea.
  Punctuation and word choice do not need to be exact.
  (YES/NO)
  `,
    { best_of: 1, temperature: 0.2 }
  );
  const grade = gradeResp(answer, phrase);
  await speak(ssml(en(phrase.en)));
  await speak(ssml(phrase.ko));
  play("/tmp/last-recording.wav");
  await inspectResult(transcript, answer, phrase);
  return grade;
}

async function listeningTest(phrase: Phrase) {
  let transcript = "";
  await speak(ssml(en("Say this in English"), pause(250), phrase.ko));
  const results = await transcribeSpeech({ lang: "en" });
  transcript = results.transcript;
  const p = translationPrompt(phrase.ko, transcript);
  const [answer] = await ask(p);
  const grade = gradeResp(answer, phrase);
  console.log(p);
  console.log(answer);
  await speak(ssml(en(phrase.en)));
  await inspectResult(transcript, answer, phrase);
  return grade;
}

async function speakingTest(phrase: Phrase) {
  await speak(ssml(en("Say this in Korean: "), pause(250), en(phrase.en)));
  const { transcript } = await transcribeSpeech();
  const [answer] = await ask(
    `An English-speaking Korean language student was asked
    to translate the following phrase to Korean: ${phrase.en}.
    The student said: ${transcript}
    Was the student correct?
    Slight variations in spacing and punctuation are acceptable.
    The meanings of the two sentences must express the exact same idea.
    Punctuation and word choice do not need to be exact.
    (YES/NO)`,
    { best_of: 1, temperature: 0.2 }
  );
  const grade = gradeResp(answer, phrase);
  await speak(ssml(phrase.ko));
  play("/tmp/last-recording.wav");
  await inspectResult(transcript, answer, phrase);
  return grade;
}

export async function runExam() {
  const results = await prismaClient.phrase.findMany({
    orderBy: { win_percentage: "asc" },
  });

  type Quiz = (phrase: Phrase) => Promise<boolean>;
  const x = await map(shuffle(results), async (phrase) => {
    // const QUIZ: Record<string, Quiz> = {
    //   dictation: dictationTest,
    //   listening: listeningTest,
    //   speaking:  speakingTest,
    // };
    const quiz = shuffle([dictationTest, listeningTest, speakingTest])[0] || dictationTest;
    // Call quiz(phrase) until it returns true:
    while (true) {
      const result = await quiz(phrase);
      if (result) {
        break;
      }
    }
  });

  console.log("Well done! You've completed the exam.");
}
runExam();
