import fs from "fs";
import { GoogleGenerativeAI, SchemaType } from "@google/generative-ai";
import db from "./data/database.js";
import dotenv from "dotenv";
dotenv.config();

function parseTextFiles(filePaths, lastProcessedSentence) {
    const sentences = [];
    for (let i = 0; i < filePaths.length; i++) {
        let data = fs.readFileSync(filePaths[i], "utf8");
        data = data.replace(/[\r\n;]+/g, " ");
        const allSentences = data.split(". ").filter((sentence) => {
            return (
                sentence.length > 30 &&
                sentence.length < 150 &&
                !sentence.includes("_")
            );
        });
        for (let j = lastProcessedSentence; j < allSentences.length; j++) {
            let sentence = allSentences[j].trim();
            sentences.push(sentence);
        }
    }
    return sentences;
}

async function make_errors(api, prompt, batch) {
    const genAI = new GoogleGenerativeAI(api);
    const schema = {
        description: "sentences",
        type: SchemaType.ARRAY,
        items: {
            type: SchemaType.OBJECT,
            properties: {
                original: {
                    type: SchemaType.STRING,
                    description: "input sentences from prompt",
                    nullable: false,
                },
                altered: {
                    type: SchemaType.STRING,
                    description: "sentences with errors",
                    nullable: false,
                },
            },
            required: ["original", "altered"],
        },
    };
    const model = genAI.getGenerativeModel({
        model: "gemini-1.5-flash-002",
        generationConfig: {
            responseMimeType: "application/json",
            responseSchema: schema,
        },
    });

    const response = await model.generateContent(prompt + batch);
    const data = JSON.parse(response.response.text());
    return data;
}

async function writeResultsToDatabase(data, bookId, lastProcessedSentence) {
    console.log(`${data.length} - Numbers of sentences to db`)
    try {
        for (let i = 0; i < data.length; i++) {
            await db.all(
                "INSERT INTO sentences (original, altered, book_id) VALUES (?, ?, ?)",
                [data[i].original, data[i].altered, bookId]
            );
        }
        await db.all(
            `UPDATE last_state SET last_processed_sentence = ?, last_processed_book = ?`,
            [lastProcessedSentence, bookId]
        );
        console.log("Data inserted into the database!");
    } catch (error) {
        console.error(`${new Date()} Error writing to database`);
    }
}
////The total number of sentences in the database
// async function getDatabaseLength() {
//     try {
//         const count = await db.get("SELECT COUNT(*) as count FROM sentences");
//         console.log(`Total sentences in database: ${count.count}`);
//     } catch (error) {
//         console.error(`${new Date()} Error reading database length`);
//     }
// }

async function main() {
    const GEMINI_API = process.env.GEMINI_API_KEY;
    const prompts = [
        "Make the following request with the all 20 sentences.  Make 3-4 natural mistakes into the following 20 sentences for model training. .",
        "Make the following request with the all 20 sentences.  Make 3-4 spelling mistakes into the following 20 sentences for model training. .",
        "Make the following request with the all 20 sentences.  Make 3-4 grammatical mistakes into the following 20 sentences for model training. .",
        "Make the following request with the all 20 sentences.  Make 2-3 spelling mistakes into the following 20 sentences for model training. .",
        "Make the following request with the all 20 sentences.  Make 2-3 grammatical mistakes into the following 20 sentences for model training. .",
        "Make the following request with the all 20 sentences.  Make 5-6 grammatical mistakes into the following 20 sentences for model training. .",
        "Make the following request with the all 20 sentences.  Make 4-5 natural mistakes into the following 20 sentences for model training. .",
        "Make the following request with the all 20 sentences.  Make 4-5 spelling mistakes into the following 20 sentences for model training. .",
        "Make the following request with the all 20 sentences.  Make 4-5 grammatical mistakes into the following 20 sentences for model training. ."
      ];
    const bookFiles = fs
        .readdirSync("./books")
        .filter((file) => file.endsWith(".txt"))
        .map((file) => ({
            name: file,
            time: fs.statSync(`./books/${file}`).mtime.getTime(),
        }))
        .sort((a, b) => a.time - b.time)
        .map((file) => file.name);
    let lastState;
    try {
        lastState = await db.all(
            "SELECT last_processed_book, last_processed_sentence FROM last_state"
        );
    } catch (error) {
        console.error(`${new Date()} Error reading last state from database`);
        return;
    }
    let lastProcessedBook = 0;
    let lastProcessedSentence = 0;
    if (lastState.length === 0) {
        try {
            await db.all(
                "INSERT INTO last_state (last_processed_sentence, last_processed_book) VALUES (?, ?)",
                [0, 0]
            );
            await db.all(
                "INSERT INTO books (name) VALUES (?)",
                bookFiles[0].split(".")[0]
            );
        } catch (error) {
            console.error(`$${new Date()} Error initializing database state`);
            return;
        }
    } else {
        lastProcessedBook = lastState[lastState.length - 1].last_processed_book;
        lastProcessedSentence =
            lastState[lastState.length - 1].last_processed_sentence;
    }

    for (let bookId = lastProcessedBook; bookId < bookFiles.length; bookId++) {
        const bookName = bookFiles[bookId];
        if (bookId !== lastProcessedBook) {
            try {
                await db.all(
                    "INSERT INTO books (name) VALUES (?)",
                    bookName.split(".")[0]
                );
            } catch (error) {
                console.error(
                    `${new Date()} Error inserting book into database`
                );
                continue;
            }
        }
        const bookPath = `./books/${bookName}`;

        const batchSize = 20; //number of sentences in prompt
        const sentences = parseTextFiles([bookPath], lastProcessedSentence);
        const totalSentences = sentences.length;
        for (let j = 0; j < totalSentences; j += batchSize) {
            const batch = sentences.slice(j, j + batchSize);

            const randomPrompt = prompts[Math.floor(Math.random() * prompts.length)];

            let result;
            try {
                result = await make_errors(GEMINI_API, randomPrompt, batch); /////////
                
            } catch (error) {
                console.error(
                    `${new Date()} Error generating errors with Google AI`
                );
                await new Promise((resolve) => setTimeout(resolve, 30000));
                continue;
            }
            await writeResultsToDatabase(
                result,
                bookId,
                lastProcessedSentence + j + batchSize
            );
            console.log(
                `Processed ${Math.min(
                    j + batchSize,
                    totalSentences
                )} out of ${totalSentences} sentences in Book ${bookId + 1} of ${bookFiles.length}: ${bookName}`
            );
        }
        lastProcessedSentence = 0;
    }
}

main();
