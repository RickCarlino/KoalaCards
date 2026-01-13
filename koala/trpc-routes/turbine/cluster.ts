import { generateAIText, generateStructuredOutput } from "@/koala/ai";
import { z } from "zod";
import { clean } from "./util";
import { alphabetical, cluster, template, unique } from "radash";
import { supportedLanguages } from "@/koala/shared-types";
import type { CoreMessage } from "@/koala/ai";

const TRANSLATION = z.array(
  z.object({
    term: z.string(),
    definition: z.string(),
  }),
);

const ClusterSchema = z.object({
  clusters: TRANSLATION,
});

const SYSTEM_PROMPT = `
You are a Korean language expert creating flashcards for a spaced repetition app.
Your task is to generate high-frequency collocation pairs based on statistically likely co-occurrences.

Instructions:

    Input: A list of target words in Korean.

    Task: For each target word:
        1) Convert the input to its base form (lemma).
        2) Create one high-frequency, idiomatic collocation pair that naturally includes the base word.
        3) Keep the term short and natural (2 words).
        4) If the word is a typo or misspelling, skip it and do not create a card.

    Verb/adjective rule:
        Never use the plain/dictionary form in the output for verbs or adjectives.
        Use conjugated or derived forms instead (해요, 합니다, 히, 하게, 적인, etc).

    Output Format:
    For each valid target word, return one JSON object:

    {"term": "<high frequency word pair>", "definition": "<English translation>"}

    Do not include any extra hints, commentary, or formatting beyond this structure.

    Quality Guidelines:
        Ensure the term is grammatically correct and idiomatic.
        Provide an accurate, natural English translation.
        Double-check for grammatical errors, non-idiomatic expressions, or mistranslations.

Examples (input -> output):

    철라하다 ⇒ {"term": "철라한 환경", "definition": "a strict environment"}
    고려하다 ⇒ {"term": "고려해 보면", "definition": "if you consider it"}
    사수이다 ⇒ {"term": "사수이자 멘토입니다", "definition": "a senior and mentor"}
    추적하다 ⇒ {"term": "위치를 추적하고 있어요", "definition": "tracking the location"}
    사정 ⇒ {"term": "개인적인 사정으로", "definition": "for personal reasons"}
    일원이다 ⇒ {"term": "팀의 일원", "definition": "a member of the team"}

Examples of high-quality outputs:

    {"term": "심한 피로감", "definition": "severe fatigue"}
    {"term": "공식 발표", "definition": "an official announcement"}
    {"term": "흥미로운 이야기", "definition": "an interesting story"}
    {"term": "기후 변화", "definition": "climate change"}
    {"term": "우리끼리만 놀았어", "definition": "just hung out among ourselves"}
    {"term": "아버지의 명령", "definition": "a father's command"}
    {"term": "사정 설명합니다", "definition": "explain the circumstances"}
    {"term": "요구에 맞추어", "definition": "to meet the requirements"}
    {"term": "맛있는 조합", "definition": "a delicious combination"}
    {"term": "정오에야 시작", "definition": "start only at noon"}
    {"term": "구멍을 뚫었어", "definition": "punched a hole"}
    {"term": "일이 힘겹습니다", "definition": "the work is tough"}
    {"term": "활용된 물품", "definition": "utilized items"}
    {"term": "보람찬 하루", "definition": "a rewarding day"}
    {"term": "잠이 드셨나요?", "definition": "Did you fall asleep?"}
    {"term": "내려야 하는데", "definition": "need to decide"}
    {"term": "흥미로운 줄거리", "definition": "an interesting plot"}
    {"term": "장기 출장", "definition": "a long business trip"}
    {"term": "대학교 동창", "definition": "a university classmate"}
    {"term": "분명한 목소리", "definition": "a clear voice"}
    {"term": "근사한 저녁", "definition": "a lovely evening"}
    {"term": "새로운 조리법", "definition": "a new recipe"}
    {"term": "고아원 원장", "definition": "an orphanage director"}
    {"term": "미래를 두려워해", "definition": "fear the future"}
    {"term": "대책 강구", "definition": "devise countermeasures"}
    {"term": "현상을 분석해", "definition": "analyze the phenomenon"}
    {"term": "긍정적인 태도", "definition": "a positive attitude"}
    {"term": "매체를 통해", "definition": "through the media"}
    {"term": "회사의 기강", "definition": "company discipline"}
    {"term": "문제가 존재하지만", "definition": "although a problem exists"}
    {"term": "출석 요구", "definition": "attendance requirement"}
    {"term": "아이돌 연습생", "definition": "an idol trainee"}
    {"term": "위기에서 빠져나갑니다", "definition": "escape from the crisis"}
    {"term": "열판한 논쟁", "definition": "a heated debate"}
    {"term": "다재다능한 사람", "definition": "a versatile person"}
    {"term": "부정적 견해", "definition": "a negative view"}
    {"term": "중요한 과업", "definition": "an important task"}
    {"term": "천연 재료", "definition": "natural ingredients"}
    {"term": "대화가 진지합니다", "definition": "the conversation is serious"}
    {"term": "놀라지 않게끔", "definition": "so as not to be surprised"}
    {"term": "천원짜리 지폐", "definition": "a 1,000-won bill"}
    {"term": "대륙과 대양", "definition": "continents and oceans"}
    {"term": "드라마의 주인공", "definition": "the main character of the drama"}
    {"term": "빛나는 업적", "definition": "a brilliant achievement"}
    {"term": "찬성 이유", "definition": "a reason for support"}
    {"term": "예제 문제", "definition": "an example problem"}
    {"term": "가는 철사", "definition": "thin wire"}
    {"term": "분명한 발음", "definition": "clear pronunciation"}
    {"term": "재산을 소유해", "definition": "own property"}
    {"term": "깊은 우정", "definition": "deep friendship"}
    {"term": "유명한 연출가", "definition": "a famous director"}
    {"term": "평범한 삶", "definition": "an ordinary life"}
    {"term": "가벼운 배탈", "definition": "a mild stomachache"}
    {"term": "목표가 이뤄졌어", "definition": "the goal was achieved"}
    {"term": "집필한 내용", "definition": "written content"}
    {"term": "포근한 날씨", "definition": "mild weather"}
    {"term": "서류를 제출해", "definition": "submit the documents"}
    {"term": "명령을 내리다", "definition": "issue an order"}
    {"term": "팀을 응원한다", "definition": "cheer for the team"}
    {"term": "미래를 예측해요", "definition": "predict the future"}
    {"term": "기지를 파괴해요", "definition": "destroy the base"}
    {"term": "고통스러운 경험", "definition": "a painful experience"}
    {"term": "주식을 거래했어", "definition": "traded stocks"}
    {"term": "저는 운동선수로는", "definition": "as an athlete"}
    {"term": "공정한 사회", "definition": "a fair society"}
    {"term": "일상 생활", "definition": "everyday life"}
    {"term": "과연 그럴까요?", "definition": "is that really the case?"}

Avoid obscure, ungrammatical, or non-idiomatic examples.
Skip misspellings.
Skip proper nouns (names, places, etc..) unless they are part of a common collocation.
DO NOT ADD HELPFUL NOTES OR EXPLANATIONS.
DO NOT TELL ME YOU SKIPPED A WORD, JUST WRITE THE CARDS FOR THE VALID ONES.
DO NOT WRITE IN 해라체 OR USE ~다 ENDINGS FOR VERBS/ADJECTIVES! Other forms only.
`;

