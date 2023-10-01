import { ask, openai } from "./server/routers/perform-exam";
import { wordCount } from "./utils/random-new";

const examples = [
  ["땀이 많이 나요.", "I sweat a lot."],
  [
    "뚫린 문을 통해 바람이 들어왔어요.",
    "The wind came in through the open door.",
  ],
  ["로그인하셨나요?", "Did you log in?"],
  ["메뚜기 떼나가 도시를 공격했어요.", "A swarm of locusts attacked the city."],
  ["메뚜기는 점프를 잘해요.", "Grasshoppers jump well."],
  [
    "멸종 위기에 처한 동물들이 있어요.",
    "There are animals that are at risk of extinction.",
  ],
  ["비가 계속 옵니다.", "It keeps raining."],
  ["우리는 이 문제를 떠안아야 해요.", "We have to embrace this problem."],
  [
    "저는 공부를 마치고 집에 갔어요.",
    "I went home after finishing my studies.",
  ],
  ["저는 이번 프로젝트를 맡았어요.", "I took charge of this project."],
  [
    "퀄리티가 떨어지니까 고쳐봐요.",
    "Try fixing it because the quality is dropping.",
  ],
];

examples.map(async ([koTxt, enTxt]) => {
  if (wordCount(koTxt) < 7) {
    const prompt = [
      koTxt,
      enTxt,
      "---",
      "Please generate a DALL-E prompt that illustrates the phrase above.",
    ].join("\n");
    const [resp] = await ask(prompt, {
      model: "gpt-4",
      temperature: 0.9,
      best_of: 2,
    });
    if (typeof resp == "string") {
      const response = await openai.createImage({
        prompt: resp + ". no writing or captions.",
        size: "256x256",
        n: 1,
      });
      const urls = response.data.data.map((d) => d.url);
      urls.map((url) => {
        console.log(["====", koTxt, enTxt, url].join("\n"));
      });
    }
  }
});
