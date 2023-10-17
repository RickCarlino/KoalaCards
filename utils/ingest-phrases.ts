import { prismaClient } from "@/server/prisma-client";

export async function ingestOne(
  ko: string,
  en: string,
  rootWord: string | undefined,
) {
  // Find phrase where `rootWord` or `ko` matches
  const phrase = await prismaClient.phrase.findFirst({
    where: {
      term: ko,
    },
  });
  if (!phrase) {
    return await prismaClient.phrase.create({
      data: {
        term: ko,
        definition: en,
        root_word: rootWord || "",
      },
    });
  } else {
    console.log(`(already exists) ${ko} => ${en} `);
    return phrase;
  }
}
