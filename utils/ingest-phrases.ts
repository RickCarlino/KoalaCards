import { prismaClient } from "@/server/prisma-client";
import * as fs from "fs";
import { appendFileSync } from "fs";
import * as readline from "readline";

export async function ingestOne(ko: string, en: string, rootWord: string) {
  // Find phrase where `rootWord` or `ko` matches
  const phrase = await prismaClient.phrase.findFirst({
    where: {
      OR: [
        { term: ko },
        { root_word: rootWord },
      ],
    }
  });
  if (!phrase) {
    // console.log(`Ingesting ${ko} => ${en}`);
    appendFileSync("phrases.txt", [rootWord, ko, en].join("\t") + "\n", "utf8");
    // console.log({ko,en,rootWord});
    return await prismaClient.phrase.create({
      data: {
        term: ko,
        definition: en,
        root_word: rootWord,
      },
    });
  } else {
    console.log(`(already exists) ${ko} => ${en} `);
    return phrase;
  }
}

export function ingestPhrases() {
  const readInterface = readline.createInterface({
    input: fs.createReadStream("phrases.txt"),
    output: process.stdout,
  });

  let isFirstLine = true;

  readInterface.on("line", function (line) {
    if (isFirstLine) {
      isFirstLine = false;
      return;
    }

    let splitLine = line.split("\t");
    // We never stored the root word in phrases.txt,
    // so we'll just use the first word
    ingestOne(splitLine[0], splitLine[1], splitLine[0]);
  });
}
