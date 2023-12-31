import fs from "fs";

interface Item {
  // Unix timestamp for next review date
  nextReviewAt: number;
  term: string;
  definition: string;
  lapses: number;
  repetitions: number;
}
// Read backup.json synchronously:
const backup: Item[] = JSON.parse(fs.readFileSync("backup.json", "utf8"));

// Sort items by review date
const sorted = backup.sort((a, b) => a.nextReviewAt - b.nextReviewAt);

for (const item of sorted) {
  // Print term/definition if next review date is in the past:
  if (item.nextReviewAt < Date.now()) {
    const localTime = new Date(item.nextReviewAt).toLocaleString();
    console.log(
      `${localTime} ${item.lapses} ${item.repetitions} ${item.term}: ${item.definition}`,
    );
  }
}
