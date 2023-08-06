import { prismaClient } from "@/server/prisma-client";
import * as fs from "fs";
import { appendFileSync } from "fs";
import * as readline from "readline";

export async function ingestOne(ko: string, en: string) {
  const phrase = await prismaClient.phrase.findFirst({ where: { term: ko } });
  if (!phrase) {
    console.log(`Ingesting ${ko} => ${en}`);
    appendFileSync("phrases.txt", [ko,en].join("\t") + "\n", "utf8");
    return await prismaClient.phrase.create({
      data: {
        term: ko,
        definition: en,
      },
    });
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

    let splitLine = line.split(",");
    ingestOne(splitLine[0], splitLine[1]);
  });
}