const USER_PROMPT = `
Please generate one collocation pair flashcard for each of the following words:

{{WORDS}}

Double check your output when you are done.
`;

function tpl(x: string, y: {}) {
  return template(x, y);
}

type Translation = z.infer<typeof TRANSLATION>[number];

async function run(
  language: string,
  words: string[],
): Promise<Translation[]> {
  const part1: CoreMessage[] = [
    {
      role: "system",
      content: tpl(SYSTEM_PROMPT, { LANGUAGE: language }),
    },
    {
      role: "user",
      content: tpl(USER_PROMPT, { WORDS: clean(words.join("\n")) }),
    },
  ];

  const content = await generateAIText({
    model: "good" as const,
    messages: part1,
  });

  const KOREAN_EDIT = `
  You are a Korean language content editor.
  You edit flashcards for a language learning app.
  Edit the cards so that they conform to the following standards:

  1. Verbs and adjectives must not be in plain/dictionary form (no "~다" endings). Use conjugated or derived forms (해요, 합니다, 히, 하게, 적인, etc).
  2. Avoid over use of pronouns in translations. Translate "음식을 데워요" to just "heat up food" rather than "he/she/they heat up food".
  3. Remove strange, obscure or non-idiomatic examples.
  4. Avoid overused words like: 분위기, 상황, 느낌, 느끼다, 계획
  5. If the target word is a typo or misspelling, omit the card.

  Double check your work against these rules when you are done.
  `;
  const parsedResponse = await generateStructuredOutput({
    model: "cheap" as const,
    messages: [
      ...part1,
      {
        role: "assistant",
        content: content,
      },
      {
        role: "system",
        content:
          language === supportedLanguages.ko
            ? KOREAN_EDIT
            : "Double check your output when you are done.",
      },
    ],
    schema: ClusterSchema,
    maxTokens: 10000,
  });

  if (!parsedResponse) {
    throw new Error("Invalid response format from AI model.");
  }

  return parsedResponse.clusters;
}

export async function clusters(
  words: string[],
  language: string,
): Promise<Translation[]> {
  if (words.length < 1) {
    return [];
  }

  const results: Translation[][] = await Promise.all(
    cluster(words.slice(0, 120), 12).map((chunk) => run(language, chunk)),
  );
  const c = alphabetical(results.flat(), (x: Translation) => x.term);
  return unique(c, (x: Translation) => x.term);
}
