import { PrismaClient } from "@prisma/client";
import { map, shuffle } from "radash";
import { GRAMMAR } from "./seeds";

const prisma = new PrismaClient();
// RUN THIS FILE WITH `ts-node` TO SEED THE DATABASE
// WITH THE GRAMMAR LIST.
async function main() {
  map(shuffle(GRAMMAR), async (pair) => {
    const {ko, en, length} = pair;
    if (length > 5) {
      return;
    }
    console.log(`${ko}: ${en}`)
    const hasWord = await prisma.phrase.findUnique({where: {ko}});
    if (!hasWord) {
      const data = {
        ko,
        en,
        next_quiz_type: "dictation",
      };
      const x = await prisma.phrase.create({ data });
      console.log(`OK`);
    } else {
      console.log(`Already have ${ko} in DB`);
    }
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