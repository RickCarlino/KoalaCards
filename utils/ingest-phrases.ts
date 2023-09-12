import { prismaClient } from "@/server/prisma-client";
import * as fs from "fs";
import { appendFileSync } from "fs";
import * as readline from "readline";

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
    appendFileSync("phrases.tsv", [rootWord, ko, en].join("\t") + "\n", "utf8");
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

export function ingestPhrases() {
  const readInterface = readline.createInterface({
    input: fs.createReadStream("phrases.tsv"),
    output: process.stdout,
  });

  let isFirstLine = true;

  readInterface.on("line", function (line) {
    if (isFirstLine) {
      isFirstLine = false;
      return;
    }

    let splitLine = line.split("\t");
    // We never stored the root word in phrases.tsv,
    // so we'll just use the first word
    ingestOne(splitLine[0], splitLine[1], splitLine[2] || splitLine[0]);
  });
}
