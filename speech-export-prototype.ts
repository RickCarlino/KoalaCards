
import fs from "fs";
import readline from "readline";
import { ssml, pause, slow, en, ko, generateSpeechFile } from "./utils/fetch-lesson";
import { wordCount } from "./utils/random-new";

// Create a readline interface to read the file line-by-line
const readInterface = readline.createInterface({
  input: fs.createReadStream("phrases.txt"),
  output: process.stdout,
  terminal: false,
});

// Read the file line-by-line
readInterface.on("line", async (line) => {
  // Split the line by tab to get an array of columns
  const columns = line.split("\t");

  // Skip lines with insufficient columns
  if (columns.length < 3) {
    console.log("Skipping line with insufficient columns:", line);
    return;
  }

  // Get the values from the second and third columns
  const koTxt = columns[1];
  const enTxt = columns[2];
  const x = ssml(
    [ko(koTxt), pause(400), en(enTxt), pause(400), slow(koTxt), pause(4000)].join("\n"),
  );
  if (wordCount(koTxt) < 7) {
    console.log(await generateSpeechFile(x));
  }
});
