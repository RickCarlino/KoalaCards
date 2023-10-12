import { prismaClient } from "@/server/prisma-client";
import * as fs from "fs";
import { appendFileSync } from "fs";
import path from "path";
import * as readline from "readline";
const DATA_DIR = process.env.DATA_DIR || ".";
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

export function ingestPhrases() {
  const readInterface = readline.createInterface({
    input: fs.createReadStream(
      path.format({
        dir: path.join(DATA_DIR),
        name: "phrases",
        ext: ".tsv",
      }),
    ),
    output: process.stdout,
  });

  let isFirstLine = true;

  readInterface.on("line", function (line) {
    if (isFirstLine) {
      isFirstLine = false;
      return;
    }

    let splitLine = line.split("\t");
    ingestOne(splitLine[0], splitLine[1], splitLine[2] || splitLine[0]);
  });
}
