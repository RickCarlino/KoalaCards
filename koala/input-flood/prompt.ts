import {
  INPUT_FLOOD_SENTENCE_MAX_WORDS,
  INPUT_FLOOD_WHY_ERROR_MAX_CHARS,
} from "@/koala/types/input-flood";
import { LangCode } from "@/koala/shared-types";

export type PromptParams = {
  langCode: LangCode;
  definition: string;
  provided: string;
  reason: string;
};

export function buildInputFloodPrompt({
  langCode: _langCode,
  definition,
  provided,
  reason,
}: PromptParams): string {
  return `역할: 한국어 교육을 위한 입력 범람(Input Flood) 훈련 과제를 생성한다.

입력 범람 요약:
- 학습자가 틀린 지점을 "많고 자연스러운 예문"으로 포화시켜 사용 패턴을 체득하게 한다.
- 문장들은 모두 실제 사용 맥락에서 자연스럽고 빈도 높은 표현이어야 한다(번역투 금지).

데이터:
- 영어 의미: ${definition}
- 학습자 시도(한국어): ${provided}
- 왜 틀렸는지: ${reason}

출력 형식:
- JSON만 반환. 스키마와 정확히 일치해야 한다.
- 학습자에게 노출되는 모든 문장과 단어는 반드시 한국어로 작성한다.
- 단, diagnosis.error_explanation는 영어로 작성한다(교사 메모 용도). 이때 반드시 학습자에게 직접 말하듯 2인칭 "you"로 서술할 것(예: "You said …", "Use … instead"). "the learner", "the student" 같은 3인칭 표현은 금지. 수동태 남용 금지.
- 로마자 표기, 괄호/대괄호, 품사 태그, 따옴표, 이모지, 주석 금지.

문장 지침(아주 중요):
- 길이: 한 문장당 최대 ${INPUT_FLOOD_SENTENCE_MAX_WORDS} 어절 내.
- 자연스러운 회화/서술체를 사용(지나치게 문어적·번역투 표현 금지).
- 2인칭 "당신" 사용 금지. 필요 시 주어 생략, 혹은 적절한 명령/청유/평서로 표현.
- 그/그녀 같은 인칭대명사는 꼭 필요한 경우에만 쓰고, 가능하면 주어를 생략한다.
- 의미가 같다면 일상에서 더 자주 쓰는 표현을 선택(불필요한 한자어/격식체 지양).
- 중복 금지: 같은 동사/명사만 반복하지 말고 자연스러운 단어를 섞어 쓴다.

사용 맥락(중요):
- target / contrast의 example.text는 그대로 학습 카드와 음성(TTS)에 사용된다.
- 따라서 example에는 "문장(text)"과 그 영어 풀이("en")만 포함한다. 부가 설명/주석 금지.

유효성 규칙:
- target: label에 제시된 목표 형태를 문장이 분명히 드러내야 한다(문법적이어야 함).
- contrast: 대비 형태를 분명히 드러내되, target 형태는 절대 사용하지 않는다. 명확한 대비가 없으면 null.
- 어휘/용법 오류인 경우, 관련 단어를 자연스러운 다양한 맥락에서 반복 노출하되 문법은 항상 정확해야 한다.

톤:
- 교정적이고 간결하게. 번역투 금지. 학습자 지시에는 자연스러운 한국어 화법 사용.
- 영어 설명/규칙은 학습자에게 직접 말하듯 2인칭 "you" 시점으로 작성(예: "You used …", "You should say …").

생성 단계:
1) diagnosis
  - original: 학습자 시도문(그대로)
  - corrected: 해당 의미를 자연스럽게 표현한 한국어 한 문장
  - error_explanation: 짧은 영어 설명(≤${INPUT_FLOOD_WHY_ERROR_MAX_CHARS}자)
2) target
  - target: label + 예문 1개(example.text는 한국어, example.en은 영어 풀이)
  - contrast: label + 예문 1개 또는 null
3) production
  - prompt_en(영어 질문) + answer(한국어 정답) 1개. 한국어는 번역투 없이 자연스러운 표현으로.

내부 분류 규칙(출력 금지):
- give_up(예: "몰라요", 무의미 입력) → 시도하지 않음으로 처리. error_explanation: "You gave up. Correct form is X."(영문)
- off_language(한국어가 아님) / totally_wrong → give_up 처리
- vocabulary → 특정 어휘 오해. 관련 어휘를 target(/contrast)에 자연스럽게 병치
- usage → 흔한 결합/용법 오해
- form → 형태소·활용 오류
- grammar → 통사/문장 구성 오류
- answer → 일반 비교·대조

엄격한 개수 제한:
- target.example = 정확히 1개
- contrast.example = 정확히 1개 또는 null
- production = 정확히 1개

스키마:
{
  "diagnosis": {
    "original": string,
    "corrected": string,
    "error_explanation": string
  },
  "target": { "label": string, "example": { "text": string, "en": string } },
  "contrast": { "label": string, "example": { "text": string, "en": string } } | null,
  "production": { "prompt_en": string, "answer": string }
}`;
}
