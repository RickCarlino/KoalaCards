import { PrismaClient } from "@prisma/client";
import { map, shuffle } from "radash";
// CREDIT: "Korean Grammar Sentences by Evita"
// https://ankiweb.net/shared/info/3614346923
export const GRAMMAR = [
  {
    ko: "살을 빼고 싶어요.",
    en: "I want to lose weight.",
    length: 3,
  },
  {
    ko: "다 사게 됐어요.",
    en: "I bought them all.",
    length: 3,
  },
  {
    ko: "집에서 음악을 들으려고 해요.",
    en: "I want to listen to music at home.",
    length: 4,
  },
  {
    ko: "책을 다 읽다.",
    en: "read all the books",
    length: 3,
  },
  {
    ko: "학교에서 집까지 걸어서 가요.",
    en: "I walk home from school.",
    length: 4,
  },
  {
    ko: "이제 어쩔 거예요?",
    en: "What are you going to do now?",
    length: 3,
  },
  {
    ko: "친구를 두 시간이나 기다렸어요.",
    en: "I waited two hours for my friend.",
    length: 4,
  },
  {
    ko: "왜 이것만 샀어요?",
    en: "why did you only buy this?",
    length: 3,
  },
  {
    ko: "아니요, 그렇게 많이 바쁘지 않아요.",
    en: "No, I'm not that busy.",
    length: 5,
  },
  {
    ko: "귀에 안 좋아요.",
    en: "Not good for your ears.",
    length: 3,
  },
  {
    ko: "식당은 몇 층에 있어요?",
    en: "What floor is the restaurant on?",
    length: 4,
  },
  {
    ko: "그래서 샐리는 정민이에게 전화했어요.",
    en: "So Sally called Jung-min.",
    length: 4,
  },
  {
    ko: "사무실에서 기다리겠습니다.",
    en: "I'll wait for you at the office.",
    length: 2,
  },
  {
    ko: "네, 알았어요.",
    en: "I understand.",
    length: 2,
  },
  {
    ko: "그러면 그걸로 두 개 주세요.",
    en: "Then give me two of them.",
    length: 5,
  },
  {
    ko: "그런데 어제부터 머리도 아프고 열도 나요.",
    en: "But since yesterday I have a headache and a fever.",
    length: 6,
  },
  {
    ko: "지하철 4호선을 타고 가세요.",
    en: "Take subway line 4 to get there.",
    length: 4,
  },
  {
    ko: "저도 모르겠어요.",
    en: "I don't know either.",
    length: 2,
  },
  {
    ko: "친구가 전화했어요.",
    en: "A friend called.",
    length: 2,
  },
  {
    ko: "아, 그럼 MP3로 사야겠군요.",
    en: "Oh, then I'll have to buy it as an MP3.",
    length: 4,
  },
  {
    ko: "볼펜을 사세요.",
    en: "Buy a ballpoint pen.",
    length: 2,
  },
  {
    ko: "저거 얼마예요?",
    en: "how much is that",
    length: 2,
  },
  {
    ko: "여행을 가는 대신에 아르바이트를 했어요.",
    en: "Instead of traveling, I got a part-time job.",
    length: 5,
  },
  {
    ko: "한국 회사에 적응을 못할까 봐 걱정이에요.",
    en: "I'm worried that I won't be able to adapt to a Korean company.",
    length: 6,
  },
  {
    ko: "중요한 모임인데 당연히 정장을 입어야지요.",
    en: "It's an important meeting, so of course you have to wear a suit.",
    length: 5,
  },
  {
    ko: "와, 맛있겠어요.",
    en: "Wow, that sounds delicious.",
    length: 2,
  },
  {
    ko: "세일해서 싸게 샀어요.",
    en: "I bought it cheap because it was on sale.",
    length: 3,
  },
  {
    ko: "이야기도 하고 음식도 만들어 먹을까 해요.",
    en: "Let's talk and make food.",
    length: 6,
  },
  {
    ko: "전화번호는 한 자리씩 읽는다.",
    en: "Phone numbers are read one digit at a time.",
    length: 4,
  },
  {
    ko: "미국 회사에 이메일을 보내야 해요.",
    en: "I need to email an American company.",
    length: 5,
  },
  {
    ko: "왜 약속을 했다가 바꿨어요?",
    en: "Why did you make an appointment and then change it?",
    length: 4,
  },
  {
    ko: "1시간 후에 오세요.",
    en: "Come back in an hour.",
    length: 3,
  },
  {
    ko: "아이들이 배가 고프다고 합니다.",
    en: "The children say they are hungry.",
    length: 4,
  },
  {
    ko: "혼자 갈 거예요.",
    en: "I will go alone.",
    length: 3,
  },
  {
    ko: "내일 병원에 가야 돼요.",
    en: "I have to go to the hospital tomorrow.",
    length: 4,
  },
  {
    ko: "이 회사에 취직하려면 어떻게 해야 합니까?",
    en: "How can I get a job at this company?",
    length: 6,
  },
  {
    ko: "그럼 나는 여기서 기다린다?",
    en: "Then I wait here",
    length: 4,
  },
  {
    ko: "이 케이크가 맛있어 보여서 샀는데, 너무 달아요.",
    en: "I bought this cake because it looked delicious, but it is too sweet.",
    length: 7,
  },
  {
    ko: "어제 온 사람들 누구예요?",
    en: "Who are the people who came yesterday?",
    length: 4,
  },
  {
    ko: "사진이랑 동영상들을 보면 너도 생각이 달라질걸.",
    en: "If you look at the pictures and videos, you will change your mind too.",
    length: 6,
  },
  {
    ko: "리모콘을 찾으면 TV를 볼 수 있어요.",
    en: "If you find the remote control, you can watch TV.",
    length: 6,
  },
  {
    ko: "내일 일할 거야.",
    en: "i will work tomorrow",
    length: 3,
  },
  {
    ko: "갈비를 먹어 봤어요?",
    en: "Have you tried galbi?",
    length: 3,
  },
  {
    ko: "그렇게 하게 될 거예요.",
    en: "You will do that.",
    length: 4,
  },
  {
    ko: "아마 안 할 것 같아요.",
    en: "I probably won't.",
    length: 5,
  },
  {
    ko: "저는 여동생이 있어요.",
    en: "I have a younger sister.",
    length: 3,
  },
  {
    ko: "투이 씨가 도와준 덕분에 일이 금방 끝났어요.",
    en: "Thanks to Thuy's help, the job was finished quickly.",
    length: 7,
  },
  {
    ko: "아무리 늦어도 2시까지는 오세요.",
    en: "Please come by 2 o'clock at the latest.",
    length: 4,
  },
  {
    ko: "여자 친구한테 선물할 거예요.",
    en: "I will gift it to my girlfriend.",
    length: 4,
  },
  {
    ko: "그 이야기를 믿어요?",
    en: "Do you believe that story?",
    length: 3,
  },
  {
    ko: "날씨가 좋으니까 산에 갈까요?",
    en: "Since the weather is nice, shall we go to the mountains?",
    length: 4,
  },
  {
    ko: "내일 비가 올까요?",
    en: "Will it rain tomorrow?",
    length: 3,
  },
  {
    ko: "그거 아직 안 버렸어요.",
    en: "I haven't thrown it away yet.",
    length: 4,
  },
  {
    ko: "한 달 후에 아기가 태어나요.",
    en: "The baby is born in a month.",
    length: 5,
  },
  {
    ko: "김 과장님은 지금 외출 중이십니다.",
    en: "Manager Kim is out right now.",
    length: 5,
  },
  {
    ko: "사과하고 빵을 먹어요.",
    en: "eat apples and bread.",
    length: 3,
  },
  {
    ko: "노래하는 사람.",
    en: "a person who sings",
    length: 2,
  },
  {
    ko: "무슨 영화를 볼까요?",
    en: "What movie shall we see?",
    length: 3,
  },
  {
    ko: "그 사람이 내일 온다고 해요.",
    en: "He says he will come tomorrow.",
    length: 5,
  },
  {
    ko: "이거 재미있다고 들었어요.",
    en: "I heard this is fun.",
    length: 3,
  },
  {
    ko: "첫 학기라서 조금 바빠요.",
    en: "It's my first semester, so I'm a bit busy.",
    length: 4,
  },
  {
    ko: "아무런 소식도 없어요.",
    en: "No news.",
    length: 3,
  },
  {
    ko: "그럼 야채를 많이 드세요.",
    en: "Then eat lots of vegetables.",
    length: 4,
  },
  {
    ko: "그분은 키가 큰가요?",
    en: "is he tall?",
    length: 3,
  },
  {
    ko: "돈이 없는데 좀 빌려주세요.",
    en: "I don't have any money. Please lend me some.",
    length: 4,
  },
  {
    ko: "그래서 길이 막혀요.",
    en: "So the road is blocked.",
    length: 3,
  },
  {
    ko: "들어가자마자 다시 나왔어요.",
    en: "As soon as I went in, I came out again.",
    length: 3,
  },
  {
    ko: "여러분 기억나세요?",
    en: "Do you guys remember?",
    length: 2,
  },
  {
    ko: "아무데나 가고 싶지 않아요.",
    en: "I don't want to go anywhere.",
    length: 4,
  },
  {
    ko: "컴퓨터도 고쳐요.",
    en: "I also fix my computer.",
    length: 2,
  },
  {
    ko: "안녕히 계세요.",
    en: "good bye.",
    length: 2,
  },
  {
    ko: "영화가 재미있을 것 같아서 봤는데 재미없었어요.",
    en: "I watched the movie because I thought it would be interesting, but it wasn't.",
    length: 6,
  },
  {
    ko: "책을 읽고 나서 쓰는 글이에요.",
    en: "This is what I write after reading the book.",
    length: 5,
  },
  {
    ko: "돈을 모아서 뭐 할 거예요?",
    en: "What are you going to do with the money?",
    length: 5,
  },
  {
    ko: "이렇게 비싼 줄 몰랐어요.",
    en: "I didn't know it was so expensive.",
    length: 4,
  },
  {
    ko: "노래를 잘 하시는군요.",
    en: "You sing well.",
    length: 3,
  },
  {
    ko: "밥을 먹는데 어머니가 나를 부르셨습니다.",
    en: "While eating, my mother called me.",
    length: 5,
  },
  {
    ko: "외국 손님들이 오셔서 통역이 필요합니다.",
    en: "Foreign guests are coming and need an interpreter.",
    length: 5,
  },
  {
    ko: "직접 보니까 어때요?",
    en: "How about seeing it in person?",
    length: 3,
  },
  {
    ko: "저는 글을 잘 못 써요.",
    en: "I am not good at writing.",
    length: 5,
  },
  {
    ko: "잠시 후에 인천공항에 도착하겠습니다.",
    en: "We will arrive at Incheon Airport in a while.",
    length: 4,
  },
  {
    ko: "30살 전에 결혼했으면 좋겠어요.",
    en: "I wish I had gotten married before I turned 30.",
    length: 4,
  },
  {
    ko: "우리 같이 노래방이나 가요.",
    en: "Let's go to karaoke together.",
    length: 4,
  },
  {
    ko: "주말이라 사람들이 많이 올 테니까요.",
    en: "Because it is the weekend, many people will come.",
    length: 5,
  },
  {
    ko: "줄이 길어졌어요.",
    en: "The line got long.",
    length: 2,
  },
  {
    ko: "누가 저를 불렀어요?",
    en: "who called me?",
    length: 3,
  },
  {
    ko: "일주일이 빨리 가는 것 같아요.",
    en: "The week seems to go by quickly.",
    length: 5,
  },
  {
    ko: "저 대신에 해 줄 수 있어요?",
    en: "can you do it for me?",
    length: 6,
  },
  {
    ko: "다니엘이 읽는 책을 사고 싶어요.",
    en: "I want to buy the book Daniel is reading.",
    length: 5,
  },
  {
    ko: "저런 색깔은 어때요?",
    en: "How about that color?",
    length: 3,
  },
  {
    ko: "바지가 좀 긴데 다른 바지 없어요?",
    en: "The pants are a bit long. Do you have any other pants?",
    length: 6,
  },
  {
    ko: "평소에 열심히 공부하라고 했잖아요.",
    en: "You always told me to study hard.",
    length: 4,
  },
  {
    ko: "민우는 다른 책은 안 읽고 만화책만 읽어요.",
    en: "Minwoo doesn't read other books, he only reads comic books.",
    length: 7,
  },
  {
    ko: "그래도 공부를 계속해야겠지요?",
    en: "Should I still continue studying?",
    length: 3,
  },
  {
    ko: "선생님한테서 소식을 들었어요.",
    en: "I heard the news from the teacher.",
    length: 3,
  },
  {
    ko: "배운 적 있어요.",
    en: "I've learned",
    length: 3,
  },
  {
    ko: "5시간 동안 운전을 했더니 허리가 너무 아프더라고요.",
    en: "After driving for 5 hours, my back hurt so much.",
    length: 7,
  },
  {
    ko: "여기 비싼 것 같아요.",
    en: "I guess it's expensive here.",
    length: 4,
  },
  {
    ko: "누가 그렇게 말했냐고 물었어요.",
    en: "I asked who said that.",
    length: 4,
  },
  {
    ko: "여자 친구한테 주려고 선물을 샀어요.",
    en: "I bought a present for my girlfriend.",
    length: 5,
  },
  {
    ko: "한국 친구를 사귀어 보고 싶어요.",
    en: "I want to make Korean friends.",
    length: 5,
  },
  {
    ko: "수진 씨 덕분에 여행 준비가 빨리 끝났어요.",
    en: "Thanks to Sujin, the preparations for the trip were completed quickly.",
    length: 7,
  },
  {
    ko: "밥 먹으러 가요.",
    en: "go eat",
    length: 3,
  },
  {
    ko: "저 내일 올 수도 있어요.",
    en: "I might come tomorrow",
    length: 5,
  },
  {
    ko: "감기 조심하십시오.",
    en: "Be careful not to catch a cold.",
    length: 2,
  },
  {
    ko: "저는 졸릴 때마다 커피를 마셔요.",
    en: "I drink coffee whenever I am sleepy.",
    length: 5,
  },
  {
    ko: "어디로 오라고 했어요?",
    en: "where did you tell me to come?",
    length: 3,
  },
  {
    ko: "제이슨 씨는 12시까지만 공부하고 자요.",
    en: "Mr. Jason only studies until 12:00 and sleeps.",
    length: 5,
  },
  {
    ko: "이번 주 금요일 저녁에 시간 있어요?",
    en: "Do you have time this Friday evening?",
    length: 6,
  },
  {
    ko: "기분이 좋아 보여요.",
    en: "You look good.",
    length: 3,
  },
  {
    ko: "집 밖에 고양이가 있어요.",
    en: "There is a cat outside the house.",
    length: 4,
  },
  {
    ko: "방학이 빨리 왔으면 좋겠어요.",
    en: "I hope vacation comes soon.",
    length: 4,
  },
  {
    ko: "민우 씨는 지금 자리에 없는데요.",
    en: "Minwoo is not at his desk right now.",
    length: 5,
  },
  {
    ko: "저처럼 해 보세요.",
    en: "Try it like me.",
    length: 3,
  },
  {
    ko: "한국에 비해서 훨씬 추워요.",
    en: "It is much colder than Korea.",
    length: 4,
  },
  {
    ko: "비가 오려고 해요.",
    en: "It's about to rain.",
    length: 3,
  },
  {
    ko: "이거 너무 좋아요.",
    en: "I love this.",
    length: 3,
  },
  {
    ko: "김 교수님을 만나시려면 지금 가셔야 돼요.",
    en: "You have to go now to see Professor Kim.",
    length: 6,
  },
  {
    ko: "사람이 많을수록 좋아요.",
    en: "The more people, the better.",
    length: 3,
  },
  {
    ko: "저를 친구로 생각해요?",
    en: "do you consider me a friend?",
    length: 3,
  },
  {
    ko: "이게 제일 좋대요.",
    en: "They say this is the best.",
    length: 3,
  },
  {
    ko: "그리고 컴퓨터를 꼭 끄고 퇴근하라고 하셨어요.",
    en: "And he told me to turn off my computer and go to work.",
    length: 6,
  },
  {
    ko: "컴퓨터 써도 돼요?",
    en: "Can I use a computer?",
    length: 3,
  },
  {
    ko: "인도 영화를 본 적이 있어요.",
    en: "I've seen Indian movies.",
    length: 5,
  },
  {
    ko: "그렇지만 지금은 안 피워요.",
    en: "But now I don't smoke.",
    length: 4,
  },
  {
    ko: "저 사람 너무 멋있어요!",
    en: "That person is so cool!",
    length: 4,
  },
  {
    ko: "저한테 어디 가냐고 말했어요.",
    en: "He told me where I was going.",
    length: 4,
  },
  {
    ko: "여행을 하다가 감기에 걸렸어요.",
    en: "I caught a cold while traveling.",
    length: 4,
  },
  {
    ko: "어디로 가시겠어요?",
    en: "Where would you like to go?",
    length: 2,
  },
  {
    ko: "오늘 만나는 거 알아요?",
    en: "Do you know we're meeting today?",
    length: 4,
  },
  {
    ko: "요즘 꽃이 비쌀까요?- 졸업식 때니까 비쌀 거예요.",
    en: "Are flowers going to be expensive these days?- Because it's the graduation ceremony, they'll be expensive.",
    length: 7,
  },
  {
    ko: "이제 나가도 좋습니다.",
    en: "You can go out now.",
    length: 3,
  },
  {
    ko: "추워서 목도리하고 장갑을 사야겠어요.",
    en: "It's cold, so I need to buy a scarf and gloves.",
    length: 4,
  },
  {
    ko: "그 사람은 지금도 서울에서 살 거예요.",
    en: "That person will still live in Seoul.",
    length: 6,
  },
  {
    ko: "청바지 입을 거예요.",
    en: "I will wear jeans.",
    length: 3,
  },
  {
    ko: "여기에 뭐라고 써야 돼요?",
    en: "What should I write here?",
    length: 4,
  },
  {
    ko: "비행기가 2시간 후에 출발해요.",
    en: "The plane leaves in 2 hours.",
    length: 4,
  },
  {
    ko: "이게 무슨 뜻인지 잘 모르겠어요.",
    en: "I'm not sure what this means.",
    length: 5,
  },
  {
    ko: "배 안 고파요?",
    en: "are you not hungry?",
    length: 3,
  },
  {
    ko: "1층 청소를 세 시간 만에 끝냈습니다.",
    en: "We finished cleaning the first floor in three hours.",
    length: 6,
  },
  {
    ko: "누구한테 물어볼까요?",
    en: "Who should I ask?",
    length: 2,
  },
  {
    ko: "그럼 언제 안 바빠요?",
    en: "So when are you not busy?",
    length: 4,
  },
  {
    ko: "몇 살 때 첫 데이트를 했어요?",
    en: "How old were you when you went on your first date?",
    length: 6,
  },
  {
    ko: "학생들이 앉아 있어요.",
    en: "The students are sitting.",
    length: 3,
  },
  {
    ko: "언제까지 여기에 있어야 돼요?",
    en: "How long do I have to stay here?",
    length: 4,
  },
  {
    ko: "효진 씨는 아직 모르나 봐요.",
    en: "Hyojin doesn't seem to know yet.",
    length: 5,
  },
  {
    ko: "여기 온 사람 중에서 누가 마음에 들어요?",
    en: "Of all the people here, who do you like?",
    length: 7,
  },
  {
    ko: "이 빵을 먹으면 안 돼요.",
    en: "You can't eat this bread.",
    length: 5,
  },
  {
    ko: "버스로 갈 거예요.",
    en: "I will go by bus.",
    length: 3,
  },
  {
    ko: "컴퓨터를 고치기도 해요.",
    en: "I also fix computers.",
    length: 3,
  },
  {
    ko: "금요일마다 태권도를 배워요.",
    en: "I learn Taekwondo every Friday.",
    length: 3,
  },
  {
    ko: "부디 씨는 정말 돈이 많군요.",
    en: "Mr. Budi has a lot of money.",
    length: 5,
  },
  {
    ko: "물이나 주스 주세요.",
    en: "Water or juice, please.",
    length: 3,
  },
  {
    ko: "우리 아들은 방 청소하기 싫어합니다.",
    en: "My son hates cleaning his room.",
    length: 5,
  },
  {
    ko: "내일 시험이 있어요.",
    en: "I have a test tomorrow.",
    length: 3,
  },
  {
    ko: "먹는다고 듣다.",
    en: "hear you eat",
    length: 2,
  },
  {
    ko: "10분 후에 출발합시다.",
    en: "Let's leave in 10 minutes.",
    length: 3,
  },
  {
    ko: "쉬운 책을 빌릴 거예요.",
    en: "I will borrow an easy book.",
    length: 4,
  },
  {
    ko: "현우 씨는 나쁜 사람이에요.",
    en: "Hyunwoo is a bad person.",
    length: 4,
  },
  {
    ko: "커피를 드릴까요, 주스를 드릴까요?",
    en: "Would you like coffee or juice?",
    length: 4,
  },
  {
    ko: "다시는 이런 일이 없도록 할게요.",
    en: "I will make sure this never happens again.",
    length: 5,
  },
  {
    ko: "두 달마다 머리를 잘라요.",
    en: "I cut my hair every two months.",
    length: 4,
  },
  {
    ko: "이 가수는 한국인들 사이에서 인기가 많아요.",
    en: "This singer is popular among Koreans.",
    length: 6,
  },
  {
    ko: "오늘 약속이 있어요.",
    en: "I have an appointment today.",
    length: 3,
  },
  {
    ko: "9월에는 한국에 가고 10월에는 일본에 갈 거예요.",
    en: "I will go to Korea in September and Japan in October.",
    length: 7,
  },
  {
    ko: "저분이 누구인지 모르겠어요.",
    en: "I don't know who that is.",
    length: 3,
  },
  {
    ko: "오늘부터 한국어를 더 열심히 공부할 거예요.",
    en: "I will study Korean harder from today.",
    length: 6,
  },
  {
    ko: "제일 예쁜 여자.",
    en: "the prettiest woman",
    length: 3,
  },
  {
    ko: "왕징 씨, 지금 시장에 같이 가요.",
    en: "Wang Jing, let's go to the market together.",
    length: 6,
  },
  {
    ko: "2001년에 결혼했어요.",
    en: "I got married in 2001.",
    length: 2,
  },
  {
    ko: "각자 먹은 만큼 내면 될 것 같아요.",
    en: "I think everyone should pay for what they ate.",
    length: 7,
  },
  {
    ko: "이 약은 한 번에 두 알씩 드세요.",
    en: "Take two tablets at a time.",
    length: 7,
  },
  {
    ko: "제일 먼저 온 사람이 누구예요?",
    en: "Who came first?",
    length: 5,
  },
  {
    ko: "텔레비전을 보다가 잠이 들었어요.",
    en: "I fell asleep while watching TV.",
    length: 4,
  },
  {
    ko: "집이 멀어서 학교에 오기가 힘들어요.",
    en: "It's hard to come to school because my house is far away.",
    length: 5,
  },
  {
    ko: "방 청소를 하다가 바닥에서 돈을 주웠어요.",
    en: "I picked up money from the floor while cleaning my room.",
    length: 6,
  },
  {
    ko: "이거 한 다음에 뭐 할 거예요?",
    en: "What are you going to do after this?",
    length: 6,
  },
  {
    ko: "오늘 오후에 뭐 해요?",
    en: "what are you doing this afternoon?",
    length: 4,
  },
  {
    ko: "다 안 마셨어요.",
    en: "I didn't drink it all.",
    length: 3,
  },
  {
    ko: "그거 누가 만들었어요?",
    en: "who made that?",
    length: 3,
  },
  {
    ko: "제 동생은 학생인데 공부를 아주 잘해요.",
    en: "My younger brother is a student and he is very good at his studies.",
    length: 6,
  },
  {
    ko: "당신 목소리를 들으려고 전화했어요.",
    en: "I'm calling to hear your voice.",
    length: 4,
  },
  {
    ko: "공원에 가서 책을 읽을 거예요.",
    en: "I will go to the park and read a book.",
    length: 5,
  },
  {
    ko: "그 얘기는 귀가 아프도록 많이 들었어요.",
    en: "I heard that story so many times that my ears hurt.",
    length: 6,
  },
  {
    ko: "커피에 설탕과 크림 다 넣으세요?",
    en: "Do you put sugar and cream in your coffee?",
    length: 5,
  },
  {
    ko: "저도 들어가겠네요.",
    en: "I can go in too.",
    length: 2,
  },
  {
    ko: "작년에는 담배를 피웠었어요.",
    en: "I smoked last year.",
    length: 3,
  },
  {
    ko: "공항에 가는 길에 은행에 들러서 환전했어요.",
    en: "On the way to the airport, I stopped at a bank to change money.",
    length: 6,
  },
  {
    ko: "여기는 버스 타기가 불편해요.",
    en: "It is inconvenient to take a bus here.",
    length: 4,
  },
  {
    ko: "네, 손님, 금방 치워 드릴게요.",
    en: "Yes, sir, I'll clean it up right away.",
    length: 5,
  },
  {
    ko: "오늘은 더 더워요.",
    en: "It's hotter today.",
    length: 3,
  },
  {
    ko: "왜 공부밖에 안 해요?",
    en: "Why are you only studying?",
    length: 4,
  },
  {
    ko: "경치가 아름다울 뿐만 아니라 바다도 깨끗해요.",
    en: "Not only the scenery is beautiful, but the sea is also clear.",
    length: 6,
  },
  {
    ko: "다시 학교에 다니게 됐어요.",
    en: "I went back to school.",
    length: 4,
  },
  {
    ko: "집에 늦게 들어올 때는 전화라도 하라고 하세요.",
    en: "If you come home late, ask her to call you at least.",
    length: 7,
  },
  {
    ko: "질문 있습니까?",
    en: "Are there any questions?",
    length: 2,
  },
  {
    ko: "오늘은 수업이 끝난 후에 공항에 가야 해요.",
    en: "I have to go to the airport after class today.",
    length: 7,
  },
  {
    ko: "지금 2시 50분이에요.",
    en: "It's 2:50 now.",
    length: 3,
  },
  {
    ko: "뭘 기다리고 있어요?",
    en: "What are you waiting for?",
    length: 3,
  },
  {
    ko: "내일 갈 거예요.",
    en: "i will go tomorrow",
    length: 3,
  },
  {
    ko: "댄 씨가 지금 음악을 듣고 있어요.",
    en: "Dan is listening to music now.",
    length: 6,
  },
  {
    ko: "친구가 울려고 해요.",
    en: "My friend is about to cry.",
    length: 3,
  },
  {
    ko: "가지 않습니다.",
    en: "won't go",
    length: 2,
  },
  {
    ko: "입학 서류를 준비하느라고 정신이 없어요.",
    en: "I'm busy preparing the admission documents.",
    length: 5,
  },
  {
    ko: "조금만 주세요.",
    en: "please give me a little",
    length: 2,
  },
  {
    ko: "할아버지, 건강하세요.",
    en: "Grandpa, how are you?",
    length: 2,
  },
  {
    ko: "다 들리도록 이야기해 주세요.",
    en: "Please speak so that everyone can be heard.",
    length: 4,
  },
  {
    ko: "아이 때문에 피곤해요.",
    en: "I am tired because of my child.",
    length: 3,
  },
  {
    ko: "사람이 많을 줄 알았어요.",
    en: "I thought there would be a lot of people.",
    length: 4,
  },
  {
    ko: "전화 온다고 했어요.",
    en: "He said he was calling.",
    length: 3,
  },
  {
    ko: "한 달 전부터 아침에 운동을 하기 시작했습니다.",
    en: "I started exercising in the morning about a month ago.",
    length: 7,
  },
  {
    ko: "저는 차가 없어요.",
    en: "I don't have a car.",
    length: 3,
  },
  {
    ko: "사랑해요, 캐럴 씨.",
    en: "I love you, Mr. Carol.",
    length: 3,
  },
  {
    ko: "저 학생 아니에요.",
    en: "I'm not that student.",
    length: 3,
  },
  {
    ko: "옛날에는 멀었는데 이사해서 가까워졌어요.",
    en: "We used to be far apart in the past, but we moved closer.",
    length: 4,
  },
  {
    ko: "한식을 먹읍시다.",
    en: "Let's eat Korean food.",
    length: 2,
  },
  {
    ko: "왜 여행 가방을 쌌다가 다시 풀어요?",
    en: "Why pack your suitcase and unpack it again?",
    length: 6,
  },
  {
    ko: "눈 때문에 길이 미끄러워요.",
    en: "The road is slippery because of the snow.",
    length: 4,
  },
  {
    ko: "어제 4시간 동안 공부했어요.",
    en: "I studied for 4 hours yesterday.",
    length: 4,
  },
  {
    ko: "월요일하고 목요일에 학교에 가요.",
    en: "I go to school on Monday and Thursday.",
    length: 4,
  },
  {
    ko: "어제 거기에 사람이 많이 왔을 것 같아요.",
    en: "I think there must have been a lot of people there yesterday.",
    length: 7,
  },
  {
    ko: "그리고 태권도도 배워요.",
    en: "And I also learn Taekwondo.",
    length: 3,
  },
  {
    ko: "고향까지 일주일 정도 걸리니까 벌써 도착했을걸요.",
    en: "It takes about a week to go home, so you must have arrived already.",
    length: 6,
  },
  {
    ko: "추운데 창문을 닫을까요?",
    en: "It's cold, should I close the window?",
    length: 3,
  },
  {
    ko: "우리 딸은 학교에서만 공부하고 집에서는 공부하지 않아요.",
    en: "My daughter only studies at school and not at home.",
    length: 7,
  },
  {
    ko: "우리가 이야기하는 동안 아이가 물을 쏟은 모양이에요.",
    en: "It looks like the child spilled water while we were talking.",
    length: 7,
  },
  {
    ko: "네 명씩 모이세요.",
    en: "Gather in groups of four.",
    length: 3,
  },
  {
    ko: "이건 아주 좋은 컴퓨터군요.",
    en: "This is a very nice computer.",
    length: 4,
  },
  {
    ko: "그때 웨슬리 씨는 자고 있었어요.",
    en: "Mr. Wesley was sleeping at the time.",
    length: 5,
  },
  {
    ko: "저는 대학생이 아니라고 말했어요.",
    en: "I said I'm not a college student.",
    length: 4,
  },
  {
    ko: "미용실에 머리 자르러 가요.",
    en: "I go to the hairdresser to get my hair cut.",
    length: 4,
  },
  {
    ko: "저 내일 안 올 수도 있어요.",
    en: "I may not come tomorrow.",
    length: 6,
  },
  {
    ko: "이치로 씨는 한국의 명절에 대해서 알아요?",
    en: "Ichiro, do you know about Korean holidays?",
    length: 6,
  },
  {
    ko: "저 포스터를 보세요.",
    en: "look at that poster",
    length: 3,
  },
  {
    ko: "벌써 사랑이 식어 가나요?",
    en: "Is your love already cold?",
    length: 4,
  },
  {
    ko: "담배를 피우는 것은 정말 학생답지 않은 행동이다.",
    en: "Smoking is really unstudent behavior.",
    length: 7,
  },
  {
    ko: "이 시간에는 보통 운동을 하니까 집에 없을걸요.",
    en: "I usually work out at this time, so I probably won't be at home.",
    length: 7,
  },
  {
    ko: "얼굴이 많이 까매졌네요.",
    en: "My face is very dark.",
    length: 3,
  },
  {
    ko: "안으로 들어가는 거 어때요?",
    en: "How about going inside?",
    length: 4,
  },
  {
    ko: "기차가 빨라요.",
    en: "The train is fast.",
    length: 2,
  },
  {
    ko: "퇴근 후에 술 한잔할까요?",
    en: "Shall we have a drink after work?",
    length: 4,
  },
  {
    ko: "생일이 며칠이에요?",
    en: "when is your birthday?",
    length: 2,
  },
  {
    ko: "내일이 일요일일 리가 없어요.",
    en: "Tomorrow can't be Sunday.",
    length: 4,
  },
  {
    ko: "일주일에 몇 번?",
    en: "how many times a week?",
    length: 3,
  },
  {
    ko: "한국에 왔어요.",
    en: "I came to Korea.",
    length: 2,
  },
  {
    ko: "그거 고양이 아니에요.",
    en: "that's not a cat",
    length: 3,
  },
  {
    ko: "시원한 커피 마시고 싶어요.",
    en: "I want to drink cold coffee.",
    length: 4,
  },
  {
    ko: "아이스크림이 녹으려고 해요.",
    en: "The ice cream is about to melt.",
    length: 3,
  },
  {
    ko: "세일 중이라 사람이 많을 텐데 다음에 가요.",
    en: "It's on sale, so there must be a lot of people. I'll go next time.",
    length: 7,
  },
  {
    ko: "가족과 함께 여행을 가고 싶어요.",
    en: "I want to go on a trip with my family.",
    length: 5,
  },
  {
    ko: "풍선이 커졌어요.",
    en: "The balloon got bigger.",
    length: 2,
  },
  {
    ko: "하영 씨는 많이 먹지만 날씬해요.",
    en: "Hayoung eats a lot, but she is thin.",
    length: 5,
  },
  {
    ko: "도착하는 대로 전화해 주세요.",
    en: "Please call us as soon as you arrive.",
    length: 4,
  },
  {
    ko: "3월 2일에 한국에 왔어요.",
    en: "I came to Korea on March 2nd.",
    length: 4,
  },
  {
    ko: "한국 사람이라고 했어요.",
    en: "He said he was Korean.",
    length: 3,
  },
  {
    ko: "책상 위에 컴퓨터가 있어요.",
    en: "There is a computer on the desk.",
    length: 4,
  },
  {
    ko: "언제 결혼하셨어요?",
    en: "When did you get married?",
    length: 2,
  },
  {
    ko: "감기에 걸렸군요.",
    en: "You have a cold.",
    length: 2,
  },
  {
    ko: "이 신발은 다 떨어지도록 자주 신었어요.",
    en: "I wore these shoes often until they ran out.",
    length: 6,
  },
  {
    ko: "선생님이 서 있어요.",
    en: "the teacher is standing",
    length: 3,
  },
  {
    ko: "우산이 없는데 어떻게 하죠?",
    en: "What if I don't have an umbrella?",
    length: 4,
  },
  {
    ko: "일본어 할 수 있어요?",
    en: "can you speak japanese?",
    length: 4,
  },
  {
    ko: "좀 쉬었으면 좋겠어요.",
    en: "I wish I could get some rest.",
    length: 3,
  },
  {
    ko: "한국에서는 식사 때 수저를 사용합니다.",
    en: "In Korea, spoons are used when eating.",
    length: 5,
  },
  {
    ko: "아무렇게나 해도 돼요.",
    en: "You can do anything.",
    length: 3,
  },
  {
    ko: "같이 공부합시다.",
    en: "Let's study together.",
    length: 2,
  },
  {
    ko: "집에 있기에는 날씨가 너무 좋아.",
    en: "The weather is too nice to stay at home.",
    length: 5,
  },
  {
    ko: "회사를 위해서 열심히 일해 주십시오.",
    en: "Please work hard for the company.",
    length: 5,
  },
  {
    ko: "이거 나중에 해도 돼요?",
    en: "can i do this later?",
    length: 4,
  },
  {
    ko: "돈을 잃을 뻔 했어요.",
    en: "I almost lost money.",
    length: 4,
  },
  {
    ko: "수업이 끝나고 나서 우리는 집에 갔습니다.",
    en: "After class, we went home.",
    length: 6,
  },
  {
    ko: "간다고 말하다.",
    en: "say go",
    length: 2,
  },
  {
    ko: "7시니까 댄 씨는 벌써 퇴근했을 거예요.",
    en: "It's 7 o'clock, so Dan must have already left work.",
    length: 6,
  },
  {
    ko: "한국에 언제 오셨어요?",
    en: "When did you come to Korea?",
    length: 3,
  },
  {
    ko: "지금 못 만나요.",
    en: "I can't meet you now.",
    length: 3,
  },
  {
    ko: "무슨 책을 읽어요?",
    en: "what book do you read?",
    length: 3,
  },
  {
    ko: "그 사람이 이거 뭐라고 했어요?",
    en: "What did he say about this?",
    length: 5,
  },
  {
    ko: "우리는 서로 사랑했기 때문에 결혼했습니다.",
    en: "We got married because we loved each other.",
    length: 5,
  },
  {
    ko: "저는 딸기와 수박을 좋아해요.",
    en: "I like strawberries and watermelon.",
    length: 4,
  },
  {
    ko: "한국에 올 때마다 한국 음식을 먹어요.",
    en: "Every time I come to Korea, I eat Korean food.",
    length: 6,
  },
  {
    ko: "아침에 일어나서 세수해요.",
    en: "I wake up in the morning and wash my face.",
    length: 3,
  },
  {
    ko: "맛있는 음식을 먹었어요.",
    en: "I ate delicious food.",
    length: 3,
  },
  {
    ko: "여행을 가거나 외식을 할 거예요.",
    en: "I will go on a trip or eat out.",
    length: 5,
  },
  {
    ko: "고추장을 많이 넣으면 매울 테니까 조금만 넣으세요.",
    en: "If you add a lot of red pepper paste, it will be spicy, so add a little bit.",
    length: 7,
  },
  {
    ko: "수업 시간에는 영어로 말하면 안 돼요.",
    en: "You cannot speak English in class.",
    length: 6,
  },
  {
    ko: "야구 구경하러 가요.",
    en: "I'm going to watch baseball.",
    length: 3,
  },
  {
    ko: "고향에 갔다 오셨다면서요?",
    en: "I heard you went to your hometown?",
    length: 3,
  },
  {
    ko: "작년 생일에 친구들하고 같이 갔던 스키장이에요.",
    en: "This is the ski resort I went to with my friends for my birthday last year.",
    length: 6,
  },
  {
    ko: "길이 막히는 바람에 늦었어요.",
    en: "I was late because the road was blocked.",
    length: 4,
  },
  {
    ko: "401번 버스는 이태원까지 어디로 해서 갑니까?",
    en: "Where does the 401 bus go to Itaewon?",
    length: 6,
  },
  {
    ko: "어차피 해야 되는 거니까 재미있게 해요.",
    en: "I have fun doing it because I have to do it anyway.",
    length: 6,
  },
  {
    ko: "요즘은 방학이라(서) 한가해요.",
    en: "I'm free these days because it's vacation.",
    length: 3,
  },
  {
    ko: "음악을 좋아해요?",
    en: "do you like music?",
    length: 2,
  },
  {
    ko: "분실했을 때 바로 정지시켰어야지요.",
    en: "You should have stopped right away when you lost it.",
    length: 4,
  },
  {
    ko: "두 병에 천오백 원이에요.",
    en: "It costs 1,500 won for two bottles.",
    length: 4,
  },
  {
    ko: "어제보다 일찍 갈 거예요.",
    en: "I will go earlier than yesterday.",
    length: 4,
  },
  {
    ko: "이거라고 했어요.",
    en: "I said this.",
    length: 2,
  },
  {
    ko: "오후에는 날씨가 꽤 더울 텐데요.",
    en: "The weather will be quite hot in the afternoon.",
    length: 5,
  },
  {
    ko: "아버지는 라디오를 들으신다.",
    en: "Dad listens to the radio.",
    length: 3,
  },
  {
    ko: "바나나를 까서 먹었어요.",
    en: "I peeled and ate a banana.",
    length: 3,
  },
  {
    ko: "비빔밥 네 그릇 주세요.",
    en: "Four bowls of bibimbap, please.",
    length: 4,
  },
  {
    ko: "오늘은 술을 마시지 못해요.",
    en: "I can't drink today.",
    length: 4,
  },
  {
    ko: "어제는 따뜻했어요.",
    en: "It was warm yesterday.",
    length: 2,
  },
  {
    ko: "길이 막히면 늦을까 봐서 좀 일찍 나가요.",
    en: "If the road is blocked, I will be late, so I leave early.",
    length: 7,
  },
  {
    ko: "뭔가 찾았어요?",
    en: "did you find something?",
    length: 2,
  },
  {
    ko: "오늘은 어제보다 더워요.",
    en: "Today is hotter than yesterday.",
    length: 3,
  },
  {
    ko: "가족하고 여행을 가려나 봐요.",
    en: "I guess I'm going on a trip with my family.",
    length: 4,
  },
  {
    ko: "우유 말고 커피 주세요.",
    en: "Coffee, not milk, please.",
    length: 4,
  },
  {
    ko: "언니가 날씬해졌어요.",
    en: "My sister has become slim.",
    length: 2,
  },
  {
    ko: "아침에 언제 일어나요?",
    en: "When do you wake up in the morning?",
    length: 3,
  },
  {
    ko: "방이 안 넓어요.",
    en: "The room is not spacious.",
    length: 3,
  },
  {
    ko: "아마 제 친구가 다른 이름으로 예약한 모양입니다.",
    en: "Maybe my friend booked under a different name.",
    length: 7,
  },
  {
    ko: "저는 유학 온 게 아니라 일하러 왔어요.",
    en: "I didn't come to study, I came to work.",
    length: 7,
  },
  {
    ko: "얼굴이 예쁜 만큼 마음씨도 고와요.",
    en: "As much as the face is pretty, the heart is also kind.",
    length: 5,
  },
  {
    ko: "내일 시간이 있으면 같이 커피 마실래요?",
    en: "If you have time tomorrow, would you like to have coffee together?",
    length: 6,
  },
  {
    ko: "지금부터 우리 반 친구들에 대해서 소개하려고 합니다.",
    en: "From now on, I would like to introduce you to our classmates.",
    length: 7,
  },
  {
    ko: "오늘 눈이 안 올 줄 알았어요.",
    en: "I thought it wouldn't snow today.",
    length: 6,
  },
  {
    ko: "제주도하고 서울하고 어디가 더 따뜻해요?",
    en: "Jeju Island or Seoul, which is warmer?",
    length: 5,
  },
  {
    ko: "저는 커피를 안 마셔요.",
    en: "I don't drink coffee.",
    length: 4,
  },
  {
    ko: "지금 집에 가는 중이에요.",
    en: "I'm on my way home now.",
    length: 4,
  },
  {
    ko: "이건 재미없군요.",
    en: "This is no fun.",
    length: 2,
  },
  {
    ko: "이 사람 밥 먹다가 어디 갔어요?",
    en: "Where did this guy go to eat?",
    length: 6,
  },
  {
    ko: "그 학생은 추천할 만합니다.",
    en: "The student is commendable.",
    length: 4,
  },
  {
    ko: "학생이 많은가 봐요.",
    en: "I guess there are a lot of students.",
    length: 3,
  },
  {
    ko: "어떨 때 제일 힘들어요?",
    en: "When is it the hardest?",
    length: 4,
  },
  {
    ko: "운동하느라고 전화 온 줄 몰랐어요.",
    en: "I didn't know you were calling because you were working out.",
    length: 5,
  },
  {
    ko: "우리 아이는 하루 종일 게임만 해요.",
    en: "My child plays games all day.",
    length: 6,
  },
  {
    ko: "벌써 다 말해 버렸어요.",
    en: "I already told you everything.",
    length: 4,
  },
  {
    ko: "아침부터 저녁까지.",
    en: "from morning to evening.",
    length: 2,
  },
  {
    ko: "왼손에 반지를 끼었으니까 결혼했을 거예요.",
    en: "I must have been married because I wore a ring on my left hand.",
    length: 5,
  },
  {
    ko: "기타 좀 쳐 보세요.",
    en: "play some guitar",
    length: 4,
  },
  {
    ko: "눈이 오는 것 같아요.",
    en: "I think it's snowing.",
    length: 4,
  },
  {
    ko: "어머니 생신이라서 고향에 가야 돼요.",
    en: "It's my mother's birthday, so I have to go to my hometown.",
    length: 5,
  },
  {
    ko: "빨리 걸으세요.",
    en: "Walk fast.",
    length: 2,
  },
  {
    ko: "제 아이디어에 대해서 어떻게 생각하세요?",
    en: "What do you think of my idea?",
    length: 5,
  },
  {
    ko: "한국에서는 결혼하기 전에 남자가 집을 준비해요.",
    en: "In Korea, a man prepares a house before getting married.",
    length: 6,
  },
  {
    ko: "시장에 사람이 많아서 복잡해요.",
    en: "It's complicated because there are so many people in the market.",
    length: 4,
  },
  {
    ko: "아무것도 몰라요.",
    en: "I don't know anything.",
    length: 2,
  },
  {
    ko: "저는 영어를 가르치기도 해요.",
    en: "I also teach English.",
    length: 4,
  },
  {
    ko: "긴 치마를 주세요.",
    en: "Please give me a long skirt.",
    length: 3,
  },
  {
    ko: "오늘이 수요일이지요?",
    en: "Is today Wednesday?",
    length: 2,
  },
  {
    ko: "딸기잼을 만들 줄 알아요.",
    en: "I know how to make strawberry jam.",
    length: 4,
  },
  {
    ko: "어제 말했잖아요.",
    en: "You said it yesterday.",
    length: 2,
  },
  {
    ko: "네, 그래서 음악을 들으면서 공부를 해요.",
    en: "Yes, that's why I study while listening to music.",
    length: 6,
  },
  {
    ko: "이야기한 것 같아요.",
    en: "i think i talked",
    length: 3,
  },
  {
    ko: "선물을 한 개밖에 못 받았어요.",
    en: "I only received one gift.",
    length: 5,
  },
  {
    ko: "오늘 뉴스에서 봤는데 그거 진짜예요?",
    en: "I saw it on the news today, is that real?",
    length: 5,
  },
  {
    ko: "김치를 많이 먹어요.",
    en: "I eat a lot of kimchi.",
    length: 3,
  },
  {
    ko: "걱정하지 마세요.",
    en: "Do not worry.",
    length: 2,
  },
  {
    ko: "이렇게 하는 게 어때요?",
    en: "How about doing this?",
    length: 4,
  },
  {
    ko: "지난 주에 제주도에 갔거든요.",
    en: "I went to Jeju Island last week.",
    length: 4,
  },
  {
    ko: "두 개를 이었어요.",
    en: "I got two.",
    length: 3,
  },
  {
    ko: "그런 것 같아요.",
    en: "I think so.",
    length: 3,
  },
  {
    ko: "더울 때 사용해요.",
    en: "Use it when it's hot.",
    length: 3,
  },
  {
    ko: "어제와 같아요.",
    en: "It's like yesterday.",
    length: 2,
  },
  {
    ko: "아직도 더 많이 배워야 해요.",
    en: "I still have a lot to learn.",
    length: 5,
  },
  {
    ko: "그냥 기운만 조금 없을 뿐입니다.",
    en: "There is just little energy.",
    length: 5,
  },
  {
    ko: "제가 왜 걱정하는지 몰라요?",
    en: "Don't you know why I'm worried?",
    length: 4,
  },
  {
    ko: "무엇을 사용하지 말라고요?",
    en: "What not to use?",
    length: 3,
  },
  {
    ko: "비가 오다가 조금 전에 그쳤어요.",
    en: "It stopped raining a little while ago.",
    length: 5,
  },
  {
    ko: "그러면 김밥도 좋아해요?",
    en: "Then, do you like gimbap too?",
    length: 3,
  },
  {
    ko: '가끔 배가 출출할 때 "라면이나 먹을까?"라고 하죠?',
    en: 'Sometimes when you\'re hungry, you say, "Shall we eat ramen?"',
    length: 7,
  },
  {
    ko: "아니요, 안 와요.",
    en: "no, i'm not coming",
    length: 3,
  },
  {
    ko: "돈이 많았으면 좋겠어요.",
    en: "I wish I had a lot of money.",
    length: 3,
  },
  {
    ko: "교실에서 음악을 들으면 안 돼요.",
    en: "You can't listen to music in the classroom.",
    length: 5,
  },
  {
    ko: "지하철에서 내리고 보니 가방이 없더라고요.",
    en: "When I got off the subway, my bag was gone.",
    length: 5,
  },
  {
    ko: "생일 선물로 카메라 어때요?",
    en: "How about a camera for a birthday present?",
    length: 4,
  },
  {
    ko: "뉴스를 들어도 이해하지 못해요.",
    en: "Even when I hear the news, I don't understand.",
    length: 4,
  },
  {
    ko: "옷장은 어디에 있어요?",
    en: "where is the closet?",
    length: 3,
  },
  {
    ko: "일하고 있었어요.",
    en: "I was working.",
    length: 2,
  },
  {
    ko: "집에서 공부하다가 나왔어요.",
    en: "I came out while studying at home.",
    length: 3,
  },
  {
    ko: "한국인 친구가 한 명밖에 없어요.",
    en: "I only have one Korean friend.",
    length: 5,
  },
  {
    ko: "이거는 어때요?",
    en: "How about this one?",
    length: 2,
  },
  {
    ko: "우산이 가방 안에 있어요.",
    en: "The umbrella is in the bag.",
    length: 4,
  },
  {
    ko: "남자 친구랑 헤어졌다면서요?",
    en: "You said you broke up with your boyfriend?",
    length: 3,
  },
  {
    ko: "이거랑 이거랑 같아요?",
    en: "Is this the same as this one?",
    length: 3,
  },
  {
    ko: "집에 안 가요.",
    en: "I'm not going home.",
    length: 3,
  },
  {
    ko: "경기를 하다가 넘어지는 바람에 금메달을 못 닸어요.",
    en: "I fell down during the game, so I couldn't win the gold medal.",
    length: 7,
  },
  {
    ko: "한국에 가서 뭐 할 거예요?",
    en: "What are you going to do in Korea?",
    length: 5,
  },
  {
    ko: "10시 정각에 만나요.",
    en: "See you at 10 o'clock sharp.",
    length: 3,
  },
  {
    ko: "내일 일요일인데 뭐 할 거예요?",
    en: "It's Sunday tomorrow, what are you going to do?",
    length: 5,
  },
  {
    ko: "여기에서 사진을 찍으면 안 돼요.",
    en: "You are not allowed to take pictures here.",
    length: 5,
  },
  {
    ko: "지금 배달 돼요?",
    en: "Can you deliver now?",
    length: 3,
  },
  {
    ko: "사기 전에 잘 생각하세요.",
    en: "Think carefully before buying.",
    length: 4,
  },
  {
    ko: "경찰처럼 보이는 사람이 그 여자를 데려갔어요.",
    en: "Someone who looked like the police took the woman away.",
    length: 6,
  },
  {
    ko: "2004년 2월에 대학교를 졸업했어요.",
    en: "I graduated from university in February 2004.",
    length: 4,
  },
  {
    ko: "저는 한국에 가기 위해서 열심히 공부했어요.",
    en: "I studied hard to go to Korea.",
    length: 6,
  },
  {
    ko: "사려고 하는 사람.",
    en: "who wants to buy.",
    length: 3,
  },
  {
    ko: "경은 씨는 천사 같아요.",
    en: "Kyeong-eun is like an angel.",
    length: 4,
  },
  {
    ko: "책이 얼마예요?",
    en: "how much is the book",
    length: 2,
  },
  {
    ko: "제가 하는 대로 하세요.",
    en: "Do what I do.",
    length: 4,
  },
  {
    ko: "며칠 야근을 했더니 몸살이 났어요.",
    en: "After working overtime for a few days, I got sick.",
    length: 5,
  },
  {
    ko: "이것은 웨슬리의 책이에요.",
    en: "This is Wesley's book.",
    length: 3,
  },
  {
    ko: "11시 12분이에요.",
    en: "It's 11:12.",
    length: 2,
  },
  {
    ko: "정말 이상해요.",
    en: "It's really weird.",
    length: 2,
  },
  {
    ko: "싫은 사람이 있으면 저는 돌아 가요.",
    en: "If there are people I don't like, I go back.",
    length: 6,
  },
  {
    ko: "오늘 비가 올 거라고 했어요.",
    en: "They said it would rain today.",
    length: 5,
  },
  {
    ko: "몇 시에 집에서 출발할 건가요?",
    en: "What time are you leaving home?",
    length: 5,
  },
  {
    ko: "된장찌개를 맛있게 끓일 줄 알아요.",
    en: "I know how to cook delicious soybean paste stew.",
    length: 5,
  },
  {
    ko: "배 고픈 사람 있어요?",
    en: "Is anyone hungry?",
    length: 4,
  },
  {
    ko: "준호만 대학에 입학했어요.",
    en: "Only Junho entered college.",
    length: 3,
  },
  {
    ko: "공부하고 있어요.",
    en: "studying.",
    length: 2,
  },
  {
    ko: "본다고 말했어요?",
    en: "did you say see?",
    length: 2,
  },
  {
    ko: "어제 했을까요?",
    en: "did it yesterday?",
    length: 2,
  },
  {
    ko: "금연석에 앉으시겠습니까, 흡연석에 앉으시겠습니까?",
    en: "Would you like to sit in a non-smoking seat or a smoking seat?",
    length: 4,
  },
  {
    ko: "건강해야 무슨 일이든지 할 수 있지.",
    en: "You can do anything as long as you are healthy.",
    length: 6,
  },
  {
    ko: "서울에서 도쿄까지보다 서울에서 뉴욕까지가 훨씬 더 멀어요.",
    en: "It is much farther from Seoul to New York than from Seoul to Tokyo.",
    length: 7,
  },
  {
    ko: "꼭 가 보도록 하세요.",
    en: "Be sure to visit.",
    length: 4,
  },
  {
    ko: "남산에서 본 서울 야경이 아주 아름답던데요.",
    en: "The night view of Seoul from Namsan was very beautiful.",
    length: 6,
  },
  {
    ko: "어제 많이 바빴어요?",
    en: "Were you very busy yesterday?",
    length: 3,
  },
  {
    ko: "휴대전화로 사진을 보낼 줄 알아요.",
    en: "I know how to send pictures on my cell phone.",
    length: 5,
  },
  {
    ko: "사과가 의자 아래에 있어요.",
    en: "The apple is under the chair.",
    length: 4,
  },
  {
    ko: "어디에서 삽니까?",
    en: "Where do you live?",
    length: 2,
  },
  {
    ko: "아이들이 졸린가 봐요.",
    en: "The children must be sleepy.",
    length: 3,
  },
  {
    ko: "고기를 냉장고에 안 넣어 놓고 나왔다고요?",
    en: "Did you leave the meat out of the fridge?",
    length: 6,
  },
  {
    ko: "내년 6월에 돌아갈 거예요.",
    en: "I will be back in June next year.",
    length: 4,
  },
  {
    ko: "그런데 사실 월요일에 비해서 화요일이나 목요일이 좋아요.",
    en: "But actually, I like Tuesday or Thursday better than Monday.",
    length: 7,
  },
  {
    ko: "그런데 정말 커요.",
    en: "But it's really big.",
    length: 3,
  },
  {
    ko: "왜 안 왔어요?",
    en: "why didn't you come?",
    length: 3,
  },
  {
    ko: "어떻게 해요?",
    en: "how to do?",
    length: 2,
  },
  {
    ko: "작은 차를 살래요.",
    en: "I want to buy a small car",
    length: 3,
  },
  {
    ko: "그렇지만 야구는 좋아하지 않아요.",
    en: "But I don't like baseball.",
    length: 4,
  },
  {
    ko: "맥주를 열 병이나 마셨어요.",
    en: "I drank ten bottles of beer.",
    length: 4,
  },
  {
    ko: "샐리 씨가 집에 없어요.",
    en: "Sally is not at home.",
    length: 4,
  },
  {
    ko: "이제부터는 제가 혼자서 하면 돼요.",
    en: "From now on, I can do it alone.",
    length: 5,
  },
  {
    ko: "그 식당은 월요일만 쉬어요.",
    en: "The restaurant is closed only on Mondays.",
    length: 4,
  },
  {
    ko: "바쁠수록 건강이 중요해요.",
    en: "The busier you are, the more important your health is.",
    length: 3,
  },
  {
    ko: "지하철 공사하는 중입니다.",
    en: "The subway is under construction.",
    length: 3,
  },
  {
    ko: "저분이 사장님이시라니요?",
    en: "Are you the boss?",
    length: 2,
  },
  {
    ko: "착하고 예쁜 여자를 좋아해요.",
    en: "I like nice and pretty girls.",
    length: 4,
  },
  {
    ko: "민수는 신문을 읽는다.",
    en: "Minsu reads the newspaper.",
    length: 3,
  },
  {
    ko: "돈을 내기 전에.",
    en: "before paying.",
    length: 3,
  },
  {
    ko: "아직까지 거기에 있을 리가 없지요.",
    en: "It can't be there yet.",
    length: 5,
  },
  {
    ko: "우리 아무리 바빠도 안부는 전하며 살자.",
    en: "No matter how busy we are, let's say hello and live.",
    length: 6,
  },
  {
    ko: "수업이 끝난 다음에 식당에서 아르바이트를 해요.",
    en: "I work part-time at a restaurant after class.",
    length: 6,
  },
  {
    ko: "민우 씨는 직업이 뭐예요?",
    en: "What is Minwoo's job?",
    length: 4,
  },
  {
    ko: "시장보다 백화점이 더 비싸요.",
    en: "Department stores are more expensive than markets.",
    length: 4,
  },
  {
    ko: "영어를 잘해야 맡을 수 있어요.",
    en: "You have to be good at English to be able to take charge.",
    length: 5,
  },
  {
    ko: "이게 좋겠어요.",
    en: "I like this.",
    length: 2,
  },
  {
    ko: "그래서 안 사요.",
    en: "so i don't buy it",
    length: 3,
  },
  {
    ko: "그리고 기능이 너무 많아서 그런지 좀 불편해요.",
    en: "And it's a bit inconvenient because there are so many functions.",
    length: 7,
  },
  {
    ko: "한국말을 잘 못해요.",
    en: "I can't speak Korean well.",
    length: 3,
  },
  {
    ko: "중국에서 생활하기에 어렵지는 않지요?",
    en: "Isn't it difficult to live in China?",
    length: 4,
  },
  {
    ko: "주말에 음악을 듣거나 영화를 볼 거예요.",
    en: "I will listen to music or watch a movie on the weekend.",
    length: 6,
  },
  {
    ko: "코미디언같이 재미있어요.",
    en: "It's funny like a comedian.",
    length: 2,
  },
  {
    ko: "지금 사지 말고 조금만 기다리세요.",
    en: "Don't buy now, just wait a bit.",
    length: 5,
  },
  {
    ko: "문제를 잘 듣고 나서 대답을 찾으세요.",
    en: "Listen carefully to the problem and then find the answer.",
    length: 6,
  },
  {
    ko: "지금 만드는 음식은 불고기예요.",
    en: "The food I'm making now is Bulgogi.",
    length: 4,
  },
  {
    ko: "여동생은 스무 살이에요.",
    en: "My younger sister is 20 years old.",
    length: 3,
  },
  {
    ko: "내일 4시쯤에 갈게요.",
    en: "I'll be there around 4 o'clock tomorrow.",
    length: 3,
  },
  {
    ko: "길이 막힐 테니까 집에서 일찍 출발하세요.",
    en: "The road will be blocked, so leave early from home.",
    length: 6,
  },
  {
    ko: "눈이 좀 아파서 그랬어요.",
    en: "It was because my eyes hurt a little.",
    length: 4,
  },
  {
    ko: "바람이 불지만 춥지는 않아요.",
    en: "It is windy but not cold.",
    length: 4,
  },
  {
    ko: "내년에 한국에 가기로 했습니다.",
    en: "I decided to go to Korea next year.",
    length: 4,
  },
  {
    ko: "네, 학교에 갑니다.",
    en: "yes i go to school",
    length: 3,
  },
  {
    ko: "내일 해도 돼요.",
    en: "You can do it tomorrow.",
    length: 3,
  },
  {
    ko: "이거 뭐로 만들었어요?",
    en: "what is this made of?",
    length: 3,
  },
  {
    ko: "제 취미는 요리하기예요.",
    en: "My hobby is cooking.",
    length: 3,
  },
  {
    ko: "선생님, 남산도서관 전화번호가 몇 번이에요?",
    en: "Sir, what is the phone number of Namsan Library?",
    length: 5,
  },
  {
    ko: "아직 여기 있어요?",
    en: "are you still here?",
    length: 3,
  },
  {
    ko: "별로 안 춥네요.",
    en: "It's not very cold.",
    length: 3,
  },
  {
    ko: "효진 씨한테 주라고 했어요.",
    en: "I told Hyojin to give it to me.",
    length: 4,
  },
  {
    ko: "저를 좋아하는 사람.",
    en: "someone who likes me",
    length: 3,
  },
  {
    ko: "유치원생은 버스 요금을 내지 않아도 돼요.",
    en: "Kindergarten students do not have to pay bus fare.",
    length: 6,
  },
  {
    ko: "그 후에 같이 초대할지 따로 초대할지 결정해.",
    en: "Then decide whether to invite them together or separately.",
    length: 7,
  },
  {
    ko: "스웨터에다가 코트까지 정말 겨울 옷차림이네요.",
    en: "From the sweater to the coat, it's really winter attire.",
    length: 5,
  },
  {
    ko: "우유 아니에요.",
    en: "it's not milk",
    length: 2,
  },
  {
    ko: "그 사람은 예쁜 척을 너무 많이 해요.",
    en: "That person pretends to be pretty too much.",
    length: 7,
  },
  {
    ko: "나는 아프리카에 가 본 일이 없다.",
    en: "I have never been to Africa.",
    length: 6,
  },
  {
    ko: "누구 만날 거예요?",
    en: "Who are you going to meet?",
    length: 3,
  },
  {
    ko: "사무실에 있어요.",
    en: "I'm in the office.",
    length: 2,
  },
  {
    ko: "죄송하지만 학생증이 있어야 대출이 가능합니다.",
    en: "I'm sorry, but you can borrow it only with your student ID.",
    length: 5,
  },
  {
    ko: "선생님이 학생들에게 한국어를 가르칩니다.",
    en: "The teacher teaches Korean to the students.",
    length: 4,
  },
  {
    ko: "집에 있었어요.",
    en: "I was at home.",
    length: 2,
  },
  {
    ko: "비가 오겠는데요.",
    en: "It will rain.",
    length: 2,
  },
  {
    ko: "방을 예약하시겠어요?",
    en: "Would you like to reserve a room?",
    length: 2,
  },
  {
    ko: "학생이냐고 물어봤어요.",
    en: "I asked if you were a student.",
    length: 2,
  },
  {
    ko: "쉬는 날에는 아내를 도와주기도 해요.",
    en: "On my days off, I help my wife.",
    length: 5,
  },
  {
    ko: "그 옷은 작아서 못 입어요.",
    en: "The clothes are small and I can't wear them.",
    length: 5,
  },
  {
    ko: "아침 일곱 시에 일어나요.",
    en: "get up at seven in the morning",
    length: 4,
  },
  {
    ko: "문제가 있는지 물어보세요.",
    en: "Ask if there is a problem.",
    length: 3,
  },
  {
    ko: "유행보다는 꼭 필요한 물건을 샀으면 좋겠어.",
    en: "I want you to buy essentials rather than fads.",
    length: 6,
  },
  {
    ko: "지난 주에 영화를 보게 됐어요.",
    en: "I saw a movie last week.",
    length: 5,
  },
  {
    ko: "친구들과 영화나 볼까 해요.",
    en: "I want to watch a movie with my friends.",
    length: 4,
  },
  {
    ko: "가족이 많네요.",
    en: "I have a lot of family.",
    length: 2,
  },
  {
    ko: "어제 비가 온 것 같아요.",
    en: "I think it rained yesterday.",
    length: 5,
  },
  {
    ko: "여기가 한국대학교지요?",
    en: "Is this Korea University?",
    length: 2,
  },
  {
    ko: "그럼, 선생님께 여쭤 보지 그래요?",
    en: "Then, why don't you ask the teacher?",
    length: 5,
  },
  {
    ko: "네 시간 동안 공원에 앉아서 이야기했어요.",
    en: "We sat and talked in the park for four hours.",
    length: 6,
  },
  {
    ko: "여기 오기 전에 뭐 했어요?",
    en: "What did you do before coming here?",
    length: 5,
  },
  {
    ko: "올해 꼭 해야겠다고 생각한 일이 있어요?",
    en: "Is there anything you think you must do this year?",
    length: 6,
  },
  {
    ko: "문이 닫혀 있어요.",
    en: "The door is closed.",
    length: 3,
  },
  {
    ko: "내일 뭐 입을 거예요?",
    en: "what are you going to wear tomorrow?",
    length: 4,
  },
  {
    ko: "자주 먹는 한국 음식 있어요?",
    en: "Are there any Korean foods you often eat?",
    length: 5,
  },
  {
    ko: "밖에 있다가 들어왔어요.",
    en: "I was outside and came in.",
    length: 3,
  },
  {
    ko: "짐을 좀 들어 드릴까요?",
    en: "Can I carry some luggage for you?",
    length: 4,
  },
  {
    ko: "실례합니다만 이거 동대문 갑니까?",
    en: "Excuse me, is this going to Dongdaemun?",
    length: 4,
  },
  {
    ko: "백화점에 가서 옷을 살 거예요.",
    en: "I will go to the department store and buy clothes.",
    length: 5,
  },
  {
    ko: "요즘에 얼마나 열심히 공부하는지 몰라요.",
    en: "You don't know how hard I study these days.",
    length: 5,
  },
  {
    ko: "1시간 전에 식사했어요.",
    en: "I ate an hour ago.",
    length: 3,
  },
  {
    ko: "이거 괜찮은지 봐 주세요.",
    en: "Please see if this is okay.",
    length: 4,
  },
  {
    ko: "벌써 초대장을 받았을 텐데 연락이 없네요.",
    en: "I should have already received an invitation, but I haven't heard from you.",
    length: 6,
  },
  {
    ko: "스웨터를 입고 보니 거꾸로 입었더라고요.",
    en: "When I tried on the sweater, it turned out to be upside down.",
    length: 5,
  },
  {
    ko: "만호는 종이가 없어요.",
    en: "Manho has no paper.",
    length: 3,
  },
  {
    ko: "김은지 선생님께도 감사하다고 전해 주세요.",
    en: "Please say thank you to teacher Eunji Kim.",
    length: 5,
  },
  {
    ko: "주말에 소풍 잘 갔다 왔어요?",
    en: "Did you have a good picnic on the weekend?",
    length: 5,
  },
  {
    ko: "나는 경은이야.",
    en: "I am Kyeong-eun",
    length: 2,
  },
  {
    ko: "집에 갈 때 버스를 타요?",
    en: "Do you take the bus to go home?",
    length: 5,
  },
  {
    ko: "네, 그래서 샌드위치를 먹으면서 일했어요.",
    en: "Yes, so I worked while eating a sandwich.",
    length: 5,
  },
  {
    ko: "건강 때문에 올해부터 담배를 끊기로 했어요.",
    en: "I decided to quit smoking this year for health reasons.",
    length: 6,
  },
  {
    ko: "지금 바쁘니까 나중에 전화해 주세요.",
    en: "I'm busy right now, so please call me later.",
    length: 5,
  },
  {
    ko: "늦지 않도록 빨리 서두르세요.",
    en: "Hurry up so you don't be late.",
    length: 4,
  },
  {
    ko: "목소리 좋아요.",
    en: "Your voice is great.",
    length: 2,
  },
  {
    ko: "양강 씨는 저를 너무 행복하게 해요.",
    en: "Mr. Yanggang makes me so happy.",
    length: 6,
  },
  {
    ko: "2박 3일 정도가 좋겠어요.",
    en: "2 nights and 3 days would be good.",
    length: 4,
  },
  {
    ko: "제주도 여행이 어땠어요?",
    en: "How was your trip to Jeju Island?",
    length: 3,
  },
  {
    ko: "케익을 예쁘게 만들고 싶은데, 예쁘게 안 만들어져요.",
    en: "I want to make a pretty cake, but it's not made pretty.",
    length: 7,
  },
  {
    ko: "커피에 설탕을 넣으시겠어요?",
    en: "Would you like to put sugar in your coffee?",
    length: 3,
  },
  {
    ko: "거짓말 같아요.",
    en: "It's like a lie.",
    length: 2,
  },
  {
    ko: "오늘은 어제보다 훨씬 따뜻한 것 같아요.",
    en: "It seems much warmer today than yesterday.",
    length: 6,
  },
  {
    ko: "비가 그쳤으면 좋겠어요.",
    en: "I wish the rain would stop.",
    length: 3,
  },
  {
    ko: "선생님과 학생들이 있습니다.",
    en: "There are teachers and students.",
    length: 3,
  },
  {
    ko: "스무 살이에요.",
    en: "I am twenty years old.",
    length: 2,
  },
  {
    ko: "미누 씨가 지금 집에 가고 있어요.",
    en: "Minu is going home now.",
    length: 6,
  },
  {
    ko: "피곤해서 잤어요.",
    en: "I slept because I was tired.",
    length: 2,
  },
  {
    ko: "방에 있는데 공부하는지 자는지 잘 모르겠어요.",
    en: "I'm in my room and I don't know if I'm studying or sleeping.",
    length: 6,
  },
  {
    ko: "마틴 씨가 왔어요.",
    en: "Mr. Martin is here.",
    length: 3,
  },
  {
    ko: "그리고 운동을 많이 하세요.",
    en: "And do a lot of exercise.",
    length: 4,
  },
  {
    ko: "우리 선생님하고 같이 식사할까요?",
    en: "Shall we eat together with our teacher?",
    length: 4,
  },
  {
    ko: "저 사람은 로봇 같아요.",
    en: "That person is like a robot.",
    length: 4,
  },
  {
    ko: "카메라 사려고 하는데 뭐가 좋아요?",
    en: "I want to buy a camera. What's good?",
    length: 5,
  },
  {
    ko: "옷장이 없어요.",
    en: "There is no wardrobe.",
    length: 2,
  },
  {
    ko: "화장실 어디예요?",
    en: "where is the bathroom",
    length: 2,
  },
  {
    ko: "그럼 가족이 모두 모이겠구나.",
    en: "Then the whole family will come together.",
    length: 4,
  },
  {
    ko: "제가 볼 책이에요.",
    en: "This is the book I will read.",
    length: 3,
  },
  {
    ko: "아무도 올 수 없어요.",
    en: "no one can come",
    length: 4,
  },
  {
    ko: "어디에 있다가 지금 왔어요?",
    en: "Where did you come from now?",
    length: 4,
  },
  {
    ko: "또 비가 오나 봐요.",
    en: "It looks like it will rain again.",
    length: 4,
  },
  {
    ko: "3층으로 올라가십시오.",
    en: "Go up to the third floor.",
    length: 2,
  },
  {
    ko: "여기는 와 본 적 없어요.",
    en: "I've never been here before.",
    length: 5,
  },
  {
    ko: "하영 씨는 천사같이 착해요.",
    en: "Hayoung is kind like an angel.",
    length: 4,
  },
  {
    ko: "미샤는 밥을 안 먹겠다고 하는데요.",
    en: "Misha says she won't eat.",
    length: 5,
  },
  {
    ko: "할아버지가 안 계세요.",
    en: "Grandpa isn't there.",
    length: 3,
  },
  {
    ko: "부족할 리가 없을 텐데요.",
    en: "There can be no shortage of them.",
    length: 4,
  },
  {
    ko: "어제 가방이랑 모자를 샀어요.",
    en: "I bought a bag and a hat yesterday.",
    length: 4,
  },
  {
    ko: "저는 아침마다 달리기를 해요.",
    en: "I run every morning.",
    length: 4,
  },
  {
    ko: "저도 여기 자주 오는 편이에요.",
    en: "I also come here often.",
    length: 5,
  },
  {
    ko: "샐리는 캐나다에서 왔어요.",
    en: "Sally is from Canada.",
    length: 3,
  },
  {
    ko: "이거 해 보고 싶어요.",
    en: "I want to try this.",
    length: 4,
  },
  {
    ko: "읽기는 읽었는데 이해가 안 돼요.",
    en: "I read it, but I don't understand it.",
    length: 5,
  },
  {
    ko: "이 파란색 꽃무늬의 원피스 말입니까?",
    en: "You mean this blue floral dress?",
    length: 5,
  },
  {
    ko: "나는 아무리 바빠도 아침을 꼭 먹어요.",
    en: "No matter how busy I am, I always eat breakfast.",
    length: 6,
  },
  {
    ko: "감기 다 나았어요?",
    en: "Did you get over your cold?",
    length: 3,
  },
  {
    ko: "신발을 벗어 주세요.",
    en: "Please take off your shoes.",
    length: 3,
  },
  {
    ko: "머리 언제 잘랐어요?",
    en: "When did you cut your hair?",
    length: 3,
  },
  {
    ko: "동생은 키가 작아요.",
    en: "My younger brother is short.",
    length: 3,
  },
  {
    ko: "주말에 부산에서 서울까지 운전을 하고 가셨다면서요?",
    en: "I heard you drove from Busan to Seoul on the weekend?",
    length: 6,
  },
  {
    ko: "이것은 누구의 우산입니까?",
    en: "Whose umbrella is this?",
    length: 3,
  },
  {
    ko: "회원 가입을 해야 할인을 받아요.",
    en: "You must register as a member to receive a discount.",
    length: 5,
  },
  {
    ko: "어차피 늦었으니까 천천히 와.",
    en: "It's late anyway, so come slowly.",
    length: 4,
  },
  {
    ko: "집에 가면 안 돼요.",
    en: "I can't go home.",
    length: 4,
  },
  {
    ko: "낮에는 차가 많은데 밤에는 차가 없어요.",
    en: "There are many cars during the day, but there are no cars at night.",
    length: 6,
  },
  {
    ko: "이 사람 누구일까요?",
    en: "Who is this person?",
    length: 3,
  },
  {
    ko: "동호회에 계속 나가는구나?",
    en: "Are you still going to the club?",
    length: 3,
  },
  {
    ko: "대신에 다음에는 저를 도와 줘야 돼요.",
    en: "Instead, you should help me next time.",
    length: 6,
  },
  {
    ko: "우리나라에서도 같아요.",
    en: "It's the same in Korea.",
    length: 2,
  },
  {
    ko: "저는 딸기도 좋아하고 바나나도 좋아해요.",
    en: "I like strawberries and I like bananas too.",
    length: 5,
  },
  {
    ko: "숙제를 다 하고 나서 책을 읽었습니다.",
    en: "After I finished my homework, I read the book.",
    length: 6,
  },
  {
    ko: "이 선생님이나 김 선생님에게 물어보세요.",
    en: "Ask Mr. Lee or Mr. Kim.",
    length: 5,
  },
  {
    ko: "여러분을 알게 되어 참 기쁩니다.",
    en: "I am so glad to know you.",
    length: 5,
  },
  {
    ko: "요즘 공부하는 거는 뭐예요?",
    en: "What are you studying these days?",
    length: 4,
  },
  {
    ko: "이제 11시밖에 안 되었는데요.",
    en: "It's only 11 o'clock now.",
    length: 4,
  },
  {
    ko: "무서워서 울 뻔 했어요.",
    en: "I was scared and almost cried.",
    length: 4,
  },
  {
    ko: "아직 학생인데 올해 졸업할 거예요.",
    en: "I am still a student and will be graduating this year.",
    length: 5,
  },
  {
    ko: "옆방에 남자친구하고 있어요.",
    en: "I have a boyfriend in the next room.",
    length: 3,
  },
  {
    ko: "5l짜리 한 병 주세요.",
    en: "A 5l bottle, please.",
    length: 4,
  },
  {
    ko: "여기에서 학교까지 버스가 있어요?",
    en: "Is there a bus from here to school?",
    length: 4,
  },
  {
    ko: "저는 지난 12월까지 102호에 살았던 장소이예요.",
    en: "I lived in room 102 until last December.",
    length: 6,
  },
  {
    ko: "저는 글씨를 잘 못 써요.",
    en: "I'm not good at writing.",
    length: 5,
  },
  {
    ko: "뭐 할 거예요?",
    en: "What are you going to do?",
    length: 3,
  },
  {
    ko: "회의 중이에요.",
    en: "I'm in a meeting.",
    length: 2,
  },
  {
    ko: "날씨가 정말 좋네요.",
    en: "The weather is really nice.",
    length: 3,
  },
  {
    ko: "전화 다 했어요?",
    en: "Did you call?",
    length: 3,
  },
  {
    ko: "이게 훨씬 더 좋아요.",
    en: "I like this much better.",
    length: 4,
  },
  {
    ko: "어제 간 식당이 어땠어요?",
    en: "How was the restaurant you went to yesterday?",
    length: 4,
  },
  {
    ko: "웨슬리 씨는 일요일마다 교회에 가요.",
    en: "Mr. Wesley goes to church every Sunday.",
    length: 5,
  },
  {
    ko: "토요일에 만나요.",
    en: "Let's meet on Saturday.",
    length: 2,
  },
  {
    ko: "역사책만 한 권 읽었을 뿐이에요.",
    en: "I only read one history book.",
    length: 5,
  },
  {
    ko: "이 책은 공짜라고 했어요.",
    en: "They said this book was free.",
    length: 4,
  },
  {
    ko: "누구하고 같이 극장에 갈 거예요?",
    en: "Who are you going to the theater with?",
    length: 5,
  },
  {
    ko: "가방을 싸고 보니 여행안내책을 안 넣었더라고요.",
    en: "When I packed my bag, I realized that I hadn't put a travel guidebook in it.",
    length: 6,
  },
  {
    ko: "언제 중국에 갈 거예요?",
    en: "When are you going to China?",
    length: 4,
  },
  {
    ko: "저는 미국 사람이에요.",
    en: "I am American.",
    length: 3,
  },
  {
    ko: "영어 할 줄 몰라요.",
    en: "I can not speak English.",
    length: 4,
  },
  {
    ko: "여덟 시 반에 학교에 가요.",
    en: "I go to school at half past eight.",
    length: 5,
  },
  {
    ko: "그래서 집을 찾는 중이에요.",
    en: "So, I'm looking for a house.",
    length: 4,
  },
  {
    ko: "개가 두 마리 있어요.",
    en: "I have two dogs.",
    length: 4,
  },
  {
    ko: "그거라면 저한테 맡겨 주세요.",
    en: "If so, please leave it to me.",
    length: 4,
  },
  {
    ko: "출근 시간이라 길이 많이 막힐 테니까요.",
    en: "It's commuting time, so the roads will be very congested.",
    length: 6,
  },
  {
    ko: "왕징 씨는 사과를 좋아해요.",
    en: "Wang Jing likes apples.",
    length: 4,
  },
  {
    ko: "사진 좀 찍어 주시겠어요?",
    en: "could you take a picture for me?",
    length: 4,
  },
  {
    ko: "누가 안 왔어요?",
    en: "who didn't come?",
    length: 3,
  },
  {
    ko: "지금 인터넷 돼요?",
    en: "do you have internet now?",
    length: 3,
  },
  {
    ko: "이대역에서 압구정동까지 사십 분 정도 걸리지요?",
    en: "It takes about 40 minutes from Ewha Womans University Station to Apgujeong-dong.",
    length: 6,
  },
  {
    ko: "3년 동안 있을 거예요.",
    en: "It will be there for 3 years.",
    length: 4,
  },
  {
    ko: "듣고 있을 거예요.",
    en: "you will be listening",
    length: 3,
  },
  {
    ko: "도망가기 전에 잡으세요.",
    en: "Catch them before they run away.",
    length: 3,
  },
  {
    ko: "이거 커피라고 했어요.",
    en: "He said it was coffee.",
    length: 3,
  },
  {
    ko: "등산 같이 갈래요?",
    en: "Do you want to go hiking together?",
    length: 3,
  },
  {
    ko: "아마 선생님이 말을 천천히 해서 그럴 거예요.",
    en: "Maybe it's because the teacher speaks slowly.",
    length: 7,
  },
  {
    ko: "아니요, 날씨가 나빠서 소풍을 못 갔어요.",
    en: "No, I couldn't go on the picnic because of the bad weather.",
    length: 6,
  },
  {
    ko: "비나 눈이 오면 집에서 텔레비전을 봐요.",
    en: "When it rains or snows, I watch TV at home.",
    length: 6,
  },
  {
    ko: "불 좀 꺼 주세요.",
    en: "Please turn off the lights.",
    length: 4,
  },
  {
    ko: "한국의 보령이라는 지역에서 열리는 축제래.",
    en: "A festival held in Boryeong, Korea.",
    length: 5,
  },
  {
    ko: "밥을 먹은 후에 이를 닦아요.",
    en: "Brush your teeth after eating.",
    length: 5,
  },
  {
    ko: "내가 안 좋아하는 책.",
    en: "A book I don't like.",
    length: 4,
  },
  {
    ko: "주말에 재미있게 보내셨나요?",
    en: "Did you have fun over the weekend?",
    length: 3,
  },
  {
    ko: "우리는 2년 전부터 한국어를 공부하기 시작했습니다.",
    en: "We started studying Korean two years ago.",
    length: 6,
  },
  {
    ko: "회의가 끝나고 나서 주세요.",
    en: "Please come after the meeting.",
    length: 4,
  },
  {
    ko: "경은 씨, 빨리 일하세요.",
    en: "Kyeong-eun, please work quickly.",
    length: 4,
  },
  {
    ko: "제가 먼저 해 볼게요.",
    en: "I'll try first.",
    length: 4,
  },
  {
    ko: "어제 이거 샀어요.",
    en: "I bought this yesterday.",
    length: 3,
  },
  {
    ko: "요즘 일이 많아서 다 못 읽었을지도 몰라요.",
    en: "I've been busy with work lately, so I may not have been able to read it all.",
    length: 7,
  },
  {
    ko: "친구들하고 스키장에 갈 거예요.",
    en: "I am going skiing with my friends.",
    length: 4,
  },
  {
    ko: "이거하고 이거 주세요.",
    en: "Give me this and this.",
    length: 3,
  },
  {
    ko: "저는 한국에 온 지 2년이 되었습니다.",
    en: "It has been 2 years since I came to Korea.",
    length: 6,
  },
  {
    ko: "이건 어린이가 사용하기에 어려워요.",
    en: "It is difficult for children to use.",
    length: 4,
  },
  {
    ko: "보다가 졸았어요.",
    en: "I fell asleep watching it.",
    length: 2,
  },
  {
    ko: "커피를 마시고 싶어요.",
    en: "I want to drink coffee.",
    length: 3,
  },
  {
    ko: "바쁘거나 가방이 무거울 때 택시를 타요.",
    en: "When I'm busy or my bag is heavy, I take a taxi.",
    length: 6,
  },
  {
    ko: "여기에 “스쿨푸드”라는 식당이 있어요.",
    en: "There is a restaurant called “School Food” here.",
    length: 4,
  },
  {
    ko: "그래도 노래 안 할 거예요.",
    en: "I won't sing anyway.",
    length: 5,
  },
  {
    ko: "노래는 못하는데 춤은 잘 춰요.",
    en: "I can't sing, but I can dance well.",
    length: 5,
  },
  {
    ko: "친구 집에 와서 즐겁게 보내기를 바랄게요.",
    en: "I hope you come over to your friend's house and have fun.",
    length: 6,
  },
  {
    ko: "커피 마실까요?",
    en: "Shall we have some coffee?",
    length: 2,
  },
  {
    ko: "어디로 갈지 잘 모르겠어요.",
    en: "I'm not sure where to go.",
    length: 4,
  },
  {
    ko: "지갑을 잃어버렸다고 들었는데, 찾았어요?",
    en: "I heard you lost your wallet, did you find it?",
    length: 4,
  },
  {
    ko: "이거 다 먹으면 배가 아플 거예요.",
    en: "If you eat all of this, your stomach will hurt.",
    length: 6,
  },
  {
    ko: "저는 저녁에 극장에 갈 것입니다.",
    en: "I'm going to the theater in the evening.",
    length: 5,
  },
  {
    ko: "저는 서울에 살아요.",
    en: "I live in Seoul.",
    length: 3,
  },
  {
    ko: "벌써 11월이네요.",
    en: "It's already November.",
    length: 2,
  },
  {
    ko: "제가 지금 돈이 없거든요.",
    en: "Because I don't have money right now.",
    length: 4,
  },
  {
    ko: "한국 신문을 못 읽어요.",
    en: "I can't read Korean newspapers.",
    length: 4,
  },
  {
    ko: "어디에서 사야 돼요?",
    en: "where should i buy it?",
    length: 3,
  },
  {
    ko: "불고기 사 인분 주세요.",
    en: "Four servings of Bulgogi, please.",
    length: 4,
  },
  {
    ko: "여자 친구가 어때요?",
    en: "How is your girlfriend?",
    length: 3,
  },
  {
    ko: "요즘 가장 인기 있는 가수는 누구예요?",
    en: "Who is the most popular singer these days?",
    length: 6,
  },
  {
    ko: "제가 볼 수 있도록 놓아 주세요.",
    en: "Please let me see.",
    length: 6,
  },
  {
    ko: "미스코리아처럼 예뻐요.",
    en: "You are pretty like Miss Korea.",
    length: 2,
  },
  {
    ko: "내일 아침에 오시겠습니까?",
    en: "Would you like to come tomorrow morning?",
    length: 3,
  },
  {
    ko: "그래서 공부해야 돼요.",
    en: "So you have to study.",
    length: 3,
  },
  {
    ko: "토요일인데 어디 가니?",
    en: "It's Saturday, where are you going?",
    length: 3,
  },
  {
    ko: "어제 이 시간에 뭐 하고 있었어요?",
    en: "What were you doing at this time yesterday?",
    length: 6,
  },
  {
    ko: "제가 일등이라고 들었어요.",
    en: "I heard that I am number one.",
    length: 3,
  },
  {
    ko: "1981년 3월 5일에 태어났어요.",
    en: "I was born on March 5, 1981.",
    length: 4,
  },
  {
    ko: "만지지 마세요.",
    en: "Do not touch.",
    length: 2,
  },
  {
    ko: "한국 춤을 배우러 학원에 다녀요.",
    en: "I go to an academy to learn Korean dance.",
    length: 5,
  },
  {
    ko: "이 노래는 제가 좋아하는 노래예요.",
    en: "This song is my favorite song.",
    length: 5,
  },
  {
    ko: "가족이 몇 명이에요?",
    en: "How many people are in your family?",
    length: 3,
  },
  {
    ko: "이해가 안 돼요.",
    en: "I do not understand.",
    length: 3,
  },
  {
    ko: "댄 씨 어머님이 언제 서울에 오시나요?",
    en: "When is Dan's mother coming to Seoul?",
    length: 6,
  },
  {
    ko: "불 켜도 돼요.",
    en: "You can turn on the lights.",
    length: 3,
  },
  {
    ko: "아직 다 안 썼어요.",
    en: "I haven't written it all yet.",
    length: 4,
  },
  {
    ko: "재미있었지만 좀 더웠어요.",
    en: "It was fun but a bit hot.",
    length: 3,
  },
  {
    ko: "모기가 물어서 눈이 부었어요.",
    en: "My eyes were swollen from mosquito bites.",
    length: 4,
  },
  {
    ko: "아버지는 회사에 가셨어요.",
    en: "My father went to work.",
    length: 3,
  },
  {
    ko: "네, 켜 드릴게요.",
    en: "Yes, I'll turn it on.",
    length: 3,
  },
  {
    ko: "가족을 2년 동안 못 만났어요.",
    en: "I haven't seen my family for 2 years.",
    length: 5,
  },
  {
    ko: "오늘따라 왜 이렇게 길이 막히지요?",
    en: "Why is the road so blocked today?",
    length: 5,
  },
  {
    ko: "왼쪽으로 가다.",
    en: "go left",
    length: 2,
  },
  {
    ko: "정말 비가 오는군요.",
    en: "It's really raining.",
    length: 3,
  },
  {
    ko: "우리 고양이는 참치밖에 안 먹어요.",
    en: "My cat only eats tuna.",
    length: 5,
  },
  {
    ko: "모두들 잘 도착했다고 합니다.",
    en: "Everyone said they arrived well.",
    length: 4,
  },
  {
    ko: "한국어에 비해서 일본어는 발음이 쉬운 편이에요.",
    en: "Compared to Korean, Japanese is easier to pronounce.",
    length: 6,
  },
  {
    ko: "날씨가 추워서 그런지 두꺼운 옷이 잘 팔리네요.",
    en: "Because the weather is cold, thick clothes sell well.",
    length: 7,
  },
  {
    ko: "동물과 대화할 수 있다면 뭘 하고 싶어요?",
    en: "If you could talk to animals, what would you do?",
    length: 7,
  },
  {
    ko: "듣기 시험을 어떻게 봐요?",
    en: "How do you take the listening test?",
    length: 4,
  },
  {
    ko: "불이 나자마자 소방차가 왔어요.",
    en: "As soon as the fire started, the fire engine came.",
    length: 4,
  },
  {
    ko: "아마 음식 값이 비싼 모양이에요.",
    en: "Maybe the food is expensive.",
    length: 5,
  },
  {
    ko: "깨끗하게 해 주세요.",
    en: "Please make it clean.",
    length: 3,
  },
  {
    ko: "그 사람이 유명한 가수였군요.",
    en: "That person must have been a famous singer.",
    length: 4,
  },
  {
    ko: "뭐 하는 중이었어요?",
    en: "What were you doing?",
    length: 3,
  },
  {
    ko: "이 책 읽을 만해요?",
    en: "Is this book worth reading?",
    length: 4,
  },
  {
    ko: "저는 미국에서 태어났어요.",
    en: "I was born in America.",
    length: 3,
  },
  {
    ko: "저는 성격이 좀 급한 편이거든요.",
    en: "I have a bit of an impatient personality.",
    length: 5,
  },
  {
    ko: "이거 얼마예요?",
    en: "How much is it?",
    length: 2,
  },
  {
    ko: "제가 말한 대로 했어요?",
    en: "Did you do what I said?",
    length: 4,
  },
  {
    ko: "저 기다리지 말고 먼저 가도 돼요.",
    en: "Don't wait for me. You can go first.",
    length: 6,
  },
  {
    ko: "아무나 올 수 있어요.",
    en: "Anyone can come.",
    length: 4,
  },
  {
    ko: "만나서 반가워요.",
    en: "nice to meet you",
    length: 2,
  },
  {
    ko: "아이스크림 주세요.",
    en: "ice cream please",
    length: 2,
  },
  {
    ko: "창문을 좀 열어 드릴까요?",
    en: "Can I open the window for you?",
    length: 4,
  },
  {
    ko: "여기 앉아도 될까요?",
    en: "May I sit here?",
    length: 3,
  },
  {
    ko: "콘서트가 7시에 시작하니까 늦지 말래요.",
    en: "The concert starts at 7 so don't be late.",
    length: 5,
  },
  {
    ko: "집에 오니까 밤 12시였어요.",
    en: "It was 12:00 at night when I got home.",
    length: 4,
  },
  {
    ko: "영어로 이야기하는 것 같아요.",
    en: "I think you speak English.",
    length: 4,
  },
  {
    ko: "아까 약속이 있다고 급하게 나가더라고요.",
    en: "He said he had an appointment earlier and left in a hurry.",
    length: 5,
  },
  {
    ko: "캐럴 씨는 키가 크고 날씬해요.",
    en: "Carol is tall and thin.",
    length: 5,
  },
  {
    ko: "바빠도 한국에 갈 거예요.",
    en: "Even if I am busy, I will go to Korea.",
    length: 4,
  },
  {
    ko: "어제 왜 학교에 안 왔어요?",
    en: "Why didn't you come to school yesterday?",
    length: 5,
  },
  {
    ko: "그러면 비행기를 기다리는 동안 면세점에서 쇼핑을 합시다.",
    en: "Then, let's shop at the duty free store while waiting for the flight.",
    length: 7,
  },
  {
    ko: "이거 사고 싶어요.",
    en: "i want to buy this",
    length: 3,
  },
  {
    ko: "어제 친구 만났어.",
    en: "I met a friend yesterday",
    length: 3,
  },
  {
    ko: "주말에 운동해요?",
    en: "Do you exercise on the weekend?",
    length: 2,
  },
  {
    ko: "한국 신문이 어려워요.",
    en: "Korean newspapers are difficult.",
    length: 3,
  },
  {
    ko: "올해에는 담배를 꼭 끊겠습니다.",
    en: "I will definitely quit smoking this year.",
    length: 4,
  },
  {
    ko: "제가 출장을 가겠습니다.",
    en: "I will go on a business trip.",
    length: 3,
  },
  {
    ko: "평소에 하던 대로 하세요.",
    en: "Do what you normally do.",
    length: 4,
  },
  {
    ko: "우산이 두 개 있는데 빌려 줄까요?",
    en: "I have two umbrellas. Can I borrow them?",
    length: 6,
  },
  {
    ko: "친구들이 점심을 같이 먹자고 그랬어요.",
    en: "My friends asked me to have lunch with them.",
    length: 5,
  },
  {
    ko: "비 때문에 차가 많이 막혔어요.",
    en: "The car was blocked a lot because of the rain.",
    length: 5,
  },
  {
    ko: "월요일에 시험이 있으니까 클럽에 가지 맙시다.",
    en: "We have a test on Monday, so let's not go to the club.",
    length: 6,
  },
  {
    ko: "민희는 뉴스를 듣는다.",
    en: "Minhee listens to the news.",
    length: 3,
  },
  {
    ko: "어제 친구 만나려고 했는데, 못 만났어요.",
    en: "I tried to meet my friend yesterday, but I couldn't.",
    length: 6,
  },
  {
    ko: "책이 책상 위에 있어요.",
    en: "The book is on the desk.",
    length: 4,
  },
  {
    ko: "겨울에는 물이 얼음이 됩니다.",
    en: "In winter, water turns to ice.",
    length: 4,
  },
  {
    ko: "지금 1월이에요.",
    en: "It's January now.",
    length: 2,
  },
  {
    ko: "사람이 많아서 미리 예약해야 돼요.",
    en: "There are a lot of people, so you need to make a reservation in advance.",
    length: 5,
  },
  {
    ko: "언제 도착했어요?",
    en: "when did you arrive?",
    length: 2,
  },
  {
    ko: "거기에서 왼쪽으로 가세요.",
    en: "Go left from there.",
    length: 3,
  },
  {
    ko: "싸고 편한 신발을 살 거예요.",
    en: "I will buy cheap and comfortable shoes.",
    length: 5,
  },
  {
    ko: "열면 안 돼요.",
    en: "You can't open it.",
    length: 3,
  },
  {
    ko: "제가 도와 드릴게요.",
    en: "Let me help you.",
    length: 3,
  },
  {
    ko: "지금 어디에 있는데요?",
    en: "Where are you now?",
    length: 3,
  },
  {
    ko: "우체국에 편지를 보내러 가요.",
    en: "I go to the post office to send a letter.",
    length: 4,
  },
  {
    ko: "2번 출구로 나오세요.",
    en: "Come out through Exit 2.",
    length: 3,
  },
  {
    ko: "여기에서 오른쪽으로 가세요.",
    en: "Go right from here.",
    length: 3,
  },
  {
    ko: "사진관에 가서 같이 사진을 찍지 그래요?",
    en: "Why don't we go to a photo studio and take a picture together?",
    length: 6,
  },
  {
    ko: "이거 카메라예요.",
    en: "It's a camera.",
    length: 2,
  },
  {
    ko: "더울 뿐만 아니라 비도 많이 와요.",
    en: "Not only is it hot, but it also rains a lot.",
    length: 6,
  },
  {
    ko: "합격한 회사에 갈까 말까 고민 중이에요.",
    en: "I'm contemplating whether or not to go to the company I was accepted into.",
    length: 6,
  },
  {
    ko: "여기는 우리 집이에요.",
    en: "This is our house.",
    length: 3,
  },
  {
    ko: "외국에서 공부하려고 하는 학생들이 많아요.",
    en: "There are many students who want to study abroad.",
    length: 5,
  },
  {
    ko: "아까 보니까 오늘도 얼굴 표정이 안 좋으시던데요.",
    en: "Seeing you earlier, your face expression is not good today.",
    length: 7,
  },
  {
    ko: "이사할 거예요.",
    en: "I'm moving.",
    length: 2,
  },
  {
    ko: "집에 가기 전에.",
    en: "before going home.",
    length: 3,
  },
  {
    ko: "이 식당은 시끄러운 데다가 맛도 없어요.",
    en: "This restaurant is noisy and tasteless.",
    length: 6,
  },
  {
    ko: "내일 아침에 먹을 빵이 없습니다.",
    en: "There is no bread for tomorrow morning.",
    length: 5,
  },
  {
    ko: "그러니까 좀 서둘러서 책을 사지 그랬어요?",
    en: "So why don't you hurry up and buy the book?",
    length: 6,
  },
  {
    ko: "우리가 늘 가던 데로 예약해요.",
    en: "We make reservations where we always go.",
    length: 5,
  },
  {
    ko: "어떻게 왔어요?",
    en: "how did you come",
    length: 2,
  },
  {
    ko: "회의하면서 마시게 커피 좀 사 올까요?",
    en: "Can I get you some coffee to drink during the meeting?",
    length: 6,
  },
  {
    ko: "이거는 냉장고가 아니에요.",
    en: "This is not a refrigerator.",
    length: 3,
  },
  {
    ko: "아니면 친구를 만날 거예요?",
    en: "Or are you going to meet a friend?",
    length: 4,
  },
  {
    ko: "꼭 정장을 입을 필요는 없어요.",
    en: "You don't have to wear a suit.",
    length: 5,
  },
  {
    ko: "텔레비전을 가까이서 못 보게 하세요.",
    en: "Don't watch TV close by.",
    length: 5,
  },
  {
    ko: "요즘 퇴근하고 매일 영어를 배워요.",
    en: "These days, after work, I learn English every day.",
    length: 5,
  },
  {
    ko: "컴퓨터가 텔레비전 옆에 있어요.",
    en: "The computer is next to the TV.",
    length: 4,
  },
  {
    ko: "그럼, 인터넷으로 주문을 하지 그래요?",
    en: "Then, why don't you order over the Internet?",
    length: 5,
  },
  {
    ko: "네, 안 갈래요.",
    en: "yes, i won't go",
    length: 3,
  },
  {
    ko: "저는 취미가 없어요.",
    en: "I have no hobbies.",
    length: 3,
  },
  {
    ko: "이 옷은 실크예요.",
    en: "This dress is silk.",
    length: 3,
  },
  {
    ko: "이 사람 누구인지 아세요?",
    en: "Do you know who this is?",
    length: 4,
  },
  {
    ko: "자려고 누웠는데 잠이 안 와요.",
    en: "I lay down to sleep, but I can't sleep.",
    length: 5,
  },
  {
    ko: "저는 대학교에서 중국어를 가르쳐요.",
    en: "I teach Chinese at university.",
    length: 4,
  },
  {
    ko: "내일 몇 시에 오시겠어요?",
    en: "What time will you come tomorrow?",
    length: 4,
  },
  {
    ko: "서울은 교통이 편한 반면에 공해가 심하거든요.",
    en: "Seoul has convenient transportation, but it is highly polluted.",
    length: 6,
  },
  {
    ko: "한 번 더 설명해 주실래요?",
    en: "could you explain one more time?",
    length: 5,
  },
  {
    ko: "우유랑 빵 샀어요.",
    en: "I bought milk and bread.",
    length: 3,
  },
  {
    ko: "만약 타임머신이 있다면 언제로 가고 싶어요?",
    en: "If you had a time machine, when would you like to go?",
    length: 6,
  },
  {
    ko: "넥타이가 멋있어요.",
    en: "The tie is nice.",
    length: 2,
  },
  {
    ko: "여기 앉으세요.",
    en: "Please sit here.",
    length: 2,
  },
  {
    ko: "어디에서 만나자고요?",
    en: "Where do you want to meet?",
    length: 2,
  },
  {
    ko: "지금 어디에서 살고 있어요?",
    en: "where do you live now?",
    length: 4,
  },
  {
    ko: "매운 음식을 좋아해요?- 아니요, 안 좋아해요.",
    en: "Do you like spicy food? - No, I don't.",
    length: 6,
  },
  {
    ko: "그 식당에는 먹을 만한 음식이 없어요.",
    en: "The restaurant has no food to eat.",
    length: 6,
  },
  {
    ko: "대답할 때는 좀 크게 하세요.",
    en: "Be a little louder when answering.",
    length: 5,
  },
  {
    ko: "제 친구는 수영을 잘 해요.",
    en: "My friend is a good swimmer.",
    length: 5,
  },
  {
    ko: "미샤가 놀러 가자고 하는데요.",
    en: "Misha wants to go play.",
    length: 4,
  },
  {
    ko: "한국 드라마를 이해할 수 있어요?",
    en: "Can you understand Korean dramas?",
    length: 5,
  },
  {
    ko: "더 필요하신 게 있으세요?",
    en: "Need more?",
    length: 4,
  },
  {
    ko: "저는 학교에 가지만 친구는 안 가요.",
    en: "I go to school, but my friends don't.",
    length: 6,
  },
  {
    ko: "나는 아침마다 요가를 한다.",
    en: "I do yoga every morning.",
    length: 4,
  },
  {
    ko: "여기 안 좋은 것 같아요.",
    en: "I think it's bad here.",
    length: 5,
  },
  {
    ko: "공원에서 사진을 찍을 거예요.",
    en: "We will take pictures in the park.",
    length: 4,
  },
  {
    ko: "지난 주부터 다음 주까지.",
    en: "from last week to next week.",
    length: 4,
  },
  {
    ko: "음악을 들었어요.",
    en: "I listened to music.",
    length: 2,
  },
  {
    ko: "더 작은 가방 있어요?",
    en: "Do you have a smaller bag?",
    length: 4,
  },
  {
    ko: "어떤 음식을 좋아해요?- 매운 음식을 좋아해요.",
    en: "What kind of food do you like? - I like spicy food.",
    length: 6,
  },
  {
    ko: "왜 안 왔냐고 물어봤는데, 대답을 안 해요.",
    en: "I asked why he didn't come, but he didn't answer.",
    length: 7,
  },
  {
    ko: "동생이 몇 살이에요?",
    en: "How old is your brother?",
    length: 3,
  },
  {
    ko: "신문과 잡지를 봅니다.",
    en: "Read newspapers and magazines.",
    length: 3,
  },
  {
    ko: "모르는 척하지 말고 빨리 말해 줘요.",
    en: "Don't pretend you don't know, tell me quickly.",
    length: 6,
  },
  {
    ko: "방학 동안에 뭐 할 거예요?",
    en: "What are you going to do during vacation?",
    length: 5,
  },
  {
    ko: "곧 도착할 것 같아요.",
    en: "I think it will arrive soon.",
    length: 4,
  },
  {
    ko: "벌써 끝났어요.",
    en: "It's already over.",
    length: 2,
  },
  {
    ko: "생일인 줄 알았더라면 선물을 준비했을 텐데요.",
    en: "If I had known it was your birthday, I would have prepared a present for you.",
    length: 6,
  },
  {
    ko: "오늘 볼 영화는 중국 영화입니다.",
    en: "The movie to watch today is a Chinese movie.",
    length: 5,
  },
  {
    ko: "여기에서 저기까지.",
    en: "from here to there.",
    length: 2,
  },
  {
    ko: "후미코는 편지를 쓰고 있어요.",
    en: "Fumiko is writing a letter.",
    length: 4,
  },
  {
    ko: "같이 가시지요.",
    en: "Let's go together.",
    length: 2,
  },
  {
    ko: "걸어가기에 좀 멀어요.",
    en: "It's a bit far to walk.",
    length: 3,
  },
  {
    ko: "저한테 파세요.",
    en: "sell it to me",
    length: 2,
  },
  {
    ko: "내일 다시 만날 수도 있어요.",
    en: "We might meet again tomorrow.",
    length: 5,
  },
  {
    ko: "그래, 조심히 다녀와라.",
    en: "yes, be careful",
    length: 3,
  },
  {
    ko: "공부한 것에 비해서 성적이 잘 나왔어요.",
    en: "I got better grades than I studied.",
    length: 6,
  },
  {
    ko: "무엇을 먹을 거예요?",
    en: "What are you going to eat?",
    length: 3,
  },
  {
    ko: "유럽 여행을 할까 해요.",
    en: "I'm thinking of taking a trip to Europe.",
    length: 4,
  },
  {
    ko: "효진 씨는 똑똑한 데다가 공부도 열심히 해요.",
    en: "Hyojin is smart and studies hard.",
    length: 7,
  },
  {
    ko: "요즘 바쁜가요?",
    en: "Are you busy these days?",
    length: 2,
  },
  {
    ko: "빨래하기 전에 주머니를 잘 봤어야지요.",
    en: "You should have checked the pockets before washing.",
    length: 5,
  },
  {
    ko: "아는 대로 말해 주세요.",
    en: "Please tell me what you know.",
    length: 4,
  },
  {
    ko: "우유가 좋아요?",
    en: "do you like milk?",
    length: 2,
  },
  {
    ko: "집에서 극장까지 삼십 분 만에 왔습니다.",
    en: "I got from my house to the theater in 30 minutes.",
    length: 6,
  },
  {
    ko: "다른 티셔츠를 보여 드리겠습니다.",
    en: "I'll show you another t-shirt.",
    length: 4,
  },
  {
    ko: "벌써 다 끝났대요.",
    en: "It's already over.",
    length: 3,
  },
  {
    ko: "오늘 날씨가 춥지요?- 네, 정말 춥네요.",
    en: "Is it cold today? - Yes, it is really cold.",
    length: 6,
  },
  {
    ko: "사람마다 좋아하는 것이 모두 다르니까요.",
    en: "Because each person likes something different.",
    length: 5,
  },
  {
    ko: "음악을 너무 크게 듣지 마세요.",
    en: "Don't listen to music too loud.",
    length: 5,
  },
  {
    ko: "친구를 만났어요.",
    en: "I met a friend.",
    length: 2,
  },
  {
    ko: "수업이 12시 50분에 끝나요.",
    en: "Class ends at 12:50.",
    length: 4,
  },
  {
    ko: "먹고 싶은 음식이 뭐예요?",
    en: "What food do you want to eat?",
    length: 4,
  },
  {
    ko: "버스를 타고 가는 동안 음악을 들었습니다.",
    en: "I listened to music while riding the bus.",
    length: 6,
  },
  {
    ko: "이 책은 재미있고 싸요.",
    en: "This book is fun and cheap.",
    length: 4,
  },
  {
    ko: "비빔밥을 먹는데 아주 맛있어요.",
    en: "I eat bibimbap and it is very delicious.",
    length: 4,
  },
  {
    ko: "혹시 길을 잃어버릴지도 모르니까 지도도 꼭 챙기세요.",
    en: "Be sure to bring a map in case you get lost.",
    length: 7,
  },
  {
    ko: "막걸리를 마셔 봤어요?",
    en: "Have you ever drank makgeolli?",
    length: 3,
  },
  {
    ko: "명동에서 동대문까지 어떻게 가요?",
    en: "How to get from Myeongdong to Dongdaemun?",
    length: 4,
  },
  {
    ko: "사무실에서 식사를 하면서 일할 때도 많아요.",
    en: "I often work while eating at the office.",
    length: 6,
  },
  {
    ko: "지난 주에 비해서 바쁜 편이에요.",
    en: "I'm busier than last week.",
    length: 5,
  },
  {
    ko: "갈수록 추워요.",
    en: "It's getting colder.",
    length: 2,
  },
  {
    ko: "학생은 학생답게 옷을 입어야지.",
    en: "Students should dress like students.",
    length: 4,
  },
  {
    ko: "봄에 새 학기가 시작된다.",
    en: "A new semester begins in the spring.",
    length: 4,
  },
  {
    ko: "산 게 아니라 친구한테서 빌린 거예요.",
    en: "I didn't buy it, I borrowed it from a friend.",
    length: 6,
  },
  {
    ko: "아내에게 주려고 선물을 샀어요.",
    en: "I bought a present for my wife.",
    length: 4,
  },
  {
    ko: "오늘 날씨 춥지요?",
    en: "Is it cold today?",
    length: 3,
  },
  {
    ko: "곰은 겨울 동안에 겨울잠을 자요.",
    en: "Bears hibernate during the winter.",
    length: 5,
  },
  {
    ko: "일을 미뤘다가 한꺼번에 하니까 힘들 수밖에 없지요.",
    en: "It's hard to do it all at once after procrastinating.",
    length: 7,
  },
  {
    ko: "처음에는 누군지 몰랐는데 만나고 보니 초등학교 동창이었어요.",
    en: "I didn't know who he was at first, but when I met him, he was my classmate from elementary school.",
    length: 7,
  },
  {
    ko: "음식을 가지고 들어가시면 안 됩니다.",
    en: "You are not allowed to bring food in.",
    length: 5,
  },
  {
    ko: "백화점이 세일 중이에요.",
    en: "The department store is on sale.",
    length: 3,
  },
  {
    ko: "김정민 씨는 학생이에요.",
    en: "Kim Jung-min is a student.",
    length: 3,
  },
  {
    ko: "은행이 어디에 있어요?",
    en: "where is the bank?",
    length: 3,
  },
  {
    ko: "필요 없거든요!",
    en: "Because I don't need it!",
    length: 2,
  },
  {
    ko: "오늘은 비가 왔어요.",
    en: "It rained today.",
    length: 3,
  },
  {
    ko: "밖에 사람이 있는데 누구예요?",
    en: "There are people out there, who are they?",
    length: 4,
  },
  {
    ko: "감기에 걸리지 않도록 옷을 더 입으세요.",
    en: "Wear more clothes to avoid catching a cold.",
    length: 6,
  },
  {
    ko: "오늘 경기 모습은 세계적인 축구 선수답지가 않네요.",
    en: "Today's match is not like a world-class soccer player.",
    length: 7,
  },
  {
    ko: "수업 시간에 자지 마세요.",
    en: "Don't sleep in class.",
    length: 4,
  },
  {
    ko: "손님이 오면 저에게 알려 주십시오.",
    en: "When guests arrive, let me know.",
    length: 5,
  },
  {
    ko: "남동생은 스물세 살이에요.",
    en: "My younger brother is twenty-three years old.",
    length: 3,
  },
  {
    ko: "서점이 내일 문을 열지 잘 모르겠어요.",
    en: "I'm not sure if the bookstore will open tomorrow.",
    length: 6,
  },
  {
    ko: "이 영화를 보지 마세요.",
    en: "don't watch this movie",
    length: 4,
  },
  {
    ko: "한국어를 배우러 왔어요.",
    en: "I am here to learn Korean.",
    length: 3,
  },
  {
    ko: "이 그림은 파는 거예요?",
    en: "Are you selling this painting?",
    length: 4,
  },
  {
    ko: "어머니는 선생님이세요.",
    en: "mother is a teacher",
    length: 2,
  },
  {
    ko: "동생이 대학생이지요?",
    en: "Is your brother a college student?",
    length: 2,
  },
  {
    ko: "같이 농구할까요?",
    en: "Shall we play basketball together?",
    length: 2,
  },
  {
    ko: "다른 데 가요.",
    en: "go somewhere else",
    length: 3,
  },
  {
    ko: "음식을 충분히 준비하는 게 좋겠어요.",
    en: "You'd better prepare enough food.",
    length: 5,
  },
  {
    ko: "살을 빼려면 꾸준히 운동하고 음식 양을 줄이세요.",
    en: "To lose weight, exercise regularly and eat less.",
    length: 7,
  },
  {
    ko: "생일 케이크예요.",
    en: "It's a birthday cake.",
    length: 2,
  },
  {
    ko: "이 드라마 재미있어요.",
    en: "This drama is fun.",
    length: 3,
  },
  {
    ko: "안녕히 가세요.",
    en: "goodbye.",
    length: 2,
  },
  {
    ko: "저는 최경은이라고 해요.",
    en: "My name is Kyeong-eun Choi.",
    length: 3,
  },
  {
    ko: "비가 오고 나서 추워졌어요.",
    en: "It got cold after it rained.",
    length: 4,
  },
  {
    ko: "점심에 김밥을 만들어서 먹었어요.",
    en: "I made gimbap for lunch and ate it.",
    length: 4,
  },
  {
    ko: "누가 한 것 같아요?",
    en: "Who do you think did it?",
    length: 4,
  },
  {
    ko: "사귄 지 3년이 넘었어요.",
    en: "It's been over 3 years since we dated.",
    length: 4,
  },
  {
    ko: "그럴 리가 없어요.",
    en: "It can't be.",
    length: 3,
  },
  {
    ko: "개인적인 질문을 많이 해서 저를 당황스럽게 하거든요.",
    en: "It embarrasses me by asking a lot of personal questions.",
    length: 7,
  },
  {
    ko: "크리스 씨는 영어 선생님이에요.",
    en: "Chris is an English teacher.",
    length: 4,
  },
  {
    ko: "선생님이 내가 누군지도 모르실걸.",
    en: "The teacher probably doesn't even know who I am.",
    length: 4,
  },
  {
    ko: "정말 흥미진진했겠다.",
    en: "It must have been really exciting.",
    length: 2,
  },
  {
    ko: "내일 우리 영화 볼까요?",
    en: "Shall we see a movie tomorrow?",
    length: 4,
  },
  {
    ko: "회사 전기 사용을 줄이자고 하셨어요.",
    en: "You said to reduce the company's electricity use.",
    length: 5,
  },
  {
    ko: "모자가 작을 수도 있어요.",
    en: "The hat may be too small.",
    length: 4,
  },
  {
    ko: "가시는 길에 현금 인출기에서 한번 확인해 보세요.",
    en: "Check it out at the ATM on the way.",
    length: 7,
  },
  {
    ko: "여름에는 사람이 많았었어요.",
    en: "There were a lot of people in the summer.",
    length: 3,
  },
  {
    ko: "저기 있는 사람, 아는 사람이에요?",
    en: "Do you know someone over there?",
    length: 5,
  },
  {
    ko: "들어오기 전에 노크 하세요.",
    en: "Knock before entering.",
    length: 4,
  },
  {
    ko: "이 옷을 어제 샀는데 마음에 안 들어요.",
    en: "I bought this outfit yesterday, but I don't like it.",
    length: 7,
  },
  {
    ko: "나머지는 제가 할 테니까 먼저 퇴근하세요.",
    en: "I'll do the rest, so get off work first.",
    length: 6,
  },
  {
    ko: "뭐 하고 있는 중이었어요?",
    en: "what were you doing?",
    length: 4,
  },
  {
    ko: "내일은 아주 더울 거라고 해요.",
    en: "It is said that tomorrow will be very hot.",
    length: 5,
  },
  {
    ko: "저도 간다고 말해 주세요.",
    en: "Please tell me I'm going too.",
    length: 4,
  },
  {
    ko: "중국어를 맨날 공부하는데 아직 어려워요.",
    en: "I study Chinese every day, but it is still difficult.",
    length: 5,
  },
  {
    ko: "운전 할 수 있어요?",
    en: "can you drive?",
    length: 4,
  },
  {
    ko: "매일 아침 5시에 일어나서 운동을 한다고요?",
    en: "Waking up at 5:00 every morning and exercising?",
    length: 6,
  },
  {
    ko: "이 음식은 너무 매워요.",
    en: "This food is too spicy.",
    length: 4,
  },
  {
    ko: "아무도 없어요?",
    en: "anybody there?",
    length: 2,
  },
  {
    ko: "식당이 도서관 뒤에 있어요.",
    en: "The restaurant is behind the library.",
    length: 4,
  },
  {
    ko: "제이슨 씨, 콧노래도 부르고 신이 나 보이는데요.",
    en: "Jason, you are humming and you look excited.",
    length: 7,
  },
  {
    ko: "오전 9시부터 오후 5시까지 일해요.",
    en: "I work from 9 am to 5 pm.",
    length: 5,
  },
  {
    ko: "어차피 다시 올 거예요.",
    en: "I will come back anyway.",
    length: 4,
  },
  {
    ko: "중국어 배워 본 적 있어요?",
    en: "Have you ever learned Chinese?",
    length: 5,
  },
  {
    ko: "아무때나 오세요.",
    en: "Come any time.",
    length: 2,
  },
  {
    ko: "저는 부엌에서 음식을 만들어요.",
    en: "I make food in the kitchen.",
    length: 4,
  },
  {
    ko: "전혀 안 그래 보이는데요.",
    en: "It doesn't look like that at all.",
    length: 4,
  },
  {
    ko: "지하철 공사 중입니다.",
    en: "The subway is under construction.",
    length: 3,
  },
  {
    ko: "많이 걸었는데 안 피곤해요.",
    en: "I walked a lot, but I'm not tired.",
    length: 4,
  },
  {
    ko: "현정 씨가 저보다 더 잘 해요.",
    en: "Hyunjung is better than me.",
    length: 6,
  },
  {
    ko: "왜 꽃을 샀어요?",
    en: "Why did you buy flowers?",
    length: 3,
  },
  {
    ko: "영국에서 자라서 그래요.",
    en: "I grew up in England.",
    length: 3,
  },
  {
    ko: "요즘 토마토가 3,000원쯤 해요.",
    en: "Tomatoes are around 3,000 won these days.",
    length: 4,
  },
  {
    ko: "이거 할 줄 알아요?",
    en: "do you know how to do this?",
    length: 4,
  },
  {
    ko: "김치는 맛있어요.",
    en: "Kimchi is delicious.",
    length: 2,
  },
  {
    ko: "건강을 위해서 매일 운동하고 있어요.",
    en: "I exercise every day for my health.",
    length: 5,
  },
  {
    ko: "이 선생님을 만나려면 월요일에 학교로 가세요.",
    en: "Go to school on Monday to meet this teacher.",
    length: 6,
  },
  {
    ko: "시작해도 돼요?",
    en: "can i start?",
    length: 2,
  },
  {
    ko: "요즘 아버지가 피곤해하세요.",
    en: "Dad is tired these days.",
    length: 3,
  },
  {
    ko: "지난 주에 이야기하던 거예요.",
    en: "That's what we were talking about last week.",
    length: 4,
  },
  {
    ko: "크리스마스에 눈이 왔으면 좋겠어요.",
    en: "I hope it snows for Christmas.",
    length: 4,
  },
  {
    ko: "여자 친구가 싫어할까 봐서 담배도 안 피워요.",
    en: "I don't even smoke because I'm afraid my girlfriend won't like it.",
    length: 7,
  },
  {
    ko: "민희가 자기는 오늘 못 온다고 말했어요.",
    en: "Minhee said she couldn't come today.",
    length: 6,
  },
  {
    ko: "이사하는 데 얼마 들었어요?",
    en: "How much did it cost you to move?",
    length: 4,
  },
  {
    ko: "그거 한국어로 말할 수 있어요?",
    en: "can you say that in korean?",
    length: 5,
  },
  {
    ko: "이거 일본에서 샀는데 선물이에요.",
    en: "I bought this in Japan and it's a gift.",
    length: 4,
  },
  {
    ko: "저기 재준 씨가 와요.",
    en: "Jaejoon is here.",
    length: 4,
  },
  {
    ko: "타완이 연락하기로 했는데 깜빡 잊었나 봐.",
    en: "Tawan was supposed to contact you, but he forgot.",
    length: 6,
  },
  {
    ko: "세계에 홍콩만큼 야경이 아름다운 도시는 없습니다.",
    en: "There is no other city in the world with as beautiful night views as Hong Kong.",
    length: 6,
  },
  {
    ko: "한국 친구가 많은가요?",
    en: "Do you have many Korean friends?",
    length: 3,
  },
  {
    ko: "경은은 오늘도 아침 8시에 일어난다.",
    en: "Kyeong-eun wakes up at 8:00 in the morning today.",
    length: 5,
  },
  {
    ko: "친구가 오해하지 않게 잘 이야기해 보세요.",
    en: "Talk to your friends so that they don't misunderstand.",
    length: 6,
  },
  {
    ko: "지하철을 타세요.",
    en: "Take the subway.",
    length: 2,
  },
  {
    ko: "한국 영화 자주 봐요.",
    en: "I often watch Korean movies.",
    length: 4,
  },
  {
    ko: "수업이 끝나자마자 학생들은 교실을 나갔어요.",
    en: "As soon as class was over, the students left the classroom.",
    length: 5,
  },
  {
    ko: "올해부터는 교통신호를 잘 지켜야지요.",
    en: "From this year on, you have to obey the traffic signals carefully.",
    length: 4,
  },
  {
    ko: "이거 가짜일 수도 있어요.",
    en: "It could be fake.",
    length: 4,
  },
  {
    ko: "그럼, 인사동에 가 보시겠어요?",
    en: "Then, would you like to go to Insadong?",
    length: 4,
  },
  {
    ko: "언제부터 공무원 시험을 준비할 거예요?",
    en: "When will you start preparing for the civil service exam?",
    length: 5,
  },
  {
    ko: "한 사람 앞에 세 장씩 나눠 드려.",
    en: "Hand out three cards in front of each person.",
    length: 7,
  },
  {
    ko: "독일에서 2년쯤 살았어요.",
    en: "I lived in Germany for about 2 years.",
    length: 3,
  },
  {
    ko: "약국에 약을 사러 가요.",
    en: "I go to the pharmacy to buy medicine.",
    length: 4,
  },
  {
    ko: "교실에들 있어요.",
    en: "They are in the classroom.",
    length: 2,
  },
  {
    ko: "그럼, 간장이라도 좀 넣지 그래요?",
    en: "Then, why don't you add some soy sauce?",
    length: 5,
  },
  {
    ko: "처음 한국에 도착했을 때 기분이 어땠어요?",
    en: "How did you feel when you first arrived in Korea?",
    length: 6,
  },
  {
    ko: "생각보다 비싸구나.",
    en: "It's more expensive than you think.",
    length: 2,
  },
  {
    ko: "집에 들어오니까 맛있는 냄새가 나요.",
    en: "When I come home, it smells delicious.",
    length: 5,
  },
  {
    ko: "오늘 선미가 못 올 것 같습니다.",
    en: "It looks like Sunmi won't be able to come today.",
    length: 6,
  },
  {
    ko: "식당에서 밥을 먹을 거예요.",
    en: "I will eat at the restaurant.",
    length: 4,
  },
  {
    ko: "걱정하지 말고 그냥 해 봐요.",
    en: "Don't worry, just do it.",
    length: 5,
  },
  {
    ko: "여동생한테 책을 줬어요.",
    en: "I gave the book to my sister.",
    length: 3,
  },
  {
    ko: "여기에 이름과 전화번호를 쓰세요.",
    en: "Write your name and phone number here.",
    length: 4,
  },
  {
    ko: "금방 들어오실 테니까 잠깐만 기다리세요.",
    en: "He'll be back right away, so wait a minute.",
    length: 5,
  },
  {
    ko: "아침에 일어나니까 선물이 있었어요.",
    en: "When I woke up in the morning, there was a present.",
    length: 4,
  },
  {
    ko: "좀 더 얌전한 옷으로 갈아입어.",
    en: "Change into more modest clothes.",
    length: 5,
  },
  {
    ko: "네, 버스로 한 시간쯤 걸려요.",
    en: "Yes, it takes about an hour by bus.",
    length: 5,
  },
  {
    ko: "아니, 안 괜찮아.",
    en: "no, it's not okay",
    length: 3,
  },
  {
    ko: "추우니까 창문 좀 닫아 주세요.",
    en: "It's cold, so please close the window.",
    length: 5,
  },
  {
    ko: "부모님을 위해서 돈을 모았어요.",
    en: "I saved money for my parents.",
    length: 4,
  },
  {
    ko: "날씨가 좋은데 산에 갈까요?",
    en: "The weather is nice. Shall we go to the mountains?",
    length: 4,
  },
  {
    ko: "기다리실 동안 이 잡지를 보세요.",
    en: "Look at this magazine while you wait.",
    length: 5,
  },
  {
    ko: "한국 팬들을 만나러 한국에 왔어요.",
    en: "I came to Korea to meet Korean fans.",
    length: 5,
  },
  {
    ko: "도넛 좀 드시겠어요?",
    en: "Would you like some donuts?",
    length: 3,
  },
  {
    ko: "네, 외국 사람이지만 한국말을 잘해요.",
    en: "Yes, I am a foreigner, but I speak Korean well.",
    length: 5,
  },
  {
    ko: "머리를 짧게 잘랐어요.",
    en: "I cut my hair short.",
    length: 3,
  },
  {
    ko: "아무것도 안 했어요.",
    en: "Didn't do anything.",
    length: 3,
  },
  {
    ko: "커피 한잔하실래요?",
    en: "Would you like a cup of coffee?",
    length: 2,
  },
  {
    ko: "이쪽이 더 빠른가 봐요.",
    en: "I guess this one is faster.",
    length: 4,
  },
  {
    ko: "구두나 가방을 살 거예요.",
    en: "I will buy shoes or a bag.",
    length: 4,
  },
  {
    ko: "비싸지 않습니다만 잃어버리면 안 되니까 보험에 들게요.",
    en: "It's not expensive, but I'll insure it because I don't want to lose it.",
    length: 7,
  },
  {
    ko: "제가 20살이었으면 좋겠어요.",
    en: "I wish I was 20.",
    length: 3,
  },
  {
    ko: "마이클 씨는 무슨 일로 한국에 왔어요?",
    en: "Michael, why did you come to Korea?",
    length: 6,
  },
  {
    ko: "내일 친구 생일인데 선물을 아직 못 샀어요.",
    en: "It's my friend's birthday tomorrow and I haven't bought a present yet.",
    length: 7,
  },
  {
    ko: "저 좀 도와주시겠어요?",
    en: "could you help me?",
    length: 3,
  },
  {
    ko: "이따가 집에 가실 때 저한테 들르세요.",
    en: "Stop by me later when you get home.",
    length: 6,
  },
  {
    ko: "바쁠수록 잠을 많이 자야 돼요.",
    en: "The busier you are, the more you need to sleep.",
    length: 5,
  },
  {
    ko: "도와 줄 수 있어요?",
    en: "can you help me",
    length: 4,
  },
  {
    ko: "샐리는 텔레비전을 보고 저는 책을 읽어요.",
    en: "Sally watches TV and I read.",
    length: 6,
  },
  {
    ko: "김치가 싸고 맛있어요.",
    en: "Kimchi is cheap and delicious.",
    length: 3,
  },
  {
    ko: "손님 여러분은 모두 자리에 앉아 주시기 바랍니다.",
    en: "All guests, please take your seats.",
    length: 7,
  },
  {
    ko: "자주 가는 카페 있어요?",
    en: "Is there a cafe you often go to?",
    length: 4,
  },
  {
    ko: "컴퓨터를 많이 하면 눈이 아파요.",
    en: "Working on the computer a lot hurts my eyes.",
    length: 5,
  },
  {
    ko: "지금 어떤 일을 하고 계세요?",
    en: "What are you doing?",
    length: 5,
  },
  {
    ko: "술을 마셨으니까 운전하지 마세요.",
    en: "Don't drive because you've been drinking.",
    length: 4,
  },
  {
    ko: "밖으로 나갔다가 다른 쪽으로 다시 들어가셔야 합니다.",
    en: "You have to go out and go back in the other side.",
    length: 7,
  },
  {
    ko: "누가 전화했어요?",
    en: "who called?",
    length: 2,
  },
  {
    ko: "컴퓨터가 교실마다 있어요?",
    en: "Are there computers in every classroom?",
    length: 3,
  },
  {
    ko: "어디를 구경할 생각이에요?",
    en: "Where are you planning to visit?",
    length: 3,
  },
  {
    ko: "여기에 그런 지갑은 없습니다.",
    en: "There is no such wallet here.",
    length: 4,
  },
  {
    ko: '예수님은 "서로 사랑하세요.',
    en: 'Jesus said, "Love one another.',
    length: 3,
  },
  {
    ko: "아기가 자는 동안 가게 좀 다녀오겠습니다.",
    en: "I'll go to the store while the baby sleeps.",
    length: 6,
  },
  {
    ko: "친구랑 같이 영화 봤어요.",
    en: "I watched a movie with my friend.",
    length: 4,
  },
  {
    ko: "부탁을 많이 하는 반면에 도움도 많이 줘요.",
    en: "While asking for a lot, he also helps a lot.",
    length: 7,
  },
  {
    ko: "두 가족씩 한 조로 만들어 진행하겠습니다.",
    en: "We will make two families into one group.",
    length: 6,
  },
  {
    ko: "열두 시 오십 분이에요.",
    en: "It's twelve and fifty.",
    length: 4,
  },
  {
    ko: "이 노래 들어 봤어요?",
    en: "have you heard this song?",
    length: 4,
  },
  {
    ko: "벌써 가자니요?",
    en: "Are you leaving already?",
    length: 2,
  },
  {
    ko: "그 사람 부인은 한국 사람이라고 합니다.",
    en: "His wife is said to be Korean.",
    length: 6,
  },
  {
    ko: "일본에 친구가 있어요.",
    en: "I have a friend in Japan.",
    length: 3,
  },
  {
    ko: "이것밖에 없어요?",
    en: "Is this all there is?",
    length: 2,
  },
  {
    ko: "사람들이 지나가도록 비켜 주세요.",
    en: "Get out of the way to let people pass.",
    length: 4,
  },
  {
    ko: "형은 크지만 동생은 작아요.",
    en: "The older brother is big, but the younger brother is smaller.",
    length: 4,
  },
  {
    ko: "아는 척하지 마세요.",
    en: "Don't pretend you know.",
    length: 3,
  },
  {
    ko: "수영하기 전에 준비운동을 해요.",
    en: "I warm up before swimming.",
    length: 4,
  },
  {
    ko: "아이들이 배고파해요.",
    en: "The children are hungry.",
    length: 2,
  },
  {
    ko: "모든 일을 전문가답게 잘 처리하거든요.",
    en: "He handles everything professionally.",
    length: 5,
  },
  {
    ko: "너무 배가 불러요.",
    en: "I'm so full.",
    length: 3,
  },
  {
    ko: "오늘 택시로 왔어요?",
    en: "Did you come by taxi today?",
    length: 3,
  },
  {
    ko: "내일 다시 추워질 거예요.",
    en: "It will be cold again tomorrow.",
    length: 4,
  },
  {
    ko: "내일 무엇을 입을까요?",
    en: "What shall I wear tomorrow?",
    length: 3,
  },
  {
    ko: "문을 닫으세요.",
    en: "Close the door.",
    length: 2,
  },
  {
    ko: "요즘 볼 만한 뮤지컬 있어요?",
    en: "Are there any musicals worth watching these days?",
    length: 5,
  },
  {
    ko: "이 책하고 저 책 중에서.",
    en: "Between this book and that book.",
    length: 5,
  },
  {
    ko: "저 대신에 가고 싶은 사람 있어요?",
    en: "Is there anyone who wants to go instead of me?",
    length: 6,
  },
  {
    ko: "아버지만큼 키가 커요.",
    en: "He is as tall as his father.",
    length: 3,
  },
  {
    ko: "저 먼저 가도 괜찮아요?",
    en: "Is it okay if I go first?",
    length: 4,
  },
  {
    ko: "저에게 여자 친구가 있습니다.",
    en: "I have a girlfriend.",
    length: 4,
  },
  {
    ko: "피곤하기 때문입니다.",
    en: "It's because you're tired.",
    length: 2,
  },
  {
    ko: "저기 기차 지나간다.",
    en: "There the train passes.",
    length: 3,
  },
  {
    ko: "저는 아침 8시에 일어나요.",
    en: "I wake up at 8 in the morning.",
    length: 4,
  },
  {
    ko: "5분만 기다려 주세요.",
    en: "Please wait 5 minutes.",
    length: 3,
  },
  {
    ko: "한국말을 할 수 있어요.",
    en: "I can speak Korean.",
    length: 4,
  },
  {
    ko: "책상 오른쪽에 옷걸이가 있어요.",
    en: "There is a coat hanger to the right of the desk.",
    length: 4,
  },
  {
    ko: "내일까지 일을 끝내야 돼요.",
    en: "I have to finish the work by tomorrow.",
    length: 4,
  },
  {
    ko: "내일 등산 갈 때 누가 카메라를 가져와요?",
    en: "Who will bring a camera to the mountain climbing tomorrow?",
    length: 7,
  },
  {
    ko: "오늘 학교에 캐럴 씨만 왔어요.",
    en: "Only Carol came to school today.",
    length: 5,
  },
  {
    ko: "한국어 조금밖에 못 해요.",
    en: "I can only speak a little Korean.",
    length: 4,
  },
  {
    ko: "학교에서 집까지 걸어왔어요.",
    en: "I walked home from school.",
    length: 3,
  },
  {
    ko: "먹기 전에 돈을 내야 해요.",
    en: "You have to pay before eating.",
    length: 5,
  },
  {
    ko: "들어가면 안 돼요.",
    en: "can't go in",
    length: 3,
  },
  {
    ko: "신문을 읽으려고 책상 앞에 앉았습니다.",
    en: "I sat down at my desk to read the newspaper.",
    length: 5,
  },
  {
    ko: "처음 출연한 연극으로 상을 받다니.",
    en: "To receive an award for your first play.",
    length: 5,
  },
  {
    ko: "아니면 다른 거 살 거예요?",
    en: "Or are you going to buy something else?",
    length: 5,
  },
  {
    ko: "토끼를 5년 동안 길렀어요.",
    en: "I raised rabbits for 5 years.",
    length: 4,
  },
  {
    ko: "정민 씨 어머니께서 맛있는 음식을 많이 준비하셨어요.",
    en: "Jeongmin's mother prepared a lot of delicious food.",
    length: 7,
  },
  {
    ko: "아직 10시예요.",
    en: "It's still 10 o'clock.",
    length: 2,
  },
  {
    ko: "응, 그래야겠다.",
    en: "yep, that should be it",
    length: 2,
  },
  {
    ko: "차 마실래요?",
    en: "Would you like some tea?",
    length: 2,
  },
  {
    ko: "사람들이 알게 되어 있어요.",
    en: "People are getting to know",
    length: 4,
  },
  {
    ko: "유키는 지금 집에 있다.",
    en: "Yuki is at home now.",
    length: 4,
  },
  {
    ko: "이거 읽을 수 있어요?",
    en: "can you read this?",
    length: 4,
  },
  {
    ko: "시월 십일 일이에요.",
    en: "It's the tenth of October.",
    length: 3,
  },
  {
    ko: "아까 효진 씨 만났거든요.",
    en: "I met Hyojin earlier.",
    length: 4,
  },
  {
    ko: "지금 만드는 게 뭐예요?",
    en: "what are you making now?",
    length: 4,
  },
  {
    ko: "이거 안 잘라져요.",
    en: "this doesn't cut",
    length: 3,
  },
  {
    ko: "초등학교 때 친구들을 자주 만나요?",
    en: "Do you often meet your friends from elementary school?",
    length: 5,
  },
  {
    ko: "어떻게 여기에 오게 됐어요?",
    en: "How did you end up here?",
    length: 4,
  },
  {
    ko: "천천히들 가세요!",
    en: "Go slow!",
    length: 2,
  },
  {
    ko: "누가 정민 씨 전화번호를 알까요?",
    en: "Does anyone know Jungmin's phone number?",
    length: 5,
  },
  {
    ko: "일을 하기 싫습니다.",
    en: "I don't like to work.",
    length: 3,
  },
  {
    ko: "친구에게 줄 선물을 사려고 해요.",
    en: "I want to buy a present for a friend.",
    length: 5,
  },
  {
    ko: "재미없는 영화를 봤어요.",
    en: "I watched a boring movie.",
    length: 3,
  },
  {
    ko: "회사를 위해서.",
    en: "for the sake of the company.",
    length: 2,
  },
  {
    ko: "지금 두 시예요.",
    en: "It's two o'clock now.",
    length: 3,
  },
  {
    ko: "도서관에 가서 공부했어요.",
    en: "I went to the library and studied.",
    length: 3,
  },
  {
    ko: "한국 사람은 숟가락으로 밥을 먹어요.",
    en: "Koreans eat rice with a spoon.",
    length: 5,
  },
  {
    ko: "뭐로 만들었어요?",
    en: "What is it made of?",
    length: 2,
  },
  {
    ko: "성함이 어떻게 되세요?",
    en: "What's your name?",
    length: 3,
  },
  {
    ko: "캐럴 씨가 오늘 나올까요?",
    en: "Will Mr. Carol come out today?",
    length: 4,
  },
  {
    ko: "저도 거기 안 가 봤어요.",
    en: "I haven't been there either.",
    length: 5,
  },
  {
    ko: "한국말을 잘하고 싶어요.",
    en: "I want to speak Korean well.",
    length: 3,
  },
  {
    ko: "아마 내일부터 일요일까지 비가 내릴 거예요.",
    en: "It will probably rain from tomorrow to Sunday.",
    length: 6,
  },
  {
    ko: "여덟 시에 밥을 먹어요.",
    en: "I eat at eight o'clock.",
    length: 4,
  },
  {
    ko: "저는 옷에 별로 신경 쓰지 않는 편이거든요.",
    en: "I tend not to pay much attention to clothes.",
    length: 7,
  },
  {
    ko: "방을 청소했어요.",
    en: "I cleaned my room.",
    length: 2,
  },
  {
    ko: "내년에 대학교에 들어가려고 공부하고 있어요.",
    en: "I am studying to enter university next year.",
    length: 5,
  },
  {
    ko: "살을 빼려고 매일 세 시간씩 운동을 해요.",
    en: "I exercise for three hours every day to lose weight.",
    length: 7,
  },
  {
    ko: "재준 씨가 캐럴 씨에게 선물을 줍니다.",
    en: "Jaejoon gives a gift to Carol.",
    length: 6,
  },
  {
    ko: "담배 끊은 지 한 달 되었어요.",
    en: "It's been a month since I quit smoking.",
    length: 6,
  },
  {
    ko: "그때 선생님께서도 걱정 많이 하셨었어.",
    en: "At that time, the teacher was also very worried.",
    length: 5,
  },
  {
    ko: "저는 오징어를 먹지 않아요.",
    en: "I don't eat squid.",
    length: 4,
  },
  {
    ko: "일하다가 잠깐 쉬고 있어요.",
    en: "I'm taking a break from work.",
    length: 4,
  },
  {
    ko: "눈이 올 리가 없어요.",
    en: "It can't snow.",
    length: 4,
  },
  {
    ko: "이사했다고 들었어요.",
    en: "I heard you moved.",
    length: 2,
  },
  {
    ko: "좋은 이름을 지을 거예요.",
    en: "I will give you a good name.",
    length: 4,
  },
  {
    ko: "제가 전화 받을게요.",
    en: "I'll answer the call.",
    length: 3,
  },
  {
    ko: "눈이 올 것 같아요.",
    en: "I think it will snow.",
    length: 4,
  },
  {
    ko: "집에다가 두고 왔어요.",
    en: "I left it at home.",
    length: 3,
  },
  {
    ko: "어느 정도 크기를 찾으십니까?",
    en: "What size are you looking for?",
    length: 4,
  },
  {
    ko: "밤에 전화해도 돼요?",
    en: "Can I call you at night?",
    length: 3,
  },
  {
    ko: "조용히 하라고 말해 주세요.",
    en: "tell me to be quiet",
    length: 4,
  },
  {
    ko: "하미 씨, 지금 울어요?",
    en: "Hami, are you crying now?",
    length: 4,
  },
  {
    ko: "이거 정말 할 거예요?",
    en: "Are you really going to do this?",
    length: 4,
  },
  {
    ko: "조사 결과에 따르면 등산을 제일 많이 한대요.",
    en: "According to the results of the survey, they say that they do mountain climbing the most.",
    length: 7,
  },
  {
    ko: "저도 물 주세요.",
    en: "water me too",
    length: 3,
  },
  {
    ko: "저에게 한국 영화 DVD가 많이 있어요.",
    en: "I have a lot of Korean movie DVDs.",
    length: 6,
  },
  {
    ko: "요즘 공부하고 있는 외국어는 일본어예요.",
    en: "The foreign language I am studying these days is Japanese.",
    length: 5,
  },
  {
    ko: "멀어서 잘 안 보이지만, “3”처럼 보이네요.",
    en: "It's hard to see because it's far away, but it looks like \"3\".",
    length: 6,
  },
  {
    ko: "왜 그런 것을 물어요?",
    en: "why do you ask that?",
    length: 4,
  },
  {
    ko: "가을 하늘이 정말 파래요.",
    en: "The autumn sky is really blue.",
    length: 4,
  },
  {
    ko: "동대문에 가려면 지하철 4호선을 타세요.",
    en: "To get to Dongdaemun, take subway line 4.",
    length: 5,
  },
  {
    ko: "그렇지만 정말 커요.",
    en: "But it's really big.",
    length: 3,
  },
  {
    ko: "영어가 안 돼서 걱정이에요.",
    en: "I'm worried because I can't speak English.",
    length: 4,
  },
  {
    ko: "여기에서 명동까지 가는 데 얼마나 걸려요?",
    en: "How long does it take to get from here to Myeongdong?",
    length: 6,
  },
  {
    ko: "일본어보다 한국어가 훨씬 더 쉬워요.",
    en: "Korean is much easier than Japanese.",
    length: 5,
  },
  {
    ko: "석진 씨는 제가 전화를 해도 안 받아요.",
    en: "Seokjin doesn't answer even when I call.",
    length: 7,
  },
  {
    ko: "저는 몇 살이냐고 물어보는 게 제일 싫어요.",
    en: "I hate being asked how old I am.",
    length: 7,
  },
  {
    ko: "내가 애기가 있어요.",
    en: "i have a baby",
    length: 3,
  },
  {
    ko: "그 구두는 안 예뻐요.",
    en: "Those shoes aren't pretty.",
    length: 4,
  },
  {
    ko: "여기는 날씨만 좋은 게 아니라 사람들도 친절해요.",
    en: "Not only is the weather nice here, but the people are friendly too.",
    length: 7,
  },
  {
    ko: "여자 친구 생일이라서 선물을 사야 돼요.",
    en: "It's my girlfriend's birthday, so I need to buy a present.",
    length: 6,
  },
  {
    ko: "2년 후에 차를 살 거예요.",
    en: "I will buy a car in 2 years.",
    length: 5,
  },
  {
    ko: "정말 그럴 수도 있어요.",
    en: "It really could be.",
    length: 4,
  },
  {
    ko: "군인은 나라를 위해서 일하는 사람입니다.",
    en: "Soldiers are people who work for the country.",
    length: 5,
  },
  {
    ko: "그 사람은 내일 다시 올 거라고 했어요.",
    en: "He said he would come back tomorrow.",
    length: 7,
  },
  {
    ko: "한국 노래 듣기를 좋아해요.",
    en: "I like listening to Korean songs.",
    length: 4,
  },
  {
    ko: "눈이 나쁘군요.",
    en: "You have bad eyesight.",
    length: 2,
  },
  {
    ko: "도착하자마자 전화할게요.",
    en: "I'll call you as soon as I arrive.",
    length: 2,
  },
  {
    ko: "방학 때 아르바이트를 해요.",
    en: "I work part-time during vacation.",
    length: 4,
  },
  {
    ko: "바빠도 아침 식사를 꼭 해야 해요.",
    en: "Even if you are busy, you must have breakfast.",
    length: 6,
  },
  {
    ko: "피자도 먹고 영화도 봤어요.",
    en: "I ate pizza and watched a movie.",
    length: 4,
  },
  {
    ko: "그러니까 운동도 꾸준히 하세요.",
    en: "So, keep exercising.",
    length: 4,
  },
  {
    ko: "누가 가라고 했어요?",
    en: "Who told you to go?",
    length: 3,
  },
  {
    ko: "서울에서 제주도까지 비행기로 가요.",
    en: "I go to Jeju Island by plane from Seoul.",
    length: 4,
  },
  {
    ko: "버스를 타지 마요.",
    en: "don't take the bus",
    length: 3,
  },
  {
    ko: "의자에 앉을 때 조심하세요.",
    en: "Be careful when sitting in a chair.",
    length: 4,
  },
  {
    ko: "일이 많아서 회사에서 일해야 됐어요.",
    en: "I had to work at a company because I had a lot of work.",
    length: 5,
  },
  {
    ko: "옷장에 옷이 이렇게 많은데도 또 옷을 산다고?",
    en: "Buying more clothes when you have so many clothes in your closet?",
    length: 7,
  },
  {
    ko: "일 년에 겨우 서너 번뿐인데요, 뭐.",
    en: "Only three or four times a year, well.",
    length: 6,
  },
  {
    ko: "한국말은 어렵지만 재미있어요.",
    en: "Korean is difficult but fun.",
    length: 3,
  },
  {
    ko: "기차는 한 시간마다 있어요.",
    en: "The train is every hour.",
    length: 4,
  },
  {
    ko: "크게 말해 보십시오.",
    en: "Say it out loud.",
    length: 3,
  },
  {
    ko: "어디에서 왔어요?",
    en: "Where are you from?",
    length: 2,
  },
  {
    ko: "그래도 재미있어요.",
    en: "It's fun though.",
    length: 2,
  },
  {
    ko: "만나게 되면 말해 주세요.",
    en: "Please tell me when you meet.",
    length: 4,
  },
  {
    ko: "이게 여기 있을 줄 몰랐어요.",
    en: "I didn't know this would be here.",
    length: 5,
  },
  {
    ko: "오늘 아침에 늦게 일어났어요.",
    en: "I woke up late this morning.",
    length: 4,
  },
  {
    ko: "예전에 테니스를 못 친다고 했던 것 같아요.",
    en: "I think I said before that I couldn't play tennis.",
    length: 7,
  },
  {
    ko: "저는 노래를 부르지 못해요.",
    en: "i can't sing",
    length: 4,
  },
  {
    ko: "요즘 무엇을 배워요?",
    en: "What are you learning these days?",
    length: 3,
  },
  {
    ko: "별로 안 비싸요.",
    en: "Not very expensive.",
    length: 3,
  },
  {
    ko: "승리 공원에 가려면 이 버스를 타면 됩니다.",
    en: "You can take this bus to get to Victory Park.",
    length: 7,
  },
  {
    ko: "저는 친구랑 수다떠는 거를 좋아해요.",
    en: "I like chatting with my friends.",
    length: 5,
  },
  {
    ko: "나는 그 여자를 사랑하게 되었습니다.",
    en: "I fell in love with her.",
    length: 5,
  },
  {
    ko: "덜 비싼 것 없어요?",
    en: "Anything less expensive?",
    length: 4,
  },
  {
    ko: "한국에 계실 동안 친구를 많이 사귀세요.",
    en: "Make a lot of friends while you are in Korea.",
    length: 6,
  },
  {
    ko: "한 달만 있으면 휴가예요.",
    en: "I'm on vacation for a month.",
    length: 4,
  },
  {
    ko: "사과가 비쌌어요.",
    en: "Apples were expensive.",
    length: 2,
  },
  {
    ko: "친구들과 같이 삼겹살을 구워 먹을까 해요.",
    en: "I'm thinking of grilling pork belly with my friends.",
    length: 6,
  },
  {
    ko: "자리를 안내해 드리세요.",
    en: "Please guide me to your seat.",
    length: 3,
  },
  {
    ko: "아직 안 했어요.",
    en: "I haven't done it yet.",
    length: 3,
  },
  {
    ko: "오늘도 일해요?",
    en: "Are you working today?",
    length: 2,
  },
  {
    ko: "밥을 안 먹어서 배고파요.",
    en: "I'm hungry because I haven't eaten.",
    length: 4,
  },
  {
    ko: "머리 모양을 바꾸니까 훨씬 어려 보이네요.",
    en: "I look much younger because I changed the shape of my hair.",
    length: 6,
  },
  {
    ko: "감독이 그렇게 가르치나?",
    en: "Does the director teach you that?",
    length: 3,
  },
  {
    ko: "아버지는 의사세요.",
    en: "father is a doctor",
    length: 2,
  },
  {
    ko: "누가 방을 청소했어요?- 저요.",
    en: "Who cleaned the room?- Me.",
    length: 4,
  },
  {
    ko: "어제 친구를 만나기는 했는데 금방 헤어졌어요.",
    en: "I met a friend yesterday, but broke up soon.",
    length: 6,
  },
  {
    ko: "제가 종이에 써 드릴게요.",
    en: "I'll write it on a piece of paper.",
    length: 4,
  },
  {
    ko: "미안하지만 이렇게 할 수밖에 없어요.",
    en: "I'm sorry, but I have no choice but to do this.",
    length: 5,
  },
  {
    ko: "아무리 미인이라도.",
    en: "no matter how beautiful",
    length: 2,
  },
  {
    ko: "도시락을 언제 싸 놓았어요?",
    en: "When did you pack your lunch?",
    length: 4,
  },
  {
    ko: "어려워서 다섯 쪽밖에 못 읽었어요.",
    en: "It was so difficult that I could only read five pages.",
    length: 5,
  },
  {
    ko: "밥 먹다가 전화를 받았어요.",
    en: "I got a phone call while eating.",
    length: 4,
  },
  {
    ko: "결혼하면 어디에서 살 거예요?",
    en: "Where will you live when you get married?",
    length: 4,
  },
  {
    ko: "네, 모두 오천육백 원입니다.",
    en: "Yes, all of them are 5,600 won.",
    length: 4,
  },
  {
    ko: "근처 백화점에서 세일을 해서 그런지 차가 많네요.",
    en: "There are a lot of cars, maybe because it was on sale at a nearby department store.",
    length: 7,
  },
  {
    ko: "운전을 안 배웠어요.",
    en: "I didn't learn to drive.",
    length: 3,
  },
  {
    ko: "아직 보내지 마세요.",
    en: "Don't send it yet.",
    length: 3,
  },
  {
    ko: "무슨 차를 마셔요?",
    en: "What tea do you drink?",
    length: 3,
  },
  {
    ko: "똑똑하고 예뻐요.",
    en: "smart and pretty",
    length: 2,
  },
  {
    ko: "경은 씨한테 말하지 마세요.",
    en: "Don't tell Kyeong-eun.",
    length: 4,
  },
  {
    ko: "혼자서도 되겠어요?",
    en: "Can I be alone?",
    length: 2,
  },
  {
    ko: "이거 좋은데요!",
    en: "This is good!",
    length: 2,
  },
  {
    ko: "이거 뭔지 알아요?",
    en: "Do you know what this is?",
    length: 3,
  },
  {
    ko: "이건 만들기 어려워요.",
    en: "It's hard to make.",
    length: 3,
  },
  {
    ko: "저는 지금 밥을 먹기 싫습니다.",
    en: "I don't want to eat right now.",
    length: 5,
  },
  {
    ko: "그래서 학교에 못 왔어요.",
    en: "So I couldn't come to school.",
    length: 4,
  },
  {
    ko: "술을 너무 많이 마셔서 머리가 아파요.",
    en: "My head hurts from drinking too much.",
    length: 6,
  },
  {
    ko: "한강에서 배를 타지 않을래요?",
    en: "Why don't you take a boat on the Han River?",
    length: 4,
  },
  {
    ko: "머리부터 발끝까지.",
    en: "From head to toe.",
    length: 2,
  },
  {
    ko: "영원한 비밀은 없어요.",
    en: "There are no eternal secrets.",
    length: 3,
  },
  {
    ko: "방을 정리해 놓고 놀아야지.",
    en: "I need to tidy up my room and play.",
    length: 4,
  },
  {
    ko: "방해되지 않게 이어폰을 낄게요.",
    en: "I'll put on earphones so I don't get in the way.",
    length: 4,
  },
  {
    ko: "제 친구가 다니는 회사는 서울에 있어요.",
    en: "The company my friend works for is in Seoul.",
    length: 6,
  },
  {
    ko: "선생님께서 뭐라고 하셨어요?",
    en: "what did the teacher say?",
    length: 3,
  },
  {
    ko: "오늘 회사 동료의 생일 파티가 있거든요.",
    en: "I have a birthday party for my co-worker today.",
    length: 6,
  },
  {
    ko: "일하고 싶어요.",
    en: "I want to work.",
    length: 2,
  },
  {
    ko: "이 골목은 막혀 있는 것 같아요.",
    en: "I think this alley is blocked.",
    length: 6,
  },
  {
    ko: "유명한 커피숍답게 모든 커피가 맛있더라고요.",
    en: "Like a famous coffee shop, all the coffees are delicious.",
    length: 5,
  },
  {
    ko: "우리는 내일 아침에 만나기로 했습니다.",
    en: "We agreed to meet tomorrow morning.",
    length: 5,
  },
  {
    ko: "전혀 안 바빠요.",
    en: "I'm not busy at all.",
    length: 3,
  },
  {
    ko: "부모님 말씀 잘 들어라.",
    en: "Listen carefully to your parents.",
    length: 4,
  },
  {
    ko: "병이 심각해서 수술하지 않으면 안 돼요.",
    en: "The disease is so serious that it has to be operated.",
    length: 6,
  },
  {
    ko: "할 수는 있는데 조건이 있어요.",
    en: "You can, but there are conditions.",
    length: 5,
  },
  {
    ko: "목이 좀 아픈 데다가 콧물도 나요.",
    en: "I have a sore throat and a runny nose.",
    length: 6,
  },
  {
    ko: "다시 할게요.",
    en: "I'll do it again.",
    length: 2,
  },
  {
    ko: "제가 뭐라고 말할 줄 알았어요?",
    en: "Did you know what I would say?",
    length: 5,
  },
  {
    ko: "오늘은 무슨 요일이에요?",
    en: "What day is it today?",
    length: 3,
  },
  {
    ko: "걷는 것 좋아해요.",
    en: "I like to walk.",
    length: 3,
  },
  {
    ko: "안 마셔도 돼요.",
    en: "You don't have to drink it.",
    length: 3,
  },
  {
    ko: "커피 마실래요?",
    en: "Would you like some coffee?",
    length: 2,
  },
  {
    ko: "어제 집에 갔을 때 아무도 없었어요.",
    en: "When I went home yesterday, no one was there.",
    length: 6,
  },
  {
    ko: "제일 좋은 것.",
    en: "The best one.",
    length: 3,
  },
  {
    ko: "한국어가 너무 재미있어서 매일 공부하고 있어요.",
    en: "I study Korean every day because it is so much fun.",
    length: 6,
  },
  {
    ko: "손님이 세 분 오셨어요.",
    en: "Three guests have arrived.",
    length: 4,
  },
  {
    ko: "학교 앞에 광고가 붙어 있었어요.",
    en: "There was an advertisement in front of the school.",
    length: 5,
  },
  {
    ko: "저는 주말에 아무 때나 괜찮으니까 전화 주세요.",
    en: "I'm fine any time on the weekend, so please call me.",
    length: 7,
  },
  {
    ko: "그래서 돈이 없어요.",
    en: "So no money.",
    length: 3,
  },
  {
    ko: "지수 씨한테 잘 어울려요.",
    en: "It suits Jisoo well.",
    length: 4,
  },
  {
    ko: "오늘은 집에서 공부해야 돼요.",
    en: "I have to study at home today.",
    length: 4,
  },
  {
    ko: "같이 공부해요.",
    en: "We study together.",
    length: 2,
  },
  {
    ko: "저녁에 영화 볼래요.",
    en: "I want to see a movie in the evening",
    length: 3,
  },
  {
    ko: "아무 말도 안 했죠?",
    en: "Didn't you say anything?",
    length: 4,
  },
  {
    ko: "30분 후에 다시 전화해 주시겠어요?",
    en: "Could you call me back in 30 minutes?",
    length: 5,
  },
  {
    ko: "나이에 비해서 키가 커요.",
    en: "I am tall for my age.",
    length: 4,
  },
  {
    ko: "한국말을 잘해야 한국에서 살기가 편하니까요.",
    en: "Living in Korea is comfortable when you speak Korean well.",
    length: 5,
  },
  {
    ko: "이거 여기서 팔면 안 돼요?",
    en: "Can't we sell this here?",
    length: 5,
  },
  {
    ko: "피자 정말 맛있죠.",
    en: "The pizza is really good.",
    length: 3,
  },
  {
    ko: "이 책에 대해서 어떻게 생각하세요?",
    en: "What do you think about this book?",
    length: 5,
  },
  {
    ko: "뭐 하다가 왔어요?",
    en: "What are you doing here?",
    length: 3,
  },
  {
    ko: "언제 고향에 돌아갈 거예요?",
    en: "When will you return home?",
    length: 4,
  },
  {
    ko: "고장났나 봐요.",
    en: "It must be broken.",
    length: 2,
  },
  {
    ko: "아버지가 뚱뚱했었어요.",
    en: "My father was fat.",
    length: 2,
  },
  {
    ko: "약속대로 30분만 게임했어요.",
    en: "As promised, we only played for 30 minutes.",
    length: 3,
  },
  {
    ko: "음식은 4인분 정도 준비하면 되겠지요?",
    en: "Can you prepare food for 4 people?",
    length: 5,
  },
  {
    ko: "9시 뉴스입니다.",
    en: "This is the 9 o'clock news.",
    length: 2,
  },
  {
    ko: "가게가 집 앞에 있어요.",
    en: "The store is in front of the house.",
    length: 4,
  },
  {
    ko: "이번에는 제가 도와 줄게요.",
    en: "I'll help you this time.",
    length: 4,
  },
  {
    ko: "만지면 안 돼요.",
    en: "You can't touch it.",
    length: 3,
  },
  {
    ko: "네, 운동을 합니다.",
    en: "Yes, I do exercise.",
    length: 3,
  },
  {
    ko: "8 시에 일어났어요.",
    en: "I woke up at 8 o'clock.",
    length: 3,
  },
  {
    ko: "영어는 한국어와 달라요.",
    en: "English is different from Korean.",
    length: 3,
  },
  {
    ko: "제 이름은 발음하기가 어려워요.",
    en: "My name is difficult to pronounce.",
    length: 4,
  },
  {
    ko: "책을 많이 읽었네요.",
    en: "I've read a lot of books.",
    length: 3,
  },
  {
    ko: "친했던 친구들이 지금은 다 외국에 살아요.",
    en: "All of my close friends now live abroad.",
    length: 6,
  },
  {
    ko: "영어를 가르쳤어요.",
    en: "I taught English.",
    length: 2,
  },
  {
    ko: "광고를 보니까 10만 원짜리가 좋을 것 같아요.",
    en: "Looking at the advertisement, I think the 100,000 won bill would be good.",
    length: 7,
  },
  {
    ko: "미국이 아니라 프랑스에서 왔어요.",
    en: "I'm from France, not America.",
    length: 4,
  },
  {
    ko: "아이스크림을 좋아하는군요.",
    en: "You like ice cream.",
    length: 2,
  },
  {
    ko: "그리고 밥을 먹었어요.",
    en: "And I ate.",
    length: 3,
  },
  {
    ko: "여기에서 놀지 마세요.",
    en: "don't play here",
    length: 3,
  },
  {
    ko: "이 집을 누가 지었어요?",
    en: "Who built this house?",
    length: 4,
  },
  {
    ko: "우리 햄버거 먹어요.",
    en: "We eat our hamburgers.",
    length: 3,
  },
  {
    ko: "걱정해 줘서 고마워요.",
    en: "Thanks for your concern.",
    length: 3,
  },
  {
    ko: "차나 한 잔 할까요?",
    en: "Shall we have a cup of tea?",
    length: 4,
  },
  {
    ko: "저는 안 어려울 줄 알았어요.",
    en: "I thought it wouldn't be difficult.",
    length: 5,
  },
  {
    ko: "파란 티셔츠 입은 남자가 누군지 아세요?",
    en: "Do you know who the guy in the blue t-shirt is?",
    length: 6,
  },
  {
    ko: "다시 된다!",
    en: "it happens again!",
    length: 2,
  },
  {
    ko: "배 안 고파요.",
    en: "are you not hungry.",
    length: 3,
  },
  {
    ko: "친구들 사이에서 인기가 많아요.",
    en: "It's popular among friends.",
    length: 4,
  },
  {
    ko: "이게 요즘 제가 배우는 한국어책이에요.",
    en: "This is a Korean book I am learning these days.",
    length: 5,
  },
  {
    ko: "내가 중학생이었을 때 그곳에 갔어요.",
    en: "I went there when I was in middle school.",
    length: 5,
  },
  {
    ko: "4살 때 사진이에요.",
    en: "This is a picture when I was 4 years old.",
    length: 3,
  },
  {
    ko: "눈이 오는 날에는 영화 보고 싶어요.",
    en: "On snowy days, I want to watch a movie.",
    length: 6,
  },
  {
    ko: "영화 본 다음에 우리 커피 마셔요.",
    en: "After watching the movie, we drink coffee.",
    length: 6,
  },
  {
    ko: "언제부터 한국말을 잘하게 되었습니까?",
    en: "Since when did you become fluent in Korean?",
    length: 4,
  },
  {
    ko: "그 옷을 입으면 더울 거예요.",
    en: "It will be hot in those clothes.",
    length: 5,
  },
  {
    ko: "아이들이 놀다 보면 유리창을 깰 수도 있지요.",
    en: "When children play, they may break the window.",
    length: 7,
  },
  {
    ko: "저 금요일까지 바빠요.",
    en: "I'm busy until that Friday.",
    length: 3,
  },
  {
    ko: "김장을 하느라고 정말 힘들었어요.",
    en: "It was really hard to make kimchi.",
    length: 4,
  },
  {
    ko: "대학교 입학 준비는 잘되고 있니?",
    en: "How are you preparing for college entrance?",
    length: 5,
  },
  {
    ko: "음악을 듣고 싶어요.",
    en: "i want to listen to music",
    length: 3,
  },
  {
    ko: "공원에 장미꽃이 피어 있어요.",
    en: "Roses are blooming in the park.",
    length: 4,
  },
  {
    ko: "내일 비가 오면.",
    en: "if it rains tomorrow",
    length: 3,
  },
  {
    ko: "마크 씨가 병원에 입원했다면서요?",
    en: "I heard Mark was hospitalized?",
    length: 4,
  },
  {
    ko: "가끔 서점에 가요.",
    en: "I go to the bookstore sometimes.",
    length: 3,
  },
  {
    ko: "그런데 계속 비가 왔어요.",
    en: "But it kept raining.",
    length: 4,
  },
  {
    ko: "완전히 나으려면 수술을 해야 돼요.",
    en: "I need surgery to fully heal.",
    length: 5,
  },
  {
    ko: "일 년 만에 만났는데 정말 반가웠다.",
    en: "It's been a year since we met and it was really nice.",
    length: 6,
  },
  {
    ko: "그래서 먹지 못해요.",
    en: "so i can't eat",
    length: 3,
  },
  {
    ko: "한국 여자 친구를 사귀면 됩니다.",
    en: "You just need to get a Korean girlfriend.",
    length: 5,
  },
  {
    ko: "백화점 건너편에 무엇이 있어요?",
    en: "What's across from the department store?",
    length: 4,
  },
  {
    ko: "정민 씨는 지금 어디에 있을까요?",
    en: "Where is Mr. Jungmin now?",
    length: 5,
  },
  {
    ko: "안 먹고 싶어요.",
    en: "I don't want to eat.",
    length: 3,
  },
  {
    ko: "어제 밥을 먹고 숙제를 했어요.",
    en: "Yesterday I ate and did my homework.",
    length: 5,
  },
  {
    ko: "이런 사람은 처음 봅니다.",
    en: "First time seeing someone like this.",
    length: 4,
  },
  {
    ko: "결정한 뒤에 연락 주세요.",
    en: "Please contact us after making your decision.",
    length: 4,
  },
  {
    ko: "그 일은 여자들에게 너무 힘들었다.",
    en: "The work was too hard for women.",
    length: 5,
  },
  {
    ko: "저는 선생님이 되고 싶어요.",
    en: "i want to be a teacher",
    length: 4,
  },
  {
    ko: "이 분은 누구신가요?",
    en: "Who is this person?",
    length: 3,
  },
  {
    ko: "텔레비전을 보고 나서 잡니다.",
    en: "I sleep after watching TV.",
    length: 4,
  },
  {
    ko: "형은 수영도 잘하고 농구도 잘해요.",
    en: "My brother is good at swimming and good at basketball.",
    length: 5,
  },
  {
    ko: "어제 일 안 했어요.",
    en: "I didn't work yesterday.",
    length: 4,
  },
  {
    ko: "가방이 교실에 있어요.",
    en: "The bag is in the classroom.",
    length: 3,
  },
  {
    ko: "세월이 참 빠르지요?",
    en: "Are the years going by so quickly?",
    length: 3,
  },
  {
    ko: "선생님 댁에 갈 예정이야.",
    en: "I'm going to the teacher's house",
    length: 4,
  },
  {
    ko: "어차피 제가 할 수 있는 일이 아니에요.",
    en: "It's not something I can do anyway.",
    length: 7,
  },
  {
    ko: "요즘에 바빠서 친구들을 못 만나요.",
    en: "I can't meet my friends because I'm busy these days.",
    length: 5,
  },
  {
    ko: "옛날에 공주가 있었어요.",
    en: "Once upon a time there was a princess.",
    length: 3,
  },
  {
    ko: "지금 카페에서 어제 산 책을 읽고 있어요.",
    en: "I am reading the book I bought yesterday at the cafe.",
    length: 7,
  },
  {
    ko: "마시기 전에 날짜를 잘 봤어야지요.",
    en: "You should have checked the date carefully before drinking.",
    length: 5,
  },
  {
    ko: "어제보다 덜 추워요.",
    en: "It's less cold than yesterday.",
    length: 3,
  },
  {
    ko: "버스에서 내려요.",
    en: "get off the bus",
    length: 2,
  },
  {
    ko: "어제 무엇을 했는지 생각이 안 나요.",
    en: "I can't remember what I did yesterday.",
    length: 6,
  },
  {
    ko: "한국말을 공부하기가 어려워요.",
    en: "It is difficult to study Korean.",
    length: 3,
  },
  {
    ko: "좋은 공연이 많은 반면에 관람료가 너무 비싸요.",
    en: "While there are many good performances, the admission fee is too expensive.",
    length: 7,
  },
  {
    ko: "모를 리가 없어요.",
    en: "There's no way I wouldn't know.",
    length: 3,
  },
  {
    ko: '여보, "여기에 주차하지 마세요.',
    en: "Honey, \"Don't park here.",
    length: 4,
  },
  {
    ko: "여기에서 학교까지 멀어요?",
    en: "Is it far from here to school?",
    length: 3,
  },
  {
    ko: "내일 거기 갈까, 말까?",
    en: "Shall we go there tomorrow or not?",
    length: 4,
  },
  {
    ko: "훨씬 덜 비싸다.",
    en: "much less expensive",
    length: 3,
  },
  {
    ko: "아이가 안경을 쓰고 책을 봐요.",
    en: "The child wears glasses and reads a book.",
    length: 5,
  },
  {
    ko: "복권에 당첨된다면 멋진 자동차를 사고 싶어요.",
    en: "If I win the lottery, I want to buy a nice car.",
    length: 6,
  },
  {
    ko: "옛날에 선생님께서 너를 얼마나 예뻐하셨니?",
    en: "How much did your teacher like you in the past?",
    length: 5,
  },
  {
    ko: "텔레비전이 한 대, 컴퓨터가 두 대 있어요.",
    en: "I have one television and two computers.",
    length: 7,
  },
  {
    ko: "저 내일 못 올 수도 있어요.",
    en: "I may not be able to come tomorrow.",
    length: 6,
  },
  {
    ko: "왜 아까 전화를 안 받았어요?",
    en: "Why didn't you answer the phone earlier?",
    length: 5,
  },
  {
    ko: "영화를 보지 맙시다.",
    en: "Let's not watch the movie.",
    length: 3,
  },
  {
    ko: "저는 그냥 일만 열심히 할 뿐입니다.",
    en: "I just work hard.",
    length: 6,
  },
  {
    ko: "지갑 찾았어요?",
    en: "Did you find your wallet?",
    length: 2,
  },
  {
    ko: "이거 책이에요.",
    en: "This is a book.",
    length: 2,
  },
  {
    ko: "토요일은 친구 생일이기 때문에 만날 수 없어요.",
    en: "I can't meet you on Saturday because it's my friend's birthday.",
    length: 7,
  },
  {
    ko: "요즘 바쁜가 봐요.",
    en: "You must be busy these days.",
    length: 3,
  },
  {
    ko: "다섯 시쯤 어때요?",
    en: "How about five o'clock?",
    length: 3,
  },
  {
    ko: "일이 있어서 먼저 갈게요.",
    en: "I have work, so I'll go first.",
    length: 4,
  },
  {
    ko: "이게 제일 좋아요.",
    en: "I like this one the best.",
    length: 3,
  },
  {
    ko: "뭐라고 했어요?",
    en: "What did you say?",
    length: 2,
  },
  {
    ko: "현우 씨는 천재 같아요.",
    en: "Hyunwoo is like a genius.",
    length: 4,
  },
  {
    ko: "형이 하나, 남동생이 하나 있어요.",
    en: "I have one older brother and one younger brother.",
    length: 5,
  },
  {
    ko: "이제 곧 음악회가 시작될 예정입니다.",
    en: "The concert is about to start soon.",
    length: 5,
  },
  {
    ko: "어제 공부한 외국어예요.",
    en: "This is the foreign language I studied yesterday.",
    length: 3,
  },
  {
    ko: "제 직업은 변호사입니다.",
    en: "My profession is a lawyer.",
    length: 3,
  },
  {
    ko: "열면 안 돼요?",
    en: "can't you open it?",
    length: 3,
  },
  {
    ko: "태권도를 배우고 싶어요.",
    en: "I want to learn Taekwondo.",
    length: 3,
  },
  {
    ko: "영화배우같이 잘생겼어요.",
    en: "He looks like a movie star.",
    length: 2,
  },
  {
    ko: "한국에서 만든 거예요.",
    en: "It's made in Korea.",
    length: 3,
  },
  {
    ko: "민지가 좋아하는 사람.",
    en: "The person Minji likes.",
    length: 3,
  },
  {
    ko: "맛있기는 맛있는데 좀 짜요.",
    en: "It's delicious, but a bit salty.",
    length: 4,
  },
  {
    ko: "아이가 여덟 명이나 있어요.",
    en: "I have eight children.",
    length: 4,
  },
  {
    ko: "빵을 만드는데 우유가 없어요.",
    en: "I'm making bread, but there's no milk.",
    length: 4,
  },
  {
    ko: "보통 몇 시에 자요?",
    en: "What time do you usually sleep?",
    length: 4,
  },
  {
    ko: "저는 방에서 공부해요.",
    en: "I study in my room.",
    length: 3,
  },
  {
    ko: "제 전공은 경제학이에요.",
    en: "My major is economics.",
    length: 3,
  },
  {
    ko: "저 약국 앞에서 오른쪽으로 가세요.",
    en: "Go right in front of that pharmacy.",
    length: 5,
  },
  {
    ko: "쇼핑을 할까 하는데 동대문시장이 어때요?",
    en: "Thinking of shopping, how about Dongdaemun Market?",
    length: 5,
  },
  {
    ko: "비행기는 빨라서 좋아요.",
    en: "I like the plane because it's fast.",
    length: 3,
  },
  {
    ko: "제가 어제 말한 것처럼 했어요?",
    en: "Did you do what I said yesterday?",
    length: 5,
  },
  {
    ko: "고마워요, 김 부장.",
    en: "Thank you, Manager Kim.",
    length: 3,
  },
  {
    ko: "뭐가 제일 좋아요?",
    en: "What is your favorite?",
    length: 3,
  },
  {
    ko: "휴가 때 바다에 갔다 와서 그래요.",
    en: "It's like going to the sea on vacation.",
    length: 6,
  },
  {
    ko: "비가 와서 못 가요.",
    en: "It's raining so I can't go.",
    length: 4,
  },
  {
    ko: "1년 후에 가요.",
    en: "I'm leaving in a year",
    length: 3,
  },
  {
    ko: "우리 내일은 쉬자.",
    en: "let's rest tomorrow",
    length: 3,
  },
  {
    ko: "명동에 어떻게 가는지 알아요?",
    en: "Do you know how to get to Myeongdong?",
    length: 4,
  },
  {
    ko: "남자 친구와 얼마나 사귀었어요?",
    en: "How long have you been dating your boyfriend?",
    length: 4,
  },
  {
    ko: "내일 사람들이 많이 왔으면 좋겠어요.",
    en: "I hope many people come tomorrow.",
    length: 5,
  },
  {
    ko: "1년 전쯤 왔어요.",
    en: "I came here about a year ago.",
    length: 3,
  },
  {
    ko: "무엇을 주문하시겠습니까?",
    en: "What would you like to order?",
    length: 2,
  },
  {
    ko: "일본어를 배우기 위해서.",
    en: "to learn Japanese.",
    length: 3,
  },
  {
    ko: "부모님이 기다리시기 때문에 집에 갑니다.",
    en: "I go home because my parents are waiting for me.",
    length: 5,
  },
  {
    ko: "하나도 안 바빠요.",
    en: "I'm not busy at all.",
    length: 3,
  },
  {
    ko: "저녁에 친구를 만나서 영화를 봤어요.",
    en: "I met a friend in the evening and watched a movie.",
    length: 5,
  },
  {
    ko: "저도 서점에 갈 거예요.",
    en: "I'm going to the bookstore too.",
    length: 4,
  },
  {
    ko: "제가 한국에 갔을 때 날씨가 아주 추웠어요.",
    en: "When I went to Korea, the weather was very cold.",
    length: 7,
  },
  {
    ko: "어제 놀기만 했어요.",
    en: "I just played yesterday.",
    length: 3,
  },
  {
    ko: "화장실 청소를 해 주세요.",
    en: "Please clean the bathroom.",
    length: 4,
  },
  {
    ko: "아무것도 먹으면 안 돼요.",
    en: "You can't eat anything.",
    length: 4,
  },
  {
    ko: "보통 할인 마트나 시장에서 사요.",
    en: "I usually buy them at discount marts or markets.",
    length: 5,
  },
  {
    ko: "창문 닫아도 될까요?",
    en: "May I close the window?",
    length: 3,
  },
  {
    ko: "한번 입어 보세요.",
    en: "Try it on.",
    length: 3,
  },
  {
    ko: "엄마를 도와요.",
    en: "help mom",
    length: 2,
  },
  {
    ko: "하루에 세 번 이상 크게 웃으세요.",
    en: "Laugh out loud at least three times a day.",
    length: 6,
  },
  {
    ko: "영어를 배우고 있어요.",
    en: "I am learning English.",
    length: 3,
  },
  {
    ko: "한국은 겨울에 정말 춥다고 들었어요.",
    en: "I heard that Korea is really cold in winter.",
    length: 5,
  },
  {
    ko: "내가 듣고 있는 음악은 한국 음악이에요.",
    en: "The music I am listening to is Korean music.",
    length: 6,
  },
  {
    ko: "이거 써 봤어요?",
    en: "have you tried this?",
    length: 3,
  },
  {
    ko: "친구분께서 전화하셨어요.",
    en: "A friend called.",
    length: 2,
  },
  {
    ko: "한국에 같이 가자.",
    en: "Let's go to Korea together.",
    length: 3,
  },
  {
    ko: "어떤 색깔이 가장 좋아요?",
    en: "which color do you like best?",
    length: 4,
  },
  {
    ko: "미국 경제가 망해 간다.",
    en: "US economy is collapsing.",
    length: 4,
  },
  {
    ko: "그 옷은 입기가 불편해요.",
    en: "Those clothes are uncomfortable to wear.",
    length: 4,
  },
  {
    ko: "배가 많이 아팠어요.",
    en: "My stomach hurt a lot.",
    length: 3,
  },
  {
    ko: "방이 넓지 않아요.",
    en: "The room is not spacious.",
    length: 3,
  },
  {
    ko: "아직 할 줄 몰라요.",
    en: "I don't know how to do it yet.",
    length: 4,
  },
  {
    ko: "책 15쪽을 보세요.",
    en: "Look at page 15 of the book.",
    length: 3,
  },
  {
    ko: "교실에 누가 있습니까?",
    en: "Who is in the classroom?",
    length: 3,
  },
  {
    ko: "열한 시에 자요.",
    en: "sleep at eleven o'clock",
    length: 3,
  },
  {
    ko: "여기에서 좀 쉴까요?",
    en: "Shall we take a break here?",
    length: 3,
  },
  {
    ko: "옷 더 사고 싶어요.",
    en: "I want to buy more clothes.",
    length: 4,
  },
  {
    ko: "이 책 좋아해요?",
    en: "do you like this book?",
    length: 3,
  },
  {
    ko: "바나나를 질리도록 먹었어요.",
    en: "I ate bananas until I got tired of them.",
    length: 3,
  },
  {
    ko: "여기 앉으십시오.",
    en: "Please have a seat here.",
    length: 2,
  },
  {
    ko: "705번 버스를 타요.",
    en: "Take the 705 bus.",
    length: 3,
  },
  {
    ko: "뭐 사고 싶은지 말해 주세요.",
    en: "Please tell me what you want to buy.",
    length: 5,
  },
  {
    ko: "설악산은 경치가 얼마나 아름다운지 몰라요.",
    en: "You have no idea how beautiful the scenery is at Seoraksan Mountain.",
    length: 5,
  },
  {
    ko: "세탁할 때 조심하세요.",
    en: "Be careful when washing.",
    length: 3,
  },
  {
    ko: "수업 중에는 휴대전화를 꺼 놓거든요.",
    en: "I turn off my cell phone during class.",
    length: 5,
  },
  {
    ko: "얼마나 자주 와요?",
    en: "How often do you come?",
    length: 3,
  },
  {
    ko: "학생 아니면 선생님이에요.",
    en: "Are you a student or a teacher?",
    length: 3,
  },
  {
    ko: "도쿄는 서울하고 비슷해요?",
    en: "Is Tokyo similar to Seoul?",
    length: 3,
  },
  {
    ko: "이렇게 하면 돼요?",
    en: "can i do this?",
    length: 3,
  },
  {
    ko: "의사가 되세요.",
    en: "Become a doctor.",
    length: 2,
  },
  {
    ko: "아무데도 안 갈 거예요.",
    en: "I'm not going anywhere.",
    length: 4,
  },
  {
    ko: "아직도 몰라요?",
    en: "Still don't know?",
    length: 2,
  },
  {
    ko: "이 책 어떤 것 같아요?",
    en: "What do you think of this book?",
    length: 5,
  },
  {
    ko: "눈이 오고 있었어요.",
    en: "It was snowing.",
    length: 3,
  },
  {
    ko: "요즘 영화를 볼 만큼 한가하지 않아요.",
    en: "I don't have enough free time to watch movies these days.",
    length: 6,
  },
  {
    ko: "동생이 개한테 밥을 줘요.",
    en: "My brother feeds the dog.",
    length: 4,
  },
  {
    ko: "그럴 수도 있죠.",
    en: "Maybe.",
    length: 3,
  },
  {
    ko: "서울에서 부산에 어떻게 가요?",
    en: "How to get from Seoul to Busan?",
    length: 4,
  },
  {
    ko: "아무거나 주세요.",
    en: "give me anything.",
    length: 2,
  },
  {
    ko: "별로 재미없어요.",
    en: "Not very funny.",
    length: 2,
  },
  {
    ko: "얼마나 무거워요?",
    en: "How heavy is it?",
    length: 2,
  },
  {
    ko: "친구가 말한 카페.",
    en: "A cafe my friend told me about.",
    length: 3,
  },
  {
    ko: "살 뻔 했어요.",
    en: "I almost lived.",
    length: 3,
  },
  {
    ko: "냉장고에 우유밖에 없어요.",
    en: "There is only milk in the refrigerator.",
    length: 3,
  },
  {
    ko: "제일 가까운 역이 어디예요?",
    en: "Where is the nearest station?",
    length: 4,
  },
  {
    ko: "우리 아이가 벌써 10살이 되었어요.",
    en: "My child is already 10 years old.",
    length: 5,
  },
  {
    ko: "아무도 없나 봐요.",
    en: "I guess there is no one.",
    length: 3,
  },
  {
    ko: "여기 어디예요?",
    en: "Where are you?",
    length: 2,
  },
  {
    ko: "파는 게 아니라 전시하는 거예요.",
    en: "It's not for sale, it's for display.",
    length: 5,
  },
  {
    ko: "교통사고가 나는 바람에 다쳐서 병원에 입원했대요.",
    en: "He was injured in a car accident and was hospitalized.",
    length: 6,
  },
  {
    ko: "어젠 왜 안 왔어요?",
    en: "Why didn't you come?",
    length: 4,
  },
  {
    ko: "비자를 받은 뒤에 외국에 갈 수 있습니다.",
    en: "After obtaining a visa, you can go abroad.",
    length: 7,
  },
  {
    ko: "한국어를 공부한 지 6개월이 되었어요.",
    en: "It's been 6 months since I studied Korean.",
    length: 5,
  },
  {
    ko: "오늘부터 2급반을 가르치게 되었어요.",
    en: "Starting today, I will be teaching the 2nd grade class.",
    length: 4,
  },
  {
    ko: "하기 싫으면 하지 마세요.",
    en: "Don't do it if you don't want to.",
    length: 4,
  },
  {
    ko: "오늘은 일요일같은 월요일이에요.",
    en: "Today is Monday like Sunday.",
    length: 3,
  },
  {
    ko: "보고서를 아직 못 끝냈다면서요?",
    en: "You said you haven't finished your report yet?",
    length: 4,
  },
  {
    ko: "한국말을 알아요.",
    en: "I know Korean.",
    length: 2,
  },
  {
    ko: "그 사람은 인기가 있을 만해요.",
    en: "That person deserves to be popular.",
    length: 5,
  },
  {
    ko: "지난번에 갔을 때는 집이 아주 커 보이던데요.",
    en: "Last time I went, the house looked very big.",
    length: 7,
  },
  {
    ko: "강아지가 곰처럼 생겼어요.",
    en: "The puppy looks like a bear.",
    length: 3,
  },
  {
    ko: "바쁘면 안 가도 돼요.",
    en: "You don't have to go if you're busy.",
    length: 4,
  },
  {
    ko: "한국에서만큼 자주 안 만나요.",
    en: "We don't meet as often as in Korea.",
    length: 4,
  },
  {
    ko: "평일이니까 영화 표를 미리 사지 않아도 돼요.",
    en: "Since it's a weekday, you don't have to buy movie tickets in advance.",
    length: 7,
  },
  {
    ko: "김치를 잘 먹어요?- 아니요, 잘 못 먹어요.",
    en: "Do you like kimchi? - No, I don't like it.",
    length: 7,
  },
  {
    ko: "도서관에서 얘기하면 안 돼요.",
    en: "You can't talk in the library.",
    length: 4,
  },
  {
    ko: "자유라는 것은 아무거나 마음대로 하는 것이 아니에요.",
    en: "Freedom is not about doing whatever you want.",
    length: 7,
  },
  {
    ko: "점심을 먹으러 오는 길에 우체국에 들러서 부쳤어요.",
    en: "On my way to lunch, I stopped at the post office to mail it.",
    length: 7,
  },
  {
    ko: "장미는 너무 비싸다.",
    en: "Roses are too expensive.",
    length: 3,
  },
  {
    ko: "어제 친구들한테 영화 볼 거라고 했어요?",
    en: "Did you tell your friends yesterday that you were going to see a movie?",
    length: 6,
  },
  {
    ko: "아침에는 커피만 마셔요.",
    en: "I only drink coffee in the morning.",
    length: 3,
  },
  {
    ko: "가족이 보고 싶어요.",
    en: "I miss my family.",
    length: 3,
  },
  {
    ko: "우리는 3년 후에 결혼하기로 했습니다.",
    en: "We decided to get married in 3 years.",
    length: 5,
  },
  {
    ko: "이 영화 재미있을 것 같아요.",
    en: "I think this movie will be interesting.",
    length: 5,
  },
  {
    ko: "이것을 어떻게 생각합니까?",
    en: "What do you think of this?",
    length: 3,
  },
  {
    ko: "냄새는 이상해도 맛있어요.",
    en: "The smell is weird, but it's delicious.",
    length: 3,
  },
  {
    ko: "하숙집은 식사 준비를 할 필요가 없으니까 편해요.",
    en: "The boarding house is convenient because you don't have to prepare meals.",
    length: 7,
  },
  {
    ko: "대학교를 졸업한 후에 취직을 했어요.",
    en: "After graduating from university, I got a job.",
    length: 5,
  },
  {
    ko: "아니요, 운동 안 해요.",
    en: "No, I don't exercise.",
    length: 4,
  },
  {
    ko: "식사 전에 이 약을 드세요.",
    en: "Take this medicine before meals.",
    length: 5,
  },
  {
    ko: "10시에 출발하는 기차를 타요.",
    en: "I take the train leaving at 10 o'clock.",
    length: 4,
  },
  {
    ko: "오늘 일요일이잖아요.",
    en: "It's Sunday.",
    length: 2,
  },
  {
    ko: "에어컨을 켜 주시겠어요?",
    en: "Could you turn on the air conditioner?",
    length: 3,
  },
  {
    ko: "처음에 비해서 많이 익숙해졌어요.",
    en: "I got used to it a lot compared to the first time.",
    length: 4,
  },
  {
    ko: "원하는 만큼 다 가져가세요.",
    en: "Take all you want.",
    length: 4,
  },
  {
    ko: "오늘은 바빠서 영화를 못 봐요.",
    en: "I'm busy today so I can't watch a movie.",
    length: 5,
  },
  {
    ko: "오늘 사무실 사람들과 같이 식사를 못 한다면서요?",
    en: "You said you couldn't eat with the office people today?",
    length: 7,
  },
  {
    ko: "한국 친구 몇 명 있어요?",
    en: "How many Korean friends do you have?",
    length: 5,
  },
  {
    ko: "맥주만 주문했어요.",
    en: "I only ordered beer.",
    length: 2,
  },
  {
    ko: "서울에서 살다가 제주도로 이사 갔어요.",
    en: "I lived in Seoul and then moved to Jeju Island.",
    length: 5,
  },
  {
    ko: "조금 전부터 비가 오기 시작했습니다.",
    en: "It started raining a little while ago.",
    length: 5,
  },
  {
    ko: "주말에 우리 집에 놀러 오세요.",
    en: "Come over to my house on the weekend.",
    length: 5,
  },
  {
    ko: "여기 너무 시끄러워요.",
    en: "It's too noisy here.",
    length: 3,
  },
  {
    ko: "요즘 왜 피곤해요?",
    en: "Why are you tired these days?",
    length: 3,
  },
  {
    ko: "택배 아저씨 아니었어요?",
    en: "Wasn't it the delivery guy?",
    length: 3,
  },
  {
    ko: "이 도서관은 토요일에 문을 엽니까?",
    en: "Is this library open on Saturday?",
    length: 5,
  },
  {
    ko: "내일은 꼭 가지고 올게요.",
    en: "I'll be sure to bring it tomorrow.",
    length: 4,
  },
  {
    ko: "축구를 좋아하게 되었어요.",
    en: "I came to like football.",
    length: 3,
  },
  {
    ko: "언젠가 미국에 가고 싶어요.",
    en: "I want to go to America someday.",
    length: 4,
  },
  {
    ko: "준호는 자기가 신문 기자라고 했어요.",
    en: "Junho said he was a newspaper reporter.",
    length: 5,
  },
  {
    ko: "그 사람 지금 한국에 가 있습니다.",
    en: "He is now in Korea.",
    length: 6,
  },
  {
    ko: "햄버거를 사 가지고 차에서 먹었습니다.",
    en: "I bought a hamburger and ate it in the car.",
    length: 5,
  },
  {
    ko: "어제 그 영화 봤다고 했어요?",
    en: "You said you saw the movie yesterday?",
    length: 5,
  },
  {
    ko: "샤워하고 있었어요.",
    en: "I was taking a shower.",
    length: 2,
  },
  {
    ko: "백화점이 몇 시에 여는지 알고 싶어요.",
    en: "I want to know what time the department store opens.",
    length: 6,
  },
  {
    ko: "비가 올 줄 알았어요.",
    en: "I knew it would rain.",
    length: 4,
  },
  {
    ko: "무슨 선물을 살까요?",
    en: "What gift should I buy?",
    length: 3,
  },
  {
    ko: "제 취미는 영화 보는 거예요.",
    en: "My hobby is watching movies.",
    length: 5,
  },
  {
    ko: "올해도 벌써 반이나 지났어요.",
    en: "Half of this year has already passed.",
    length: 4,
  },
  {
    ko: "민수 씨는 공무원이 되고 싶다고 했지요?",
    en: "Minsu said he wanted to become a civil servant, right?",
    length: 6,
  },
  {
    ko: "가위로 종이를 잘라요.",
    en: "Cut the paper with scissors.",
    length: 3,
  },
  {
    ko: "이틀마다 있어요.",
    en: "It's every two days.",
    length: 2,
  },
  {
    ko: "기후가 따뜻하며 경치가 매우 아름답다.",
    en: "The climate is warm and the scenery is very beautiful.",
    length: 5,
  },
  {
    ko: "전화하지 말고 문자 메시지 보내 주세요.",
    en: "Don't call, text me.",
    length: 6,
  },
  {
    ko: "사무실에서 일해요.",
    en: "I work in the office.",
    length: 2,
  },
  {
    ko: "지금은 할 이야기가 없어요.",
    en: "I have nothing to talk about now.",
    length: 4,
  },
  {
    ko: "뭐가 좋은지 몰라요.",
    en: "I don't know what's good.",
    length: 3,
  },
  {
    ko: "다른 사람한테 물어보는 거 어때요?",
    en: "How about asking someone else?",
    length: 5,
  },
  {
    ko: "학교 뒤에 높은 산이 있어요.",
    en: "There is a high mountain behind the school.",
    length: 5,
  },
  {
    ko: "오전 아홉 시 십 분이에요.",
    en: "It's nine ten in the morning.",
    length: 5,
  },
  {
    ko: "누구랑 갔어요?",
    en: "who did you go with?",
    length: 2,
  },
  {
    ko: "이 개월 동안 집에만 있었어요.",
    en: "I've been at home for two months.",
    length: 5,
  },
  {
    ko: "오늘 시간이 있나요?",
    en: "Do you have time today?",
    length: 3,
  },
  {
    ko: "이분은 부디 씨의 선생님입니다.",
    en: "This is Mr. Boodi's teacher.",
    length: 4,
  },
  {
    ko: "뒷사람들도 잘 들을 수 있게 마이크를 사용할게요.",
    en: "I will use a microphone so that the people behind me can hear me well.",
    length: 7,
  },
  {
    ko: "이거 싫어요?",
    en: "don't like this?",
    length: 2,
  },
  {
    ko: "아이들이 어서 집에 가자고 합니다.",
    en: "The children are asking to go home.",
    length: 5,
  },
  {
    ko: "아까 도서관에서 공부하더라고요.",
    en: "I was studying at the library earlier.",
    length: 3,
  },
  {
    ko: "다니엘하고 같이 공부하는 친구를 알아요.",
    en: "I know a friend who studies with Daniel.",
    length: 5,
  },
  {
    ko: "사과가 맛있는데 어디에서 샀어요?",
    en: "The apples are delicious, where did you buy them?",
    length: 4,
  },
  {
    ko: "비가 와서 못 갔어요.",
    en: "It was raining so I couldn't go.",
    length: 4,
  },
  {
    ko: "택시를 타도 3시까지 못 가요.",
    en: "Even if I take a taxi, I won't be there until 3 o'clock.",
    length: 5,
  },
  {
    ko: "한국어 공부할 때 뭐가 제일 어려워요?",
    en: "What is the most difficult thing when studying Korean?",
    length: 6,
  },
  {
    ko: "내일은 여기 말고 다른 곳에서 만날 거예요.",
    en: "Tomorrow we will meet somewhere other than here.",
    length: 7,
  },
  {
    ko: "목이 아프도록 노래를 불렀어요.",
    en: "I sang until my throat hurt.",
    length: 4,
  },
  {
    ko: "회사에 다닌 후부터 일찍 일어나게 되었어요.",
    en: "I started waking up early after going to work.",
    length: 6,
  },
  {
    ko: "컴퓨터게임을 한 지 5시간이 넘었어요.",
    en: "It's been over 5 hours since I played computer games.",
    length: 5,
  },
  {
    ko: "던지면 안 돼요.",
    en: "You can't throw it.",
    length: 3,
  },
  {
    ko: "할 수는 있는데 안 하고 싶어요.",
    en: "I can, but I don't want to.",
    length: 6,
  },
  {
    ko: "나는 학교에 가서 공부해요.",
    en: "I go to school and study",
    length: 4,
  },
  {
    ko: "요즘 이사하느라고 정신이 없어서 약속을 잊어버렸을지도 몰라요.",
    en: "I might have forgotten the promise because I was busy with moving these days.",
    length: 7,
  },
  {
    ko: "저는 한국 문화에 대해서 관심이 많아요.",
    en: "I am very interested in Korean culture.",
    length: 6,
  },
  {
    ko: "주스가 좋아요?",
    en: "Do you like juice?",
    length: 2,
  },
  {
    ko: "한국 음식 좋아해요?",
    en: "Do you like Korean food?",
    length: 3,
  },
  {
    ko: "아무데도 가고 싶지 않아요.",
    en: "I don't want to go anywhere.",
    length: 4,
  },
  {
    ko: "집 안에 강아지가 있어요.",
    en: "There is a dog in the house.",
    length: 4,
  },
  {
    ko: "2년 전에 한국에 왔습니다.",
    en: "I came to Korea two years ago.",
    length: 4,
  },
  {
    ko: "작지만 깨끗해요.",
    en: "Small but clean.",
    length: 2,
  },
  {
    ko: "한 시간이나 기다리게 하면 어떻게 해요?",
    en: "What if I make you wait for an hour?",
    length: 6,
  },
  {
    ko: "매일 편한 바지에다가 티셔츠만 입었으니까요.",
    en: "I wore only comfortable pants and a t-shirt every day.",
    length: 5,
  },
  {
    ko: "약을 이틀 정도 먹으면 나을 겁니다.",
    en: "Take the medicine for a couple of days and you'll be fine.",
    length: 6,
  },
  {
    ko: "넘어지지 않도록 조심하세요.",
    en: "Be careful not to fall.",
    length: 3,
  },
  {
    ko: "밥을 먹으면서 TV를 봅니다.",
    en: "I watch TV while eating.",
    length: 4,
  },
  {
    ko: "그 사람이 언제 온다고 했어요?",
    en: "When did he say he was coming?",
    length: 5,
  },
  {
    ko: '에디슨은 "실패는 성공의 어머니입니다.',
    en: "Edison said, “Failure is the mother of success.",
    length: 4,
  },
  {
    ko: "사무실이 몇 층이에요?",
    en: "What floor is the office on?",
    length: 3,
  },
  {
    ko: "그럼 이제 어떻게 해요?",
    en: "So what do we do now?",
    length: 4,
  },
  {
    ko: "그 배우가 결혼한다면 많은 여자들이 실망하겠어요.",
    en: "If the actor gets married, many women will be disappointed.",
    length: 6,
  },
  {
    ko: "열쇠를 찾고 있는 중이었어요.",
    en: "I was looking for a key.",
    length: 4,
  },
  {
    ko: "어디 가고 싶어요?",
    en: "Where do you want to go?",
    length: 3,
  },
  {
    ko: "몇 월에 태어났어요?",
    en: "What month were you born?",
    length: 3,
  },
  {
    ko: "자전거를 탈 거예요.",
    en: "I will ride a bicycle.",
    length: 3,
  },
  {
    ko: "이야기하는 것 같아요.",
    en: "I guess I'm talking",
    length: 3,
  },
  {
    ko: "이거 먹어도 괜찮아요?",
    en: "Is it okay to eat this?",
    length: 3,
  },
  {
    ko: "공항에 한 시쯤 도착했어요.",
    en: "I arrived at the airport around one o'clock.",
    length: 4,
  },
  {
    ko: "사과가 맛있어요.",
    en: "Apples are delicious.",
    length: 2,
  },
  {
    ko: "아니요, 책상이 아니에요.",
    en: "No, it's not a desk.",
    length: 3,
  },
  {
    ko: "늦어서 죄송합니다.",
    en: "Forgive me for being late.",
    length: 2,
  },
  {
    ko: "크리스마스 때 뭐 해요?",
    en: "what do you do at christmas",
    length: 4,
  },
  {
    ko: "숙제하는 데 한 시간 걸려요.",
    en: "It takes an hour to do my homework.",
    length: 5,
  },
  {
    ko: "어느 옷이 더 나아요?",
    en: "Which outfit is better?",
    length: 4,
  },
  {
    ko: "치마를 입고 있어요.",
    en: "I'm wearing a skirt.",
    length: 3,
  },
  {
    ko: "어젯밤에 축구를 보느라고 숙제를 못했어요.",
    en: "I couldn't do my homework because I was watching soccer last night.",
    length: 5,
  },
  {
    ko: "혼자 한국어를 공부해요?",
    en: "Are you studying Korean by yourself?",
    length: 3,
  },
  {
    ko: "제주도에 가 보고 싶어요.",
    en: "I want to go to Jeju Island.",
    length: 4,
  },
  {
    ko: "이 길로 쭉 가세요.",
    en: "Keep going this way.",
    length: 4,
  },
  {
    ko: "자동차 뒤에 있어요.",
    en: "It's behind the car.",
    length: 3,
  },
  {
    ko: "걱정하지 말라고 했어요.",
    en: "I told you not to worry.",
    length: 3,
  },
  {
    ko: "들은 대로 이야기해 주세요.",
    en: "Please tell me what you hear.",
    length: 4,
  },
  {
    ko: "준비 다 했어요.",
    en: "I'm ready.",
    length: 3,
  },
  {
    ko: "그런데 먹게 돼요.",
    en: "But you can eat it.",
    length: 3,
  },
  {
    ko: "저는 수영하지 못해요.",
    en: "I can't swim.",
    length: 3,
  },
  {
    ko: "아직 친구에게 선물 안 해 줬어요.",
    en: "I haven't given it to a friend yet.",
    length: 6,
  },
  {
    ko: "극장에 사람이 많을까요?",
    en: "Are there many people in the theater?",
    length: 3,
  },
  {
    ko: "철수가 지금 집에 없을 것 같아요.",
    en: "I don't think Cheol-su will be at home now.",
    length: 6,
  },
  {
    ko: "이거 말고 저거 살게요.",
    en: "I'll buy that, not this.",
    length: 4,
  },
  {
    ko: "김밥 맛있어요.",
    en: "Kimbap is delicious.",
    length: 2,
  },
  {
    ko: "조금만 더 기다리자.",
    en: "Let's wait a little longer.",
    length: 3,
  },
  {
    ko: "사과 안 먹어요.",
    en: "I don't eat apples.",
    length: 3,
  },
  {
    ko: "고향 친구한테 편지를 써요.",
    en: "Write a letter to your hometown friend.",
    length: 4,
  },
  {
    ko: "부츠를 신고 있어요.",
    en: "I'm wearing boots.",
    length: 3,
  },
  {
    ko: "공기라는 거야.",
    en: "it's air",
    length: 2,
  },
  {
    ko: "자전거 탈 줄 알아요?",
    en: "Do you know how to ride a bicycle?",
    length: 4,
  },
  {
    ko: "어디에서 팔 거예요?",
    en: "where will you sell it?",
    length: 3,
  },
  {
    ko: "좋은 아이디어예요.",
    en: "That's a good idea.",
    length: 2,
  },
  {
    ko: "세 시에 여기에서 만나요.",
    en: "I'll meet you here at three o'clock.",
    length: 4,
  },
  {
    ko: "그건 벌 받을 만한 짓이에요.",
    en: "That deserves to be punished.",
    length: 5,
  },
  {
    ko: "9월 4일에 뉴욕으로 가는 항공편을 예약할까 하는데요.",
    en: "I'd like to book a flight to New York on September 4th.",
    length: 7,
  },
  {
    ko: "왜 집을 요새처럼 만들었어요?",
    en: "Why did you make your house look like a fortress?",
    length: 4,
  },
  {
    ko: "그것보다 시계를 선물하면 어떨까요?",
    en: "Rather than that, how about gifting a watch?",
    length: 4,
  },
  {
    ko: "저는 검은색 옷을 즐겨 입는 편이에요.",
    en: "I like to wear black clothes.",
    length: 6,
  },
  {
    ko: "아무것도 만지지 마세요.",
    en: "Don't touch anything.",
    length: 3,
  },
  {
    ko: "이거 살 거예요?",
    en: "will you buy this?",
    length: 3,
  },
  {
    ko: "아무거나 먹으면 안 돼요.",
    en: "You can't eat anything.",
    length: 4,
  },
  {
    ko: "아니요, 안 멀어요.",
    en: "No, it's not far.",
    length: 3,
  },
  {
    ko: "퇴근 후에 회사 앞 커피숍에서 만나재요.",
    en: "Let's meet at the coffee shop in front of the office after work.",
    length: 6,
  },
  {
    ko: "빈 차가 있을지 모르겠어요.",
    en: "I don't know if there will be empty cars.",
    length: 4,
  },
  {
    ko: "안 될 리가 없어요.",
    en: "It can't be.",
    length: 4,
  },
  {
    ko: "한국어로 말하다.",
    en: "speak Korean",
    length: 2,
  },
  {
    ko: "이번 주는 바빠서 시간이 없어요.",
    en: "I'm busy this week, so I don't have time.",
    length: 5,
  },
  {
    ko: "지금 몇 시예요?",
    en: "What time is it?",
    length: 3,
  },
  {
    ko: "테니스를 치는 사람이 샐리 씨예요.",
    en: "The tennis player is Sally.",
    length: 5,
  },
  {
    ko: "어떤 영화를 보고 싶어요?",
    en: "What movie would you like to see?",
    length: 4,
  },
  {
    ko: "시험에 떨어질까 봐 걱정이에요.",
    en: "I'm afraid I'll fail the exam.",
    length: 4,
  },
  {
    ko: "다음 주에 운전면허 시험을 봐요.",
    en: "I'm taking my driver's license test next week.",
    length: 5,
  },
  {
    ko: "오늘만 일찍 왔어요.",
    en: "I came early today.",
    length: 3,
  },
  {
    ko: "서울은 왜 가시는데요?",
    en: "Why are you going to Seoul?",
    length: 3,
  },
  {
    ko: "주스를 마셨어요.",
    en: "I drank juice.",
    length: 2,
  },
  {
    ko: "들은 대로 잘 전달했어요.",
    en: "You delivered what you heard.",
    length: 4,
  },
  {
    ko: "우리 내일 몇 시에 만날래?",
    en: "What time shall we meet tomorrow?",
    length: 5,
  },
  {
    ko: "음악 들을래요?",
    en: "do you want to hear the music?",
    length: 2,
  },
  {
    ko: "보통 밤 11시에 자요.",
    en: "I usually go to bed at 11pm.",
    length: 4,
  },
  {
    ko: "피아노를 칠 수 있어요?",
    en: "can you play the piano?",
    length: 4,
  },
  {
    ko: "은행에 돈 바꾸러 가요.",
    en: "I go to the bank to change money.",
    length: 4,
  },
  {
    ko: "아파트 산 것을 축하합니다.",
    en: "Congratulations on buying an apartment.",
    length: 4,
  },
  {
    ko: "미국에 갔었어요.",
    en: "I went to America.",
    length: 2,
  },
  {
    ko: "냉장고에 먹을 것이 전혀 없어요.",
    en: "There is absolutely nothing to eat in the refrigerator.",
    length: 5,
  },
  {
    ko: "집에 안 가요?",
    en: "Aren't you going home?",
    length: 3,
  },
  {
    ko: "고향에 돌아가면 연락하세요.",
    en: "Contact me when you return home.",
    length: 3,
  },
  {
    ko: "아무리 맛있어도 이제 그만 먹어요.",
    en: "No matter how delicious it is, stop eating it now.",
    length: 5,
  },
  {
    ko: "내일은 몇 시에 오시나요?",
    en: "What time are you coming tomorrow?",
    length: 4,
  },
  {
    ko: "아이가 심심해해요.",
    en: "The child is bored.",
    length: 2,
  },
  {
    ko: "좋기는 좋은데 너무 비싸요.",
    en: "It's good, but it's too expensive.",
    length: 4,
  },
  {
    ko: "아침에 빵이나 밥을 먹어요.",
    en: "I eat bread or rice for breakfast.",
    length: 4,
  },
  {
    ko: "네, 그런데 전화하니까 안 받아요.",
    en: "Yes, but when I called, they didn't answer.",
    length: 5,
  },
  {
    ko: "댄 씨가 한국말을 잘해요?",
    en: "Does Dan speak Korean well?",
    length: 4,
  },
  {
    ko: "지난 금요일부터.",
    en: "from last friday.",
    length: 2,
  },
  {
    ko: "한 개에 얼마예요?",
    en: "How much is each?",
    length: 3,
  },
  {
    ko: "나는 한국 회사에서 일하게 되었습니다.",
    en: "I got a job for a Korean company.",
    length: 5,
  },
  {
    ko: "두 시 십 분 전이에요.",
    en: "It's ten minutes before two.",
    length: 5,
  },
  {
    ko: "제가 들어가고 싶었던 회사에 취직을 했어요.",
    en: "I got a job at the company I wanted to work for.",
    length: 6,
  },
  {
    ko: "내일 알렉스라는 친구가 올 거예요.",
    en: "A friend named Alex will come tomorrow.",
    length: 5,
  },
  {
    ko: "우리 언니는 피아노를 치면서 노래를 해요.",
    en: "My older sister sings while playing the piano.",
    length: 6,
  },
  {
    ko: "사과가 요즘 얼마쯤 해요?",
    en: "How much are apples these days?",
    length: 4,
  },
  {
    ko: "아무리 학생이라도 그렇지.",
    en: "No matter how much a student",
    length: 3,
  },
  {
    ko: "치즈로 유명하다.",
    en: "famous for its cheese.",
    length: 2,
  },
  {
    ko: "그리고 한국 음식이에요.",
    en: "And it's Korean food.",
    length: 3,
  },
  {
    ko: "다니엘 씨를 아세요?",
    en: "Do you know Daniel?",
    length: 3,
  },
  {
    ko: "피곤해서 집에서 쉴래요.",
    en: "I'm tired, so I want to rest at home.",
    length: 3,
  },
  {
    ko: "동생이 언니보다 더 커요.",
    en: "The younger brother is bigger than the older sister.",
    length: 4,
  },
  {
    ko: "나를 사랑하나요?",
    en: "do you love me",
    length: 2,
  },
  {
    ko: "집에 가야 돼요.",
    en: "I have to go home.",
    length: 3,
  },
  {
    ko: "책상 왼쪽에 화분이 있어요.",
    en: "There is a flower pot on the left side of the desk.",
    length: 4,
  },
  {
    ko: "어제 본 영화.",
    en: "The movie I saw yesterday.",
    length: 3,
  },
  {
    ko: "창문을 열까요?",
    en: "Shall I open the window?",
    length: 2,
  },
  {
    ko: "이 옷이 마음에 들어요.",
    en: "I like this outfit.",
    length: 4,
  },
  {
    ko: "나 먼저 간다.",
    en: "i go first",
    length: 3,
  },
  {
    ko: "내일 할 일이 많아요.",
    en: "I have a lot of work to do tomorrow.",
    length: 4,
  },
  {
    ko: "편지를 받은 다음에.",
    en: "after receiving the letter.",
    length: 3,
  },
  {
    ko: "다리가 아파서 걷기가 힘들어요.",
    en: "My legs hurt and it's hard to walk.",
    length: 4,
  },
  {
    ko: "유키 씨, 우리 시험 끝나고 뭐 할래요?",
    en: "Yuki-san, what do you want to do after our exam?",
    length: 7,
  },
  {
    ko: "바보처럼 정말 그 말을 믿었어요?",
    en: "Like an idiot, did you really believe that?",
    length: 5,
  },
  {
    ko: "저 지금 학생인데 일도 하고 있어요.",
    en: "I am a student now and I am also working.",
    length: 6,
  },
  {
    ko: "두 시간 내에 기차가 떠날 거예요.",
    en: "The train will leave in two hours.",
    length: 6,
  },
  {
    ko: "지금 어디에 있어요?",
    en: "Where are you?",
    length: 3,
  },
  {
    ko: "또 모르는 게 있으면 언제든지 물어보세요.",
    en: "If there is anything else you do not know, feel free to ask.",
    length: 6,
  },
  {
    ko: "방학에 제주도나 설악산에 가고 싶어요.",
    en: "I want to go to Jeju Island or Mt. Seorak during vacation.",
    length: 5,
  },
  {
    ko: "배불러 가지고 도저히 더 못 먹겠어요.",
    en: "I'm full and I can't eat any more.",
    length: 6,
  },
  {
    ko: "매일 한 시간 이상 운동하려고요.",
    en: "I try to exercise for an hour or more every day.",
    length: 5,
  },
  {
    ko: "영화 봤는데 무서웠어요.",
    en: "I saw the movie and I was scared.",
    length: 3,
  },
  {
    ko: "심심한데 음악이나 들읍시다.",
    en: "I'm bored, let's listen to music.",
    length: 3,
  },
  {
    ko: "토요일에 시작해요.",
    en: "start on saturday",
    length: 2,
  },
  {
    ko: "그렇지만 수영은 할 수 없어요.",
    en: "But I can't swim.",
    length: 5,
  },
  {
    ko: "보자마자 마음에 들었어요.",
    en: "I liked it as soon as I saw it.",
    length: 3,
  },
  {
    ko: "그날이 제 생일이거든요.",
    en: "Because that day is my birthday.",
    length: 3,
  },
  {
    ko: "그리고 미국에도 친구가 있어요.",
    en: "And I have friends in America too.",
    length: 4,
  },
  {
    ko: "택시를 타도 시간이 오래 걸려요.",
    en: "Even if you take a taxi, it will take a long time.",
    length: 5,
  },
  {
    ko: "일은 많은데 월급은 적어요.",
    en: "There is a lot of work, but the pay is low.",
    length: 4,
  },
  {
    ko: "코트를 입을래요.",
    en: "I want to wear a coat.",
    length: 2,
  },
  {
    ko: "그럼 다음에 한번 봐야겠네요.",
    en: "Then I'll have to see it next time.",
    length: 4,
  },
  {
    ko: "한국에 가고 싶지만 돈이 없어요.",
    en: "I want to go to Korea, but I have no money.",
    length: 5,
  },
  {
    ko: "나에게 돈은 문제가 아니다.",
    en: "Money is not an issue for me.",
    length: 4,
  },
  {
    ko: "들어가 볼까요?",
    en: "Shall we go in?",
    length: 2,
  },
  {
    ko: "와 줘서 고마워요.",
    en: "Thanks for coming.",
    length: 3,
  },
  {
    ko: "그럼, 잠깐이라도 좀 쉬지 그래요?",
    en: "So, why don't you take a break for a while?",
    length: 5,
  },
  {
    ko: "크게 말해도 할머니가 못 들어요.",
    en: "Grandma can't hear me even if I speak loudly.",
    length: 5,
  },
  {
    ko: "생각해 보니까 나도 잘못했었어.",
    en: "Come to think of it, I was wrong too.",
    length: 4,
  },
  {
    ko: "내일 부모님이 미국에서 오셔서 학교에 못 감.",
    en: "My parents come from America tomorrow so I can't go to school.",
    length: 7,
  },
  {
    ko: "그거라도 주세요.",
    en: "give me that too",
    length: 2,
  },
  {
    ko: "은행하고 공원 사이에 있어요.",
    en: "It's between the bank and the park.",
    length: 4,
  },
  {
    ko: "막상 휴학하고 보니까 심심하고 학교생활이 그리워요.",
    en: "After taking a leave of absence, I feel bored and miss my school life.",
    length: 6,
  },
  {
    ko: "약국은 학교하고 경찰서 사이에 있어요.",
    en: "The pharmacy is between the school and the police station.",
    length: 5,
  },
  {
    ko: "기차로 가세요.",
    en: "Go by train.",
    length: 2,
  },
  {
    ko: "만원만 빌려 주세요.",
    en: "Please lend me ten thousand won.",
    length: 3,
  },
  {
    ko: "무슨 음식을 좋아해요?",
    en: "What food do you like?",
    length: 3,
  },
  {
    ko: "햄버거하고 콜라 주세요.",
    en: "A hamburger and a Coke, please.",
    length: 3,
  },
  {
    ko: "같이 가 주세요.",
    en: "Please go with me.",
    length: 3,
  },
  {
    ko: "내일 몇 시쯤 만날까요?",
    en: "What time shall we meet tomorrow?",
    length: 4,
  },
  {
    ko: "저는 제주도에 여러 번 가 봤어요.",
    en: "I have been to Jeju Island several times.",
    length: 6,
  },
  {
    ko: "물어보는 거 어떤 것 같아요?",
    en: "What do you think you are asking?",
    length: 5,
  },
  {
    ko: "그것 말고 다른 것은 없어요?",
    en: "Anything other than that?",
    length: 5,
  },
  {
    ko: "광주로 해서 가는 것도 좋아요.",
    en: "It is also good to go to Gwangju.",
    length: 5,
  },
  {
    ko: "아직 9시인데 벌써 졸려요.",
    en: "It's still 9 o'clock, but I'm already sleepy.",
    length: 4,
  },
  {
    ko: "샐리가 보는 영화는 한국 영화예요.",
    en: "The movies Sally is watching are Korean movies.",
    length: 5,
  },
  {
    ko: "친구하고 영화 봤어요.",
    en: "I watched a movie with a friend.",
    length: 3,
  },
  {
    ko: "몇 달 만에 집에 왔습니까?",
    en: "How many months have you been home?",
    length: 5,
  },
  {
    ko: "내일 우리 만날 수 있는지 알고 싶어요.",
    en: "I want to know if we can meet tomorrow.",
    length: 7,
  },
  {
    ko: "좋은 것 같아요.",
    en: "I think it's good.",
    length: 3,
  },
  {
    ko: "무엇을 드시겠습니까?",
    en: "What would you like to eat?",
    length: 2,
  },
  {
    ko: "저는 아이들에게 노래를 불러 주었습니다.",
    en: "I sang songs to the children.",
    length: 5,
  },
  {
    ko: "싼 옷을 샀어요.",
    en: "I bought cheap clothes.",
    length: 3,
  },
  {
    ko: "학비를 내느라고 돈을 다 썼어요.",
    en: "I spent all my money to pay my school fees.",
    length: 5,
  },
  {
    ko: "술 안 마신 척하지 마세요.",
    en: "Don't pretend you haven't been drinking.",
    length: 5,
  },
  {
    ko: "회사에 지각한 적이 없어요.",
    en: "I've never been late to the company.",
    length: 4,
  },
  {
    ko: "힘들어 죽겠어요.",
    en: "I'm dying hard",
    length: 2,
  },
  {
    ko: "컴퓨터 대신에 카메라를 샀어요.",
    en: "I bought a camera instead of a computer.",
    length: 4,
  },
  {
    ko: "지금 듣는 거는 노래예요.",
    en: "What I am listening to right now is a song.",
    length: 4,
  },
  {
    ko: "그러면 그분도 오시겠군요.",
    en: "Then he will come too.",
    length: 3,
  },
  {
    ko: "저기 내 친구들 온다.",
    en: "there come my friends",
    length: 4,
  },
  {
    ko: "엄마만큼 잘하지는 못했지만 그래도 아주 기뻐하셨어요.",
    en: "I wasn't as good as my mother, but she was very happy.",
    length: 6,
  },
  {
    ko: "셔츠를 입으세요.",
    en: "wear a shirt",
    length: 2,
  },
  {
    ko: "여기가 맞는지 잘 모르겠어요.",
    en: "I'm not sure if this is correct.",
    length: 4,
  },
  {
    ko: "이 문제는 어려워요.",
    en: "This problem is difficult.",
    length: 3,
  },
  {
    ko: "내가 눈이 높은 걸까?",
    en: "Do I have high eyes?",
    length: 4,
  },
  {
    ko: "습도가 낮아서 그런지 그렇게 덥지는 않은데요.",
    en: "It's not that hot because the humidity is low.",
    length: 6,
  },
  {
    ko: "샤워를 하니까 기분이 좋아요.",
    en: "I feel good when I take a shower.",
    length: 4,
  },
  {
    ko: "얼마에 팔 거예요?",
    en: "how much will you sell it for?",
    length: 3,
  },
  {
    ko: "컵에 커피와 크림, 설탕을 넣고 저어요.",
    en: "Put the coffee, cream and sugar in a cup and stir.",
    length: 6,
  },
  {
    ko: "차가운 물에 넣지 말고 뜨거운 물에 넣으세요.",
    en: "Do not put it in cold water, put it in hot water.",
    length: 7,
  },
  {
    ko: "불고기를 만들래요.",
    en: "I want to make bulgogi.",
    length: 2,
  },
  {
    ko: "방에 전화가 있어요?",
    en: "Is there a phone in the room?",
    length: 3,
  },
  {
    ko: "제 친구가 알 수도 있어요.",
    en: "My friend might know.",
    length: 5,
  },
  {
    ko: "다음 달부터 버스 요금이 오른다.",
    en: "Bus fares will rise from next month.",
    length: 5,
  },
  {
    ko: "집에 가도 밥이 없어요.",
    en: "Even when I go home, there is no rice.",
    length: 4,
  },
  {
    ko: "자세히 보니까 아는 사람이었습니다.",
    en: "Looking closely, it was someone I knew.",
    length: 4,
  },
  {
    ko: "그 소식 들었어요?",
    en: "did you hear the news?",
    length: 3,
  },
  {
    ko: "좀 전에 커피를 마셨더니 괜찮은데요.",
    en: "I drank coffee a while ago and it's fine.",
    length: 5,
  },
  {
    ko: "주말에 낚시를 할 거예요.",
    en: "I will go fishing on the weekend.",
    length: 4,
  },
  {
    ko: "샐리 씨 계세요?",
    en: "Are you Sally?",
    length: 3,
  },
  {
    ko: "운전하면서 전화하지 마세요.",
    en: "Do not call while driving.",
    length: 3,
  },
  {
    ko: "밥을 안 먹었기 때문에 힘이 없습니다.",
    en: "I have no energy because I haven't eaten.",
    length: 6,
  },
  {
    ko: "커피숍은 시끄러울 텐데요.",
    en: "The coffee shop must be noisy.",
    length: 3,
  },
  {
    ko: "어머니는 어제 책을 읽으셨어요.",
    en: "My mother read a book yesterday.",
    length: 4,
  },
  {
    ko: "그 배우가 결혼할지도 모른대요.",
    en: "They say the actor might get married.",
    length: 4,
  },
  {
    ko: "마음이 넓은 사람.",
    en: "a broad-minded person.",
    length: 3,
  },
  {
    ko: "철수는 다음 주에 한국으로 간다고 해요.",
    en: "Cheolsu says he is going to Korea next week.",
    length: 6,
  },
  {
    ko: "남편 직장 때문에 외국에 가게 됐어요.",
    en: "I went abroad because of my husband's job.",
    length: 6,
  },
  {
    ko: "그 사람이 일본 사람인지 아닌지 모르겠어요.",
    en: "I don't know if that person is Japanese or not.",
    length: 6,
  },
  {
    ko: "우리는 이야기하면서 걸어갔습니다.",
    en: "We walked as we talked.",
    length: 3,
  },
  {
    ko: "돈을 벌어서 카메라를 살 거예요.",
    en: "I will earn money and buy a camera.",
    length: 5,
  },
  {
    ko: "저는 그분을 꼭 만나야 됩니다.",
    en: "I must meet him.",
    length: 5,
  },
  {
    ko: "크리스마스 파티랑 같았어요.",
    en: "It was like a Christmas party.",
    length: 3,
  },
  {
    ko: "내일 알게 될 거예요.",
    en: "You'll find out tomorrow.",
    length: 4,
  },
  {
    ko: "싸면 쌀수록 많이 살 수 있어요.",
    en: "The cheaper it is, the more you can buy.",
    length: 6,
  },
  {
    ko: "수박은 사과보다 더 커요.",
    en: "Watermelons are bigger than apples.",
    length: 4,
  },
  {
    ko: "네, 모든 교실에 다 있어요.",
    en: "Yes, it is in every classroom.",
    length: 5,
  },
  {
    ko: "오래오래 사세요.",
    en: "live a long time",
    length: 2,
  },
  {
    ko: "길이 막히니까 지하철을 탑시다.",
    en: "The road is blocked, so let's take the subway.",
    length: 4,
  },
  {
    ko: "축구하다가 넘어지는 바람에 다리를 다쳤어요.",
    en: "I fell down while playing soccer and hurt my leg.",
    length: 5,
  },
  {
    ko: "한국어를 공부하고 친구를 만나요.",
    en: "Study Korean and meet friends.",
    length: 4,
  },
  {
    ko: "어제 누가 왔어요?",
    en: "Who came yesterday?",
    length: 3,
  },
  {
    ko: "우리는 작년부터 사귀게 되었습니다.",
    en: "We've been dating since last year.",
    length: 4,
  },
  {
    ko: "한국어는 어려워요.",
    en: "Korean is difficult.",
    length: 2,
  },
  {
    ko: "많이 샀는데 이제 갈까요?",
    en: "I bought a lot, shall we go now?",
    length: 4,
  },
  {
    ko: "지금 바쁜데요.",
    en: "I'm busy right now.",
    length: 2,
  },
  {
    ko: "10분 더 기다려 주세요.",
    en: "Please wait another 10 minutes.",
    length: 4,
  },
  {
    ko: "지금 안 오면 후회할 거예요.",
    en: "You will regret it if you don't come now.",
    length: 5,
  },
  {
    ko: "오늘 쉬어도 돼요.",
    en: "You can rest today.",
    length: 3,
  },
  {
    ko: "감기에 걸려서 병원에 갔어요.",
    en: "I caught a cold and went to the hospital.",
    length: 4,
  },
  {
    ko: "그래서 그런지 나는 아직까지 남자 친구가 없다.",
    en: "Maybe that's why I don't have a boyfriend yet.",
    length: 7,
  },
  {
    ko: "요즘 좋아하는 가수는 누구예요?",
    en: "Who is your favorite singer these days?",
    length: 4,
  },
  {
    ko: "유학을 포기하는 대신에 여기에서 대학원에 진학하기로 했어요.",
    en: "Instead of giving up studying abroad, I decided to go to graduate school here.",
    length: 7,
  },
  {
    ko: "학교에 다니면서 아르바이트를 해요.",
    en: "I work part-time while attending school.",
    length: 4,
  },
  {
    ko: "여자 친구 생일이에요.",
    en: "It's my girlfriend's birthday.",
    length: 3,
  },
  {
    ko: "피곤해 가지고 일찍 잤습니다.",
    en: "I was tired and went to bed early.",
    length: 4,
  },
  {
    ko: "아침을 먹고 나서 신문을 봅니다.",
    en: "After breakfast, I read the newspaper.",
    length: 5,
  },
  {
    ko: "어제 푹 잤는데도 오늘 많이 피곤하네요.",
    en: "Even though I slept soundly yesterday, I am very tired today.",
    length: 6,
  },
  {
    ko: "중국에서 살았었어요.",
    en: "I lived in China.",
    length: 2,
  },
  {
    ko: "기분이 별로 좋지 않은데요.",
    en: "I'm not feeling very well.",
    length: 4,
  },
  {
    ko: "일찍 일어났더라면 비행기를 놓치지 않았을 거예요.",
    en: "If I had woken up earlier, I wouldn't have missed the flight.",
    length: 6,
  },
  {
    ko: "아침에 빵을 먹거나 우유를 마셔요.",
    en: "Eat bread or drink milk for breakfast.",
    length: 5,
  },
  {
    ko: "집에서 청소하고 빨래해요.",
    en: "I clean and do laundry at home.",
    length: 3,
  },
  {
    ko: "회사 근처 아파트에서 살려고 해요.",
    en: "I want to live in an apartment near my company.",
    length: 5,
  },
  {
    ko: "주말에 친구하고 같이 등산하기로 했어요.",
    en: "I decided to hike with my friend on the weekend.",
    length: 5,
  },
  {
    ko: "어제부터 집에서 쉬었어요.",
    en: "I've been resting at home since yesterday.",
    length: 3,
  },
  {
    ko: "소파 위에서 자고 있어요.",
    en: "sleeping on the sofa",
    length: 4,
  },
  {
    ko: "어제 학교에 갔어요.",
    en: "I went to school yesterday",
    length: 3,
  },
  {
    ko: "영어는 한국어보다 어려워요.",
    en: "English is more difficult than Korean.",
    length: 3,
  },
  {
    ko: "동아리 친구 강호영 씨에게서 전화가 왔음.",
    en: "I got a call from my club friend, Kang Ho-young.",
    length: 6,
  },
  {
    ko: "제 선물 마음에 들면 좋겠어요.",
    en: "I hope you like my gift.",
    length: 5,
  },
  {
    ko: "외국인이기 때문에 한국말을 잘 못해요.",
    en: "Because I am a foreigner, I cannot speak Korean well.",
    length: 5,
  },
  {
    ko: "서울엔 왜 왔어요?",
    en: "Why did you come to Seoul?",
    length: 3,
  },
  {
    ko: "제가 이해할 수 있도록 설명해 주세요.",
    en: "Please explain so I can understand.",
    length: 6,
  },
  {
    ko: "여러분 사랑해요.",
    en: "I love you guys.",
    length: 2,
  },
  {
    ko: "어디로 오라고요?",
    en: "Where are you coming from?",
    length: 2,
  },
  {
    ko: "테니스를 치거나 수영을 할 거예요.",
    en: "I will play tennis or go swimming.",
    length: 5,
  },
  {
    ko: "돈을 얼마씩 내면 돼요?",
    en: "How much money can I pay?",
    length: 4,
  },
  {
    ko: "교회에 다녀요.",
    en: "I go to church.",
    length: 2,
  },
  {
    ko: "대학교 졸업 후에 취직을 했어요.",
    en: "I got a job after graduating from university.",
    length: 5,
  },
  {
    ko: "맵지 않은 걸로 주세요.",
    en: "Please give me something that is not spicy.",
    length: 4,
  },
  {
    ko: "마지막 장면이 감동적이던데요.",
    en: "The last scene was touching.",
    length: 3,
  },
  {
    ko: "커피를 다 마시다.",
    en: "drink all the coffee",
    length: 3,
  },
  {
    ko: "성민 씨가 미국 사람이 아니라고 했어요.",
    en: "Seongmin said he is not American.",
    length: 6,
  },
  {
    ko: "영화 보고 싶어요.",
    en: "I want to see a movie.",
    length: 3,
  },
  {
    ko: "내일은 비가 올 것이다.",
    en: "It will rain tomorrow.",
    length: 4,
  },
  {
    ko: "학교 근처로 이사 오는 게 어때요?",
    en: "How about moving closer to school?",
    length: 6,
  },
  {
    ko: "가르쳐 주세요.",
    en: "Please teach me.",
    length: 2,
  },
  {
    ko: "얘는 아빠를 닮았는데요.",
    en: "He resembles his father.",
    length: 3,
  },
  {
    ko: "아마 안 갔을걸요.",
    en: "I probably wouldn't have gone.",
    length: 3,
  },
  {
    ko: "생일 파티를 할 거라고 들었어요.",
    en: "I heard you're going to have a birthday party.",
    length: 5,
  },
  {
    ko: "댄 씨에게 음악 CD를 주면 좋아할까요?",
    en: "Would Dan like it if I gave him a music CD?",
    length: 6,
  },
  {
    ko: "내가 아는 사람을 모두 초대했어요.",
    en: "I invited everyone I know.",
    length: 5,
  },
  {
    ko: "매운 거 잘 먹어요?",
    en: "Do you like spicy food?",
    length: 4,
  },
  {
    ko: "부산에서 서울까지 얼마나 걸려요?",
    en: "How long does it take from Busan to Seoul?",
    length: 4,
  },
  {
    ko: "은행에서 돈을 빌려 가지고 집을 샀어요.",
    en: "I borrowed money from the bank and bought a house.",
    length: 6,
  },
  {
    ko: "날씨가 추운가요?",
    en: "Is it cold?",
    length: 2,
  },
  {
    ko: "같이 걸을래요?",
    en: "would you like to walk together?",
    length: 2,
  },
  {
    ko: "그래도 갈 거예요?",
    en: "Are you still going?",
    length: 3,
  },
  {
    ko: "그런데 이상한 말을 했어요.",
    en: "But he said something strange.",
    length: 4,
  },
  {
    ko: "저는 재미있는데요.",
    en: "I'm having fun.",
    length: 2,
  },
  {
    ko: "저는 학생이에요.",
    en: "I am a student.",
    length: 2,
  },
  {
    ko: "제 이름은 요코입니다.",
    en: "My name is Yoko.",
    length: 3,
  },
  {
    ko: "우리는 나이가 같아요.",
    en: "we are the same age",
    length: 3,
  },
  {
    ko: "집이 넓은가요?",
    en: "Is your house spacious?",
    length: 2,
  },
  {
    ko: "그래서 열 개나 먹었어요.",
    en: "So I ate ten.",
    length: 4,
  },
  {
    ko: "친구가 미국에서 와요.",
    en: "A friend is from America.",
    length: 3,
  },
  {
    ko: "매일 음악을 들으면서 다니니까 좋아할 거예요.",
    en: "You will like it because you go around listening to music every day.",
    length: 6,
  },
  {
    ko: "여러분, 조용히 하세요!",
    en: "Everyone, be quiet!",
    length: 3,
  },
  {
    ko: "운전을 배우는 데 두 달 걸렸어요.",
    en: "It took me two months to learn to drive.",
    length: 6,
  },
  {
    ko: "요즘 설악산이 정말 아름답다면서요?",
    en: "Are you saying that Seoraksan is really beautiful these days?",
    length: 4,
  },
  {
    ko: "한국어를 배워요.",
    en: "learn Korean",
    length: 2,
  },
  {
    ko: "이거 물이에요.",
    en: "This is water.",
    length: 2,
  },
  {
    ko: "어차피 저도 지금 거기 가는 중이에요.",
    en: "Anyway, I'm on my way there right now.",
    length: 6,
  },
  {
    ko: "다 선생님 덕분이에요.",
    en: "It's all thanks to the teacher.",
    length: 3,
  },
  {
    ko: "시간이 없을 때 햄버거를 먹어요.",
    en: "When I don't have time, I eat hamburgers.",
    length: 5,
  },
  {
    ko: "말하지 않겠습니다.",
    en: "I won't tell you.",
    length: 2,
  },
  {
    ko: "백화점에 가는데 같이 갈래요?",
    en: "I'm going to the department store. Do you want to go with me?",
    length: 4,
  },
  {
    ko: "백화점은 좀 비싸거든요.",
    en: "Department stores are a bit expensive.",
    length: 3,
  },
  {
    ko: "나는 내년에 중국으로 가겠다.",
    en: "I will go to China next year",
    length: 4,
  },
  {
    ko: "날씨가 춥다가 갑자기 따뜻해졌어요.",
    en: "The weather was cold and then suddenly became warm.",
    length: 4,
  },
  {
    ko: "저 사람 여기 왜 왔지요?",
    en: "Why is that person here?",
    length: 5,
  },
  {
    ko: "이 컴퓨터를 어디에 놓을까요?",
    en: "Where should I put this computer?",
    length: 4,
  },
  {
    ko: "저기가 과일 가게지요?",
    en: "Is that a fruit shop?",
    length: 3,
  },
  {
    ko: "환자들이 병원에 누워 있어요.",
    en: "The patients are lying in the hospital.",
    length: 4,
  },
  {
    ko: "냉장고에 불고기 있으니까 먹어.",
    en: "Bulgogi is in the refrigerator, so eat it.",
    length: 4,
  },
  {
    ko: "얼마 동안 한국에 있을 거예요?",
    en: "How long will you be in Korea?",
    length: 5,
  },
  {
    ko: "형은 키가 커요.",
    en: "My brother is tall.",
    length: 3,
  },
  {
    ko: "사랑이란 쉽지 않아요.",
    en: "Love isn't easy.",
    length: 3,
  },
  {
    ko: "크리스마스에 무슨 선물을 받고 싶어요?",
    en: "What gift would you like to receive for Christmas?",
    length: 5,
  },
  {
    ko: "돈을 많이 벌면 집을 살 거예요.",
    en: "When I earn a lot of money, I will buy a house.",
    length: 6,
  },
  {
    ko: "저도 내일부터 투이 씨를 따라 해 봐야겠어요.",
    en: "I'm going to try to imitate Mr. Thuy from tomorrow too.",
    length: 7,
  },
  {
    ko: "비가 온다고요?",
    en: "You say it's raining?",
    length: 2,
  },
  {
    ko: "저는 퍼즐을 잘 풀어요.",
    en: "I am good at solving puzzles.",
    length: 4,
  },
  {
    ko: "맛있을수록 잘 팔려요.",
    en: "The better it tastes, the better it sells.",
    length: 3,
  },
  {
    ko: "한국에 오기 전에 어디에 살았어요?",
    en: "Where did you live before coming to Korea?",
    length: 5,
  },
  {
    ko: "아무도 안 할 거예요.",
    en: "no one will",
    length: 4,
  },
  {
    ko: "이것 좀 영어로 번역해 주시겠어요?",
    en: "Could you translate this into English?",
    length: 5,
  },
  {
    ko: "다이어트하지 않아도 돼요.",
    en: "You don't have to go on a diet.",
    length: 3,
  },
  {
    ko: "그럼 이거는 어때요?",
    en: "Then how about this one?",
    length: 3,
  },
  {
    ko: "책을 읽으세요.",
    en: "read books.",
    length: 2,
  },
  {
    ko: "아무리 부자라도.",
    en: "no matter how rich",
    length: 2,
  },
  {
    ko: "집에 갈 거예요?",
    en: "are you going home?",
    length: 3,
  },
  {
    ko: "장마철에는 갑자기 비가 올지도 몰라요.",
    en: "During the rainy season, it may suddenly rain.",
    length: 5,
  },
  {
    ko: "비빔밥에는 고추장을 넣어야 맛있지요?",
    en: "Gochujang should be added to bibimbap to make it delicious, right?",
    length: 4,
  },
  {
    ko: "그리고 저도 키가 커요.",
    en: "And I'm tall too.",
    length: 4,
  },
  {
    ko: "아니요, 배워 보니까 생각보다 쉽던데요.",
    en: "No, it turned out to be easier than I thought.",
    length: 5,
  },
  {
    ko: "제가 말할 줄 알았어요?",
    en: "did you know what i would say?",
    length: 4,
  },
  {
    ko: "지갑 안에 뭐가 들어 있었어요?",
    en: "what was in the wallet?",
    length: 5,
  },
  {
    ko: "제 친구가 한국에 올 거래요.",
    en: "My friend is coming to Korea.",
    length: 5,
  },
  {
    ko: "은행 앞에서 만날 거예요.",
    en: "I'll meet you in front of the bank.",
    length: 4,
  },
  {
    ko: "아무나 올 수 없어요.",
    en: "no one can come",
    length: 4,
  },
  {
    ko: "자는 척 그만하고 일어나요.",
    en: "Stop pretending to sleep and wake up.",
    length: 4,
  },
  {
    ko: "어제 못 자서 그래요.",
    en: "It's because I couldn't sleep yesterday.",
    length: 4,
  },
  {
    ko: "우리 가족은 네 명이에요.",
    en: "There are four people in my family.",
    length: 4,
  },
  {
    ko: "꼼꼼하게 확인해 가며 진행할게요.",
    en: "I will go ahead and check it carefully.",
    length: 4,
  },
  {
    ko: "이 드라마 몰랐는데 재미있네요.",
    en: "I didn't know this drama, but it's interesting.",
    length: 4,
  },
  {
    ko: "똑똑할 뿐만 아니라 성격도 좋아요.",
    en: "Not only is he smart, but he also has a good personality.",
    length: 5,
  },
  {
    ko: "서울에 와서 좋아요.",
    en: "It's nice to come to Seoul.",
    length: 3,
  },
  {
    ko: "길을 건너서 오른쪽으로 가면 경찰서가 있거든요.",
    en: "Cross the street and turn right. There is a police station.",
    length: 6,
  },
  {
    ko: "물어도 대답이 없어요.",
    en: "Even if I ask, there is no answer.",
    length: 3,
  },
  {
    ko: "감기에 걸려서 약을 먹어야 돼요.",
    en: "I have a cold and need to take medicine.",
    length: 5,
  },
  {
    ko: "한국 음악을 들을 거예요.",
    en: "I will listen to Korean music.",
    length: 4,
  },
  {
    ko: "여자들은 꽃을 좋아하니까 꽃을 선물하세요.",
    en: "Women love flowers, so give them flowers.",
    length: 5,
  },
  {
    ko: "그 사람은 학생이 아니라 선생님이에요.",
    en: "That person is a teacher, not a student.",
    length: 5,
  },
  {
    ko: "집이 멀어서 학교 근처로 옮겨야겠어요.",
    en: "My house is far away, so I need to move closer to school.",
    length: 5,
  },
  {
    ko: "이것만 살 거예요.",
    en: "I will only buy this.",
    length: 3,
  },
  {
    ko: "제가 집에 없는 동안 찾아온 사람 있었어요?",
    en: "Has anyone visited while I was away?",
    length: 7,
  },
  {
    ko: "축구를 할 수 있어요.",
    en: "I can play soccer.",
    length: 4,
  },
  {
    ko: "이거 뭐인 것 같아요?",
    en: "What do you think this is?",
    length: 4,
  },
  {
    ko: "그럼 연락된 사람이라도 꼭 오라고 하세요.",
    en: "Then, please make sure to come to anyone who has been contacted.",
    length: 6,
  },
  {
    ko: "그런데 할 수 있어요.",
    en: "But you can.",
    length: 4,
  },
  {
    ko: "진짜 운동했어요.",
    en: "I really worked out.",
    length: 2,
  },
  {
    ko: "그리고 요코 씨도 왔어요.",
    en: "And Yoko-san came too.",
    length: 4,
  },
  {
    ko: "이 과자가 맛있어요.",
    en: "These sweets are delicious.",
    length: 3,
  },
  {
    ko: "별로 안 나빠요.",
    en: "Not too bad.",
    length: 3,
  },
  {
    ko: "아버지는 지금 텔레비전을 보세요.",
    en: "Dad is watching TV now.",
    length: 4,
  },
  {
    ko: "너라도 와서 좀 도와줘.",
    en: "You can come and help me too.",
    length: 4,
  },
  {
    ko: "서울은 겨울에 정말 추워요.",
    en: "Seoul is really cold in winter.",
    length: 4,
  },
  {
    ko: "학교에 갔어요.",
    en: "I went to school.",
    length: 2,
  },
  {
    ko: "손님이 계세요.",
    en: "You have guests.",
    length: 2,
  },
  {
    ko: "제 친구는 미국인인데 영어를 영국 사람처럼 해요.",
    en: "My friend is an American and speaks English like a British person.",
    length: 7,
  },
  {
    ko: "늘 자세를 바르게 하려고 노력해요.",
    en: "I always try to keep my posture right.",
    length: 5,
  },
  {
    ko: "예전에 제가 자주 가던 곳이에요.",
    en: "It's a place I used to go often in the past.",
    length: 5,
  },
  {
    ko: "비타민 C가 감기에 좋잖아요.",
    en: "Vitamin C is good for colds.",
    length: 4,
  },
  {
    ko: "이 문법 문제를 잘 모르겠어요.",
    en: "I'm not sure about this grammar problem.",
    length: 5,
  },
  {
    ko: "우리 형은 변호사다.",
    en: "My brother is a lawyer",
    length: 3,
  },
  {
    ko: "한국말을 모르고 한국에 갔어요.",
    en: "I went to Korea without knowing Korean.",
    length: 4,
  },
  {
    ko: "저는 수박과 딸기를 좋아해요.",
    en: "I like watermelon and strawberries.",
    length: 4,
  },
  {
    ko: "이번 제 생일에는 집에서 파티를 할까 해요.",
    en: "I'm thinking of having a party at my house this birthday.",
    length: 7,
  },
  {
    ko: "농구를 잘하려면 점프를 잘해야 돼요.",
    en: "To be good at basketball, you have to be good at jumping.",
    length: 5,
  },
  {
    ko: "다음에 같이해요.",
    en: "Let's do it together next time.",
    length: 2,
  },
  {
    ko: "엄마는 뭐든지 네가 좋아하는 일을 하면 좋겠어.",
    en: "Mom, I want you to do whatever you like.",
    length: 7,
  },
  {
    ko: "아버지는 키가 커요.",
    en: "My father is tall.",
    length: 3,
  },
  {
    ko: "어디가 아파요?",
    en: "Are you sick anywhere?",
    length: 2,
  },
  {
    ko: "일하고 있어요.",
    en: "I am working.",
    length: 2,
  },
  {
    ko: "그럼, 다른 옷으로 바꾸거나 환불을 하지 그래요?",
    en: "Then, why don't you change it to something else or give me a refund?",
    length: 7,
  },
  {
    ko: "이상한 것 같아요.",
    en: "I think it's strange.",
    length: 3,
  },
  {
    ko: "부디 씨가 가져오기로 했어요.",
    en: "Mr. Budi decided to bring it.",
    length: 4,
  },
  {
    ko: "내일 영화를 보고 서점에 갈 거예요.",
    en: "I'm going to see a movie tomorrow and go to the bookstore.",
    length: 6,
  },
  {
    ko: "가족끼리 한 번쯤 갈 만해요.",
    en: "Worth going with family at least once.",
    length: 5,
  },
  {
    ko: "왼편에 있어요.",
    en: "It's on the left.",
    length: 2,
  },
  {
    ko: "도서관에서 책을 읽어요.",
    en: "I read a book in the library.",
    length: 3,
  },
  {
    ko: "이름이 뭐예요?",
    en: "what's your name?",
    length: 2,
  },
  {
    ko: "컴퓨터하고 비슷해요.",
    en: "It's like a computer.",
    length: 2,
  },
  {
    ko: "책을 많이 읽었더니 눈이 피곤해요.",
    en: "My eyes are tired after reading a lot.",
    length: 5,
  },
  {
    ko: "텔레비전 보고 싶어요.",
    en: "I want to watch TV.",
    length: 3,
  },
  {
    ko: "커피가 뜨거우니까 조심하세요.",
    en: "The coffee is hot, so be careful.",
    length: 3,
  },
  {
    ko: "어제 생일 파티에 누가 왔어요?",
    en: "Who came to the birthday party yesterday?",
    length: 5,
  },
  {
    ko: "책 읽고 공부하고 운동했어요.",
    en: "I read, studied, and exercised.",
    length: 4,
  },
  {
    ko: "잘 모르겠어요.",
    en: "I do not know.",
    length: 2,
  },
  {
    ko: "전화번호가 뭐예요?",
    en: "what's your phone number?",
    length: 2,
  },
  {
    ko: "오천 원짜리밖에 없는데 큰일 났군요.",
    en: " It's a big problem because I only have a 5,000 won bill.",
    length: 5,
  },
  {
    ko: "그리고 태권도도 할 수 있어요.",
    en: "And I can do taekwondo.",
    length: 5,
  },
  {
    ko: "그래서 집에 있었어요.",
    en: "So I was at home.",
    length: 3,
  },
  {
    ko: "박영민 씨가 성실하니까 박영민 씨가 가게 하세요.",
    en: "Park Young-min is sincere, so let Park Young-min go.",
    length: 7,
  },
  {
    ko: "어떻게 찾았어요?",
    en: "How did you find it?",
    length: 2,
  },
  {
    ko: "차를 고치는 데 30만 원 들었어요.",
    en: "It cost 300,000 won to fix the car.",
    length: 6,
  },
  {
    ko: "자동차 밑에 뭐가 있어요?",
    en: "What's under the car?",
    length: 4,
  },
  {
    ko: "오늘 공부 안 해도 돼요.",
    en: "I can't study today.",
    length: 5,
  },
  {
    ko: "노래방에 가야 돼요.",
    en: "I have to go to karaoke.",
    length: 3,
  },
  {
    ko: "친구와 의논해 봐야겠어요.",
    en: "I'll have to discuss it with a friend.",
    length: 3,
  },
  {
    ko: "떡볶이가 매워서 먹을 수가 없어요.",
    en: "I can't eat the tteokbokki because it's spicy.",
    length: 5,
  },
  {
    ko: "저는 은행에서 일해요.",
    en: "I work at a bank.",
    length: 3,
  },
  {
    ko: "주말에 산에 갈래요.",
    en: "I want to go to the mountains on the weekend.",
    length: 3,
  },
  {
    ko: "왜 사과를 깎지 않고 먹어요?",
    en: "Why do you eat apples without peeling them?",
    length: 5,
  },
  {
    ko: "시간 맞춰서 도착하기는 했는데 준비를 못 했어요.",
    en: "I arrived on time, but I wasn't ready.",
    length: 7,
  },
  {
    ko: "요즘 3개에 2,000원쯤 해요.",
    en: "These days, it's around 2,000 won for three.",
    length: 4,
  },
  {
    ko: "저는 노래를 못 불러요.",
    en: "i can't sing",
    length: 4,
  },
  {
    ko: "그래서 올해는 가을에 휴가를 가려고요.",
    en: "So this year, I'm going on vacation in the fall.",
    length: 5,
  },
  {
    ko: "점심시간은 오후 1시부터 2시까지입니다.",
    en: "Lunchtime is from 1:00 PM to 2:00 PM.",
    length: 4,
  },
  {
    ko: "길이 복잡해서 지하철을 타요.",
    en: "The road is complicated, so I take the subway.",
    length: 4,
  },
  {
    ko: "더 보여 주세요.",
    en: "show me more",
    length: 3,
  },
  {
    ko: "다 끝났는지 잘 모르겠어요.",
    en: "I'm not sure if it's over.",
    length: 4,
  },
  {
    ko: "기분이 좋기는 하지만 좀 춥네요.",
    en: "It feels good, but it's a bit cold.",
    length: 5,
  },
  {
    ko: "왜 전화했어요?",
    en: "why did you call",
    length: 2,
  },
  {
    ko: "사람이 많은 곳은 피하도록 하십시오.",
    en: "Avoid crowded places.",
    length: 5,
  },
  {
    ko: "지금 바빠요?",
    en: "Are you busy now?",
    length: 2,
  },
  {
    ko: "송별회 시간이 바뀌었음.",
    en: "Farewell party time has changed.",
    length: 3,
  },
  {
    ko: "일본어는 한국어하고 비슷해요.",
    en: "Japanese is similar to Korean.",
    length: 3,
  },
  {
    ko: "10시까지 오십시오.",
    en: "Please come by 10.",
    length: 2,
  },
  {
    ko: "금요일 5시임.",
    en: "It's 5 o'clock on Friday.",
    length: 2,
  },
  {
    ko: "백화점에 가요.",
    en: "go to the department store",
    length: 2,
  },
  {
    ko: "건강을 위해서.",
    en: "For health.",
    length: 2,
  },
  {
    ko: "우리 엄마한테 선물을 받았어요.",
    en: "I got a present from my mom.",
    length: 4,
  },
  {
    ko: "아이가 혼자서 잘 놉니다.",
    en: "The child plays well alone.",
    length: 4,
  },
  {
    ko: "이리 들어오시지요.",
    en: "come in here",
    length: 2,
  },
  {
    ko: "전혀 안 더워요.",
    en: "It's not hot at all.",
    length: 3,
  },
  {
    ko: "아니요, 모르는 사람이에요.",
    en: "No, I don't know.",
    length: 3,
  },
  {
    ko: "오늘 저녁에 콘서트 보러 갈 거냬요.",
    en: "I'm going to go see a concert tonight.",
    length: 6,
  },
  {
    ko: "다시 한번 해 봐.",
    en: "Try again.",
    length: 4,
  },
  {
    ko: "차가 있었으면 좋겠어요.",
    en: "I wish I had a car.",
    length: 3,
  },
  {
    ko: "저는 겨울에 갔는데 한국보다 따뜻하더군요.",
    en: "I went in winter and it was warmer than Korea.",
    length: 5,
  },
  {
    ko: "일을 하고 나서 쉽니다.",
    en: "Relax after work.",
    length: 4,
  },
  {
    ko: "시간이 없어서 친구들을 거의 못 만나요.",
    en: "I rarely see my friends because I don't have time.",
    length: 6,
  },
  {
    ko: "잃어버리지 않으려면 펜에 이름을 쓰세요.",
    en: "Write your name on a pen so you don't lose it.",
    length: 5,
  },
  {
    ko: "민지 씨는 태국의 여름은 하루도 못 견딜걸요.",
    en: "Minji can't stand a single day of summer in Thailand.",
    length: 7,
  },
  {
    ko: "김치가 건강에 아주 좋아서 몸에 좋은 약이래.",
    en: "They say that kimchi is very good for health, so it is a good medicine for the body.",
    length: 7,
  },
  {
    ko: "티셔츠 입을 거예요.",
    en: "I will wear a t-shirt.",
    length: 3,
  },
  {
    ko: "갈 뻔 했는데, 안 갔어요.",
    en: "I was going to go, but I didn't.",
    length: 5,
  },
  {
    ko: "할 일도 없는데 잠이나 자겠어요.",
    en: "I have nothing to do, but I want to sleep.",
    length: 5,
  },
  {
    ko: "제가 학교에 간 줄 알았어요?",
    en: "Did you think I went to school?",
    length: 5,
  },
  {
    ko: "댄 씨가 일을 잘하니까 이번에 승진할 거예요.",
    en: "Because Dan does a good job, he will be promoted this time.",
    length: 7,
  },
  {
    ko: "샐리는 집에서 자고 있어요.",
    en: "Sally is sleeping at home.",
    length: 4,
  },
  {
    ko: "책상 옆에 화분하고 옷걸이가 있어요.",
    en: "There is a flower pot and a hanger next to the desk.",
    length: 5,
  },
  {
    ko: "난 여기 있을게.",
    en: "i'll be here",
    length: 3,
  },
  {
    ko: "그 영화 재미있나 봐요.",
    en: "That movie looks interesting.",
    length: 4,
  },
  {
    ko: "그럼 지금 말하면 안 돼요?",
    en: "So can't you tell me now?",
    length: 5,
  },
  {
    ko: "운전 중에 전화하면 안 돼요.",
    en: "You can't call me while driving.",
    length: 5,
  },
  {
    ko: "오늘 버스에서 앉아서 왔어요.",
    en: "I came to sit on the bus today.",
    length: 4,
  },
  {
    ko: "누군가 왔어요.",
    en: "Someone is here.",
    length: 2,
  },
  {
    ko: "우산에 이름이 쓰여 있어요.",
    en: "The umbrella has a name written on it.",
    length: 4,
  },
  {
    ko: "맥주 마실까요?",
    en: "Shall we drink beer?",
    length: 2,
  },
  {
    ko: "이탈리아에 가 본 적이 있어요?",
    en: "Have you ever been to Italy?",
    length: 5,
  },
  {
    ko: "어제 백화점에 가니까 세일을 하고 있었어요.",
    en: "When I went to the department store yesterday, there was a sale going on.",
    length: 6,
  },
  {
    ko: "아무도 안 왔네요.",
    en: "No one came.",
    length: 3,
  },
  {
    ko: "한 시간 동안 서서 와서 다리가 아파요.",
    en: "After standing for an hour, my legs hurt.",
    length: 7,
  },
  {
    ko: "다음 주에 오실 거예요.",
    en: "He'll be back next week.",
    length: 4,
  },
  {
    ko: "보통 1시에 점심을 먹어요.",
    en: "I usually have lunch at 1:00.",
    length: 4,
  },
  {
    ko: "재준 씨, 오늘 왜 이렇게 기분이 좋아요?",
    en: "Jaejoon, why are you in such a good mood today?",
    length: 7,
  },
  {
    ko: "학생이 많았나 봐요.",
    en: "I guess there were a lot of students.",
    length: 3,
  },
  {
    ko: "아무리 비싸도 제가 사 줄게요.",
    en: "No matter how expensive it is, I will buy it.",
    length: 5,
  },
  {
    ko: "문제를 두 번 읽을 거예요.",
    en: "You will read the problem twice.",
    length: 5,
  },
  {
    ko: "지금 우리나라 경제가 어렵다.",
    en: "Our economy is in trouble right now.",
    length: 4,
  },
  {
    ko: "한국이 이겼다는 얘기는 들었는데, 어떻게 이긴 거야?",
    en: "I heard that Korea won, but how did they win?",
    length: 7,
  },
  {
    ko: "방학에 중국에 갈 거예요.",
    en: "I will go to China on vacation.",
    length: 4,
  },
  {
    ko: "어떨 때 영화 보고 싶어요?",
    en: "When do you like to watch a movie?",
    length: 5,
  },
  {
    ko: "지금 시작하려나 봐요.",
    en: "I guess I'm going to start now.",
    length: 3,
  },
  {
    ko: "제 생일은 9월 1일이에요.",
    en: "My birthday is on September 1st.",
    length: 4,
  },
  {
    ko: "재미있는 사람일수록 인기가 많아요.",
    en: "The funnier you are, the more popular you are.",
    length: 4,
  },
  {
    ko: "누가 케잌 잘랐어요?",
    en: "who cut the cake?",
    length: 3,
  },
  {
    ko: "물은 더 마시고, 술은 덜 마셔야 돼요.",
    en: "You should drink more water and drink less alcohol.",
    length: 7,
  },
  {
    ko: "한국 사람이에요?",
    en: "Are you Korean?",
    length: 2,
  },
  {
    ko: "응, 추우니까 따뜻하게 입어.",
    en: "Yes, it's cold, so dress warmly.",
    length: 4,
  },
  {
    ko: "운동을 합니까?",
    en: "do you exercise?",
    length: 2,
  },
  {
    ko: "언제 만날 거예요?",
    en: "When will we meet?",
    length: 3,
  },
  {
    ko: "그분이 불편하지 않게 신경을 쓰겠습니다.",
    en: "I will take care not to make him uncomfortable.",
    length: 5,
  },
  {
    ko: "날씨가 따뜻해졌어요.",
    en: "The weather has warmed up.",
    length: 2,
  },
  {
    ko: "열심히 공부해서 장학금을 받을 거예요.",
    en: "I will study hard and get a scholarship.",
    length: 5,
  },
  {
    ko: "안 추울 리가 없어요.",
    en: "There's no way it's not cold.",
    length: 4,
  },
  {
    ko: "보기는 봤는데 기억이 안 나요.",
    en: "I saw it, but I don't remember.",
    length: 5,
  },
  {
    ko: "아이스크림 사 줘요.",
    en: "buy me ice cream",
    length: 3,
  },
  {
    ko: "달력이 벽에 걸려 있습니다.",
    en: "A calendar hangs on the wall.",
    length: 4,
  },
  {
    ko: "부모님은 캐나다에서 사세요.",
    en: "My parents live in Canada.",
    length: 3,
  },
  {
    ko: "식당은 오 층에 있어요.",
    en: "The restaurant is on the fifth floor.",
    length: 4,
  },
  {
    ko: "그동안 어떻게 지냈니?",
    en: "How have you been?",
    length: 3,
  },
  {
    ko: "오늘 학교에 안 가요.",
    en: "I am not going to school today",
    length: 4,
  },
  {
    ko: "그 옷이 아무리 비싸도 꼭 살 거예요.",
    en: "No matter how expensive the clothes are, I will definitely buy them.",
    length: 7,
  },
  {
    ko: "어차피 내일도 시간 있잖아요.",
    en: "You still have time tomorrow anyway.",
    length: 4,
  },
  {
    ko: "이거 먹어 봐요.",
    en: "Try this.",
    length: 3,
  },
  {
    ko: "생활비를 다 써 버렸어요.",
    en: "I ran out of living expenses.",
    length: 4,
  },
  {
    ko: "100명쯤 왔어요.",
    en: "About 100 people came.",
    length: 2,
  },
  {
    ko: "전화가 안 돼요.",
    en: "I can't call.",
    length: 3,
  },
  {
    ko: "지하철을 탑시다.",
    en: "let's take the subway",
    length: 2,
  },
  {
    ko: "집에 가기 전에 술 마실 거예요.",
    en: "I'm going to have a drink before I go home.",
    length: 6,
  },
  {
    ko: "프랑스어를 공부해요.",
    en: "I am studying French.",
    length: 2,
  },
  {
    ko: "저는 안 갈래요.",
    en: "i won't go",
    length: 3,
  },
  {
    ko: "고백할 용기가 없어서 지금은 바라보기만 할 뿐이에요.",
    en: "I don't have the courage to confess, so I'm just looking at it now.",
    length: 7,
  },
  {
    ko: "나는 기분이 좋으면 춤을 춰요.",
    en: "I dance when I feel like it.",
    length: 5,
  },
  {
    ko: "여자랑 남자는 달라요.",
    en: "Women and men are different.",
    length: 3,
  },
  {
    ko: "가기는 갔는데 일찍 왔어요.",
    en: "I went to go, but I came early.",
    length: 4,
  },
  {
    ko: "아무한테도 주지 마세요.",
    en: "don't give it to anyone",
    length: 3,
  },
  {
    ko: "600원짜리 음료수.",
    en: "A drink for 600 won.",
    length: 2,
  },
  {
    ko: "무엇을 배워요?",
    en: "what do you learn",
    length: 2,
  },
  {
    ko: "수업 시간에 졸려 가지고 혼났어요.",
    en: "I got scolded for being sleepy in class.",
    length: 5,
  },
  {
    ko: "오전에는 친구를 만나고 오후에는 도서관에 갈 거예요.",
    en: "I will meet my friend in the morning and go to the library in the afternoon.",
    length: 7,
  },
  {
    ko: "비행기 표를 예약했어요?",
    en: "Did you book your plane ticket?",
    length: 3,
  },
  {
    ko: "갔을 리가 없어요.",
    en: "I couldn't have gone",
    length: 3,
  },
  {
    ko: "점심시간에는 식당마다 자리가 없어요.",
    en: "There are no seats at all restaurants during lunch time.",
    length: 4,
  },
  {
    ko: "그만 먹을래요.",
    en: "stop eating",
    length: 2,
  },
  {
    ko: "다니엘은 전화하고 있어요.",
    en: "Daniel is on the phone.",
    length: 3,
  },
  {
    ko: "듣기만 했어요.",
    en: "I just listened.",
    length: 2,
  },
  {
    ko: "비행기가 기차보다 빨라요.",
    en: "The plane is faster than the train.",
    length: 3,
  },
  {
    ko: "사고로 다치다.",
    en: "injured in an accident",
    length: 2,
  },
  {
    ko: "기분이 좋아서 춤을 췄어요.",
    en: "I danced because I felt good.",
    length: 4,
  },
  {
    ko: "네, 영화가 너무 슬퍼서 울고 있어요.",
    en: "Yes, I am crying because the movie is so sad.",
    length: 6,
  },
  {
    ko: "잠을 자지 않으려고 커피를 5잔이나 마셨어요.",
    en: "I drank 5 cups of coffee to stay awake.",
    length: 6,
  },
  {
    ko: "여름휴가 때 여행을 하려고 해요.",
    en: "I want to travel during my summer vacation.",
    length: 5,
  },
  {
    ko: "다른 것에 비해서 듣기가 너무 어려워요.",
    en: "It's so hard to hear compared to the others.",
    length: 6,
  },
  {
    ko: "일주일에 한 번씩 영화를 봐요.",
    en: "I watch a movie once a week.",
    length: 5,
  },
  {
    ko: "누구한테 줘야 돼요?",
    en: "Who should I give it to?",
    length: 3,
  },
  {
    ko: "더우니까 에어컨 켤까요?",
    en: "It's hot. Shall we turn on the air conditioner?",
    length: 3,
  },
  {
    ko: "외국으로 출장을 가게 됐어요.",
    en: "I went on a business trip abroad.",
    length: 4,
  },
  {
    ko: "금요일에는 정장을 입지 않아도 돼요.",
    en: "You don't have to wear a suit on Friday.",
    length: 5,
  },
  {
    ko: "내일 만날지 안 만날지 잘 모르겠어요.",
    en: "I don't know if I'll see you tomorrow or not.",
    length: 6,
  },
  {
    ko: "여자 친구에게 목걸이를 사 주었어요.",
    en: "I bought a necklace for my girlfriend.",
    length: 5,
  },
  {
    ko: "작년에 같이 공부했던 크리스 기억나?",
    en: "Do you remember Chris, who studied together last year?",
    length: 5,
  },
  {
    ko: "오후 5시에 들어오실 겁니다.",
    en: "You will come in at 5pm.",
    length: 4,
  },
  {
    ko: "나는 그분을 만난 적이 있습니다.",
    en: "I've met him",
    length: 5,
  },
  {
    ko: "소파에서 자는 사람이 누구예요?",
    en: "Who's sleeping on the sofa?",
    length: 4,
  },
  {
    ko: "오늘 저녁에 먹을 한국 음식이 뭐예요?",
    en: "What Korean food do you have for dinner tonight?",
    length: 6,
  },
  {
    ko: "오늘 안에 돼요?",
    en: "can you do it today?",
    length: 3,
  },
  {
    ko: "요즘 운전을 배우는 중이에요.",
    en: "I am currently learning to drive.",
    length: 4,
  },
  {
    ko: "아무데나 좋아요.",
    en: "Anywhere is fine.",
    length: 2,
  },
  {
    ko: "나라마다 국기가 달라요.",
    en: "Each country has a different flag.",
    length: 3,
  },
  {
    ko: "댄 씨가 이 책을 읽었을까요?",
    en: "Did Dan read this book?",
    length: 5,
  },
  {
    ko: "집에 가거나 친구를 만날 거예요.",
    en: "I will go home or meet a friend.",
    length: 5,
  },
  {
    ko: "다시 하는 거 어때요?",
    en: "How about doing it again?",
    length: 4,
  },
  {
    ko: "오늘따라 정말 초조하네요.",
    en: "I'm really nervous today.",
    length: 3,
  },
  {
    ko: "케익을 사서 친구한테 줄 거예요.",
    en: "I will buy a cake and give it to my friend.",
    length: 5,
  },
  {
    ko: "다음 주에 끝날 거라고 했잖아요.",
    en: "You said it would be over next week.",
    length: 5,
  },
  {
    ko: "내일 다시 올 거라고 말해 주세요.",
    en: "Please tell me you will come back tomorrow.",
    length: 6,
  },
  {
    ko: "점심을 먹은 뒤에 도서관에 갔어요.",
    en: "After lunch, I went to the library.",
    length: 5,
  },
  {
    ko: "어제 재미있었나 봐요.",
    en: "It must have been fun yesterday.",
    length: 3,
  },
  {
    ko: "뭐 하고 싶어요?",
    en: "What do you want to do?",
    length: 3,
  },
  {
    ko: "꽃이 다 피어 가요.",
    en: "The flowers are all blooming.",
    length: 4,
  },
  {
    ko: "생활비가 부족한데도 친구들에게 술을 자꾸 사 주잖아요.",
    en: "Even though living expenses are not enough, he keeps buying drinks for his friends.",
    length: 7,
  },
  {
    ko: "나중에 불고기를 만들어서 가족하고 같이 먹고 싶어요.",
    en: "I want to make bulgogi later and eat it with my family.",
    length: 7,
  },
  {
    ko: "항상 물어보고 싶었어요.",
    en: "I always wanted to ask.",
    length: 3,
  },
  {
    ko: "요즘에는 운동을 별로 안 해요.",
    en: "I don't exercise much these days.",
    length: 5,
  },
  {
    ko: "요리를 잘하게 되었어요.",
    en: "I became good at cooking.",
    length: 3,
  },
  {
    ko: "부모님이 한국에 오시거든요.",
    en: "My parents are coming to Korea.",
    length: 3,
  },
  {
    ko: "일하고 있을 거예요.",
    en: "will be working",
    length: 3,
  },
  {
    ko: "그런데 일요일이었어요.",
    en: "But it was Sunday.",
    length: 2,
  },
  {
    ko: "사과가 한 개밖에 안 남았어요.",
    en: "There is only one apple left.",
    length: 5,
  },
  {
    ko: "오늘 날씨가 어때요?",
    en: "How's the weather today?",
    length: 3,
  },
  {
    ko: "노래를 잘 하다.",
    en: "sing well",
    length: 3,
  },
  {
    ko: "콜라밖에 안 마셔요.",
    en: "I only drink Coke.",
    length: 3,
  },
  {
    ko: "어서 학교에 가라.",
    en: "go to school",
    length: 3,
  },
  {
    ko: "이 학교에서는 500명의 학생들이 한국어를 배운다.",
    en: "In this school, 500 students learn Korean.",
    length: 6,
  },
  {
    ko: "많으면 많을수록 좋아요.",
    en: "The more, the better.",
    length: 3,
  },
  {
    ko: "저는 운동을 싫어해요.",
    en: "I hate exercise.",
    length: 3,
  },
  {
    ko: "정민 씨가 하는 노래를 알아요.",
    en: "I know the song Jungmin sings.",
    length: 5,
  },
  {
    ko: "하늘은 파랗고 구름은 하얘서 그림 같아요.",
    en: "The sky is blue and the clouds are white, like a painting.",
    length: 6,
  },
  {
    ko: "졸업하자마자 일을 시작할 거예요.",
    en: "I will start working as soon as I graduate.",
    length: 4,
  },
  {
    ko: "사과를 깎아서 먹으면 맛이 없어요.",
    en: "If you cut an apple and eat it, it doesn't taste good.",
    length: 5,
  },
  {
    ko: "재준 씨의 우산입니다.",
    en: "This is Jaejoon's umbrella.",
    length: 3,
  },
  {
    ko: "열심히 공부해라.",
    en: "study hard.",
    length: 2,
  },
  {
    ko: "한국에 한 달쯤 있을 거예요.",
    en: "I will be in Korea for about a month.",
    length: 5,
  },
  {
    ko: "하영 씨에게는 보라색 티셔츠가 잘 어울릴 거예요.",
    en: "A purple T-shirt would suit Ha-young.",
    length: 7,
  },
  {
    ko: "컴퓨터가 빨라졌어요.",
    en: "My computer got faster.",
    length: 2,
  },
  {
    ko: "한국어를 잘 하고 싶으면, 매일 공부해야 한다.",
    en: "If you want to speak Korean well, you have to study every day.",
    length: 7,
  },
  {
    ko: "지하철을 타는 게 좋겠어요.",
    en: "I'd rather take the subway.",
    length: 4,
  },
  {
    ko: "저는 영어도 가르쳐요.",
    en: "I also teach English.",
    length: 3,
  },
  {
    ko: "여기에다가 놓으세요.",
    en: "put it here",
    length: 2,
  },
  {
    ko: "다음 달에 고향에 돌아가요.",
    en: "I will go back to my hometown next month.",
    length: 4,
  },
  {
    ko: "여기 정말 유명하대요.",
    en: "It's really famous here.",
    length: 3,
  },
  {
    ko: "땅콩으로 잼을 만들었어요.",
    en: "I made jam with peanuts.",
    length: 3,
  },
  {
    ko: "미리 예매했더라면 공연을 볼 수 있었을 거예요.",
    en: "If I had booked in advance, I would have been able to see the performance.",
    length: 7,
  },
  {
    ko: "국에다가 해물을 넣어서 끓여 먹었는데 그것 때문인가요?",
    en: "I put seafood in the soup and boiled it. Is that because of that?",
    length: 7,
  },
  {
    ko: "저는 오빠는 있는데 언니는 없어요.",
    en: "I have an older brother, but no sister.",
    length: 5,
  },
  {
    ko: "불 조심하세요.",
    en: "Be careful with the fire.",
    length: 2,
  },
  {
    ko: "집에 오자마자 잠들었어요.",
    en: "I fell asleep as soon as I got home.",
    length: 3,
  },
  {
    ko: "길이 막히니까 버스를 타지 마세요.",
    en: "Don't take the bus because the road is blocked.",
    length: 5,
  },
  {
    ko: "에릭 씨는 자동차를 사고 싶어 해요.",
    en: "Eric wants to buy a car.",
    length: 6,
  },
  {
    ko: "비행기가 자주 있어요?",
    en: "Are there frequent flights?",
    length: 3,
  },
  {
    ko: "한 시간 걸었어요.",
    en: "I walked an hour.",
    length: 3,
  },
  {
    ko: "한국말을 잘하려면 매일 한국말로만 이야기하세요.",
    en: "If you want to speak Korean well, speak only in Korean every day.",
    length: 5,
  },
  {
    ko: "조금 기다려 주실래요?",
    en: "could you wait a bit?",
    length: 3,
  },
  {
    ko: "가스 불을 켜 놓고 나왔다고요?",
    en: "Did you leave the gas light on?",
    length: 5,
  },
  {
    ko: "샐리는 요즘 시험이 있어서 아주 바빠요.",
    en: "Sally is very busy these days because she has an exam.",
    length: 6,
  },
  {
    ko: "학교 앞에서 버스로 갈아타세요.",
    en: "Change to the bus in front of the school.",
    length: 4,
  },
  {
    ko: "한자를 읽을 수 없어요.",
    en: "I can't read Chinese characters.",
    length: 4,
  },
  {
    ko: "그리고 딸기도 좋아해요.",
    en: "And I like strawberries too.",
    length: 3,
  },
  {
    ko: "이번 주말에 캐럴 씨와 데이트하기로 했어요.",
    en: "I'm going to go on a date with Carol this weekend.",
    length: 6,
  },
  {
    ko: "여기 있었는데.",
    en: "I was here",
    length: 2,
  },
  {
    ko: "여기는 다른 곳에 비해서 조용한 편이에요.",
    en: "It's quiet here compared to other places.",
    length: 6,
  },
  {
    ko: "그러면, 다음에는 너 초대 안 한다.",
    en: "Then, next time, I won't invite you.",
    length: 6,
  },
  {
    ko: "그 사람은 믿을 만해요.",
    en: "That person is trustworthy.",
    length: 4,
  },
  {
    ko: "어떻게 하면 한국말을 그렇게 잘할 수 있습니까?",
    en: "How can you speak Korean so well?",
    length: 7,
  },
  {
    ko: "이거 너무 귀여워요.",
    en: "This is so cute.",
    length: 3,
  },
  {
    ko: "다음부터는 조심해야겠어요.",
    en: "I'll have to be careful next time.",
    length: 2,
  },
  {
    ko: "많이 당황했겠어요.",
    en: "I must have been very upset.",
    length: 2,
  },
  {
    ko: "그래도 축구를 했어요.",
    en: "I still played soccer.",
    length: 3,
  },
  {
    ko: "무엇이든지 한 번에 많이는 좋지 않아요.",
    en: "Too much of anything at once is not good.",
    length: 6,
  },
  {
    ko: "집에 가니까 아무도 없었습니다.",
    en: "When I got home, no one was there.",
    length: 4,
  },
  {
    ko: "아이들하고 축구를 하고 있을 때 우리는 행복했습니다.",
    en: "We were happy when we were playing football with our children.",
    length: 7,
  },
  {
    ko: "아무리 학생이라도 공부만 하는 건 아니에요.",
    en: "No matter how much a student is, it's not just studying.",
    length: 6,
  },
  {
    ko: "오늘 몇 월 며칠이에요?",
    en: "What month and what day is it today?",
    length: 4,
  },
  {
    ko: "믿을 뻔 했어요.",
    en: "I almost believed it.",
    length: 3,
  },
  {
    ko: "아무 맛도 없어요.",
    en: "It has no taste.",
    length: 3,
  },
  {
    ko: "5대나 있어요.",
    en: "There are 5 of them.",
    length: 2,
  },
  {
    ko: "혼자 밥 먹기를 싫어해요.",
    en: "I hate eating alone.",
    length: 4,
  },
  {
    ko: "어제 자고 있었는데 한국에서 전화가 왔어요.",
    en: "I was sleeping yesterday when I got a call from Korea.",
    length: 6,
  },
  {
    ko: "당근을 많이 먹으면 눈이 좋아져요.",
    en: "If you eat a lot of carrots, your eyes will improve.",
    length: 5,
  },
  {
    ko: "그러니까 집에서 좀 일찍 출발하지 그랬어요?",
    en: "So why don't you leave home a little early?",
    length: 6,
  },
  {
    ko: "저 방금 왔거든요.",
    en: "I just came.",
    length: 3,
  },
  {
    ko: "몇 번 버스를 타요?",
    en: "How many buses do you take?",
    length: 4,
  },
  {
    ko: "네 명이 넘게 오니까 모자랄 것 같은데요.",
    en: "I don't think there will be enough since there are more than four of us.",
    length: 7,
  },
  {
    ko: "일곱 시 십 분에 세수해요.",
    en: "I wash my face at 7:00.",
    length: 5,
  },
  {
    ko: "누구한테 편지를 써요?",
    en: "Who are you writing to?",
    length: 3,
  },
  {
    ko: "과자라도 먹을래요?",
    en: "Would you like some sweets?",
    length: 2,
  },
  {
    ko: "여기 앉아도 돼요?",
    en: "Can I sit here?",
    length: 3,
  },
  {
    ko: "김 대통령은 어제 한국으로 돌아갔다.",
    en: "President Kim returned to Korea yesterday.",
    length: 5,
  },
  {
    ko: "무거워서 떨어뜨릴 뻔 했어요.",
    en: "It was so heavy I almost dropped it.",
    length: 4,
  },
  {
    ko: "직업은 회사원이고 한국에 온 지 1년이 되었습니다.",
    en: "My job is an office worker and it has been 1 year since I came to Korea.",
    length: 7,
  },
  {
    ko: "부장님, 그럼 제가 통역을 하겠습니다.",
    en: "Manager, then I will interpret for you.",
    length: 5,
  },
  {
    ko: "아마 커피숍에 있을걸요.",
    en: "Probably at a coffee shop.",
    length: 3,
  },
  {
    ko: "그러면 이거는 뭐예요?",
    en: "So what is this?",
    length: 3,
  },
  {
    ko: "몇 시에 올 거냐고 물어보세요.",
    en: "Ask what time will you come?",
    length: 5,
  },
  {
    ko: "어제 보던 영화.",
    en: "The movie I saw yesterday.",
    length: 3,
  },
  {
    ko: "어딜 눌러야 돼요?",
    en: "where should i press?",
    length: 3,
  },
  {
    ko: "내일 만나서 이야기하는 거 어때요?",
    en: "How about meeting tomorrow and talking?",
    length: 5,
  },
  {
    ko: "학생일수록 책을 많이 읽어야 돼요.",
    en: "As a student, you should read more books.",
    length: 5,
  },
  {
    ko: "아까 운동장에서 친구들과 축구하더라고요.",
    en: "I was playing soccer with my friends at the playground earlier.",
    length: 4,
  },
  {
    ko: "얼굴이 피곤해 보여요.",
    en: "Your face looks tired.",
    length: 3,
  },
  {
    ko: "그 사람은 이미 학교를 졸업했어요.",
    en: "That person has already graduated from school.",
    length: 5,
  },
  {
    ko: "노래 동아리에 대해서 알고 싶어서 왔어요.",
    en: "I came because I wanted to know about the singing club.",
    length: 6,
  },
  {
    ko: "집에 오다가 친구를 만났어요.",
    en: "On my way home, I met a friend.",
    length: 4,
  },
  {
    ko: "한국어 공부가 재미있어졌어요.",
    en: "Studying Korean has become fun.",
    length: 3,
  },
  {
    ko: "무엇보다도 음식이 맛있어야 손님이 많이 와요.",
    en: "Above all, the food must be delicious so that many customers come.",
    length: 6,
  },
  {
    ko: "여길 어떻게 알았어요?",
    en: "How did you know where to go?",
    length: 3,
  },
  {
    ko: "비싸도 사고 싶어요.",
    en: "I want to buy it even if it is expensive.",
    length: 3,
  },
  {
    ko: "일요일에도 우리는 축구나 야구를 하려고 학교에 갔습니다.",
    en: "On Sunday we also went to school to play soccer or baseball.",
    length: 7,
  },
  {
    ko: "한 달 안에 방을 비워 주세요.",
    en: "Please vacate the room within one month.",
    length: 6,
  },
  {
    ko: "날씨 참 좋다.",
    en: "What a nice day.",
    length: 3,
  },
  {
    ko: "술을 마시지 마세요.",
    en: "Don't drink alcohol.",
    length: 3,
  },
  {
    ko: "그렇지만 영화 보고 싶어요.",
    en: "But I want to see a movie.",
    length: 4,
  },
  {
    ko: "저는 사람들에게 떠들지 말자고 했습니다.",
    en: "I told people not to talk.",
    length: 5,
  },
  {
    ko: "어제 왜 파티에 안 오셨어요?",
    en: "Why didn't you come to the party yesterday?",
    length: 5,
  },
  {
    ko: "어딘지 모른대요.",
    en: "You don't know where",
    length: 2,
  },
  {
    ko: "아까 커피숍에 간다고 했거든요.",
    en: "I said I was going to a coffee shop earlier.",
    length: 4,
  },
  {
    ko: "가고 있는 중이에요.",
    en: "I'm on my way.",
    length: 3,
  },
  {
    ko: "김 부장님, 서류를 언제까지 드릴까요?",
    en: "Manager Kim, when will you give me the documents?",
    length: 5,
  },
  {
    ko: "모두 열심히 노력해서 꿈을 이루시기 바랍니다.",
    en: "I hope you all work hard to make your dreams come true.",
    length: 6,
  },
  {
    ko: "친구들이 점심을 먹는 동안 나는 숙제를 했어요.",
    en: "While my friends were having lunch, I did my homework.",
    length: 7,
  },
  {
    ko: "제가 이해하기 쉽도록 설명했어요.",
    en: "I explained it in a way that was easy for me to understand.",
    length: 4,
  },
  {
    ko: "늦지 말고 일찍 오세요.",
    en: "Don't be late, come early.",
    length: 4,
  },
  {
    ko: "언제부터 아프기 시작했습니까?",
    en: "When did you start getting sick?",
    length: 3,
  },
  {
    ko: "가수처럼 노래를 잘 불러요.",
    en: "Sing like a singer.",
    length: 4,
  },
  {
    ko: "저도 가야 되냐고 물어봐 주세요.",
    en: "Please ask if I can go too.",
    length: 5,
  },
];

const prisma = new PrismaClient();
// RUN THIS FILE WITH `ts-node` TO SEED THE DATABASE
// WITH THE GRAMMAR LIST.
async function main() {
  const users = await prisma.user.findMany();
  map(shuffle(GRAMMAR), async (pair) => {
    const { ko, en, length } = pair;
    if (ko.replace(/(\ |\.|,|\?|\!)/g, "").length > 12) {
      console.log(`Skipping ${ko} because it's too long (${length})`);
      return;
    }
    console.log(`${ko}: ${en}`);
    users.map(async (user) => {
      const hasWord = await prisma.phrase.findFirst({
        where: {
          ko,
          userId: user.id,
        },
      });
      if (!hasWord) {
        await prisma.phrase.create({
          data: {
            ko,
            en,
            next_quiz_type: "dictation",
            userId: user.id,
          },
        });
      }
    });
    console.log(`Added ${ko}`);
  });
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })

  .catch(async (e) => {
    console.error(e ?? "???????");

    await prisma.$disconnect();

    process.exit(1);
  });
