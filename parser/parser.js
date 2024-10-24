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
}

async function main() {
    const GEMINI_API = process.env.GEMINI_API_KEY;
    const prompt = `Introduce 3-4 natural mistakes into the following sentences for model training.
        Format:
        Provide the output as an array.
        Include a period at the end of each original sentence.
        Ensure that each altered sentence contains more than 3 mistakes.
        types of mistakes you must write (all):
        Verb tense errors
        Subject-verb agreement
        Phrasal verb errors
        Article misuse (A/An/The)
        Preposition errors
        Word order (syntax errors)
        Pluralization mistakes
        Double negatives
        Wrong word usage
        Punctuation errors
        Capitalization errors
        
        it is advisable to change the order of some words/phrases and put irregular endings for phrasal verbs
        Example format:
            "{Original sentence1}.";"{Altered sentence1 with mistakes.}";"{Original sentence2}.";"{Altered sentence2 with mistakes.}";...";


        Make sure this structure is followed for every! input sentence. write in plain text format. mandatory! make at least 3! errors! in each and every sentence!\n`;

    const bookFiles = fs
        .readdirSync("./books")
        .filter((file) => file.endsWith(".txt"));
    const lastState = await db.all(
        "SELECT last_processed_book, last_processed_sentence FROM last_state"
    );
    let lastProcessedBook = 0;
    let lastProcessedSentence = 0;
    if (lastState.length === 0) {
        await db.all(
            "INSERT INTO last_state (last_processed_sentence, last_processed_book) VALUES (?, ?)",
            [0, 0]
        );
        await db.all(
            "INSERT INTO books (name) VALUES (?)",
            bookFiles[0].split(".")[0]
        );
    } else {
        lastProcessedBook = lastState[lastState.length - 1].last_processed_book;
        lastProcessedSentence =
            lastState[lastState.length - 1].last_processed_sentence;
    }

    for (let bookId = lastProcessedBook; bookId < bookFiles.length; bookId++) {
        const bookName = bookFiles[bookId];
        if (bookId !== lastProcessedBook) {
            await db.all(
                "INSERT INTO books (name) VALUES (?)",
                bookName.split(".")[0]
            );
        }
        const bookPath = `./books/${bookName}`;

        const batchSize = 100;
        const sentences = parseTextFiles([bookPath], lastProcessedSentence);
        const totalSentences = sentences.length;
        for (let j = 0; j < totalSentences; j += batchSize) {
            const batch = sentences.slice(j, j + batchSize);
            const result = await make_errors(GEMINI_API, prompt, batch);
            await writeResultsToDatabase(
                result,
                bookId,
                lastProcessedSentence + j + batchSize
            );
            console.log(
                `Processed ${Math.min(
                    j + batchSize,
                    totalSentences
                )} out of ${totalSentences} sentences in ${bookName}`
            );
        }
        lastProcessedSentence = 0;
    }
}

main();
