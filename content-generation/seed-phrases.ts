import * as fs from 'fs';
import * as readline from 'readline';

function ingest(ko: string, en: string) {
    // ...
    console.log(`Korean: ${ko}, English: ${en}`);
}

export function ingestPhrases() {
    const readInterface = readline.createInterface({
        input: fs.createReadStream('phrases.txt'),
        output: process.stdout
    });

    let isFirstLine = true;

    readInterface.on('line', function(line) {
        if(isFirstLine) {
            isFirstLine = false;
            return;
        }

        let splitLine = line.split(',');
        ingest(splitLine[0], splitLine[1]);
    });

    readInterface.on('close', function() {
        console.log('CSV file successfully processed');
    });
}
