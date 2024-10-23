import fs from "fs";
import { GoogleGenerativeAI, SchemaType } from "@google/generative-ai";
import db from "./data/database.js";
import dotenv from "dotenv";
dotenv.config();

function parseTextFiles(filePaths) {
    const sentances = [];
    for (let i = 0; i < filePaths.length; i++) {
        let data = fs.readFileSync(filePaths[i], "utf8");
        data = data.replace(/[\r\n;]+/g, " ");
        const sentences = data.split(". ");
        sentences.forEach((sentence) => {
            sentence = sentence.trim();

            if (
                sentence.length < 30 ||
                sentence.length > 150 ||
                sentence.includes("_")
            )
                return;
            sentances.push(sentence);
        });
    }
    return sentances;
}

async function make_errors(api, prompt, sentences) {
    const genAI = new GoogleGenerativeAI(api);
    const schema = {
        description: "sentences",
        type: SchemaType.ARRAY,
        items: {
            type: SchemaType.OBJECT,
            properties: {
                inputSentance: {
                    type: SchemaType.STRING,
                    description: "input sentances from prompt",
                    nullable: false,
                },
                sentancesWithErrors: {
                    type: SchemaType.STRING,
                    description: "sentances with errors",
                    nullable: false,
                },
            },
            required: ["inputSentance", "sentancesWithErrors"],
        },
    };
    const model = genAI.getGenerativeModel({
        model: "gemini-1.5-flash-002",
        generationConfig: {
            responseMimeType: "application/json",
            responseSchema: schema,
        },
    });

    const result = [];
    const batchSize = 100;
    const totalSentences = 121; //sentances.length()
    for (let i = 0; i < totalSentences; i += batchSize) {
        const batch = sentences.slice(i, i + batchSize);
        const response = await model.generateContent(prompt + batch);

        const data = JSON.parse(response.response.text());

        result.push(...data);
        console.log(
            `Processed ${Math.min(
                i + batchSize,
                totalSentences
            )} out of ${totalSentences} sentences`
        );
    }
    return result;
}

function writeResultsToDatabase(data) {
    const insertStmt = db.prepare(
        `INSERT INTO sentences (original, altered) VALUES (?, ?)`
    );

    data.forEach((item) => {
        insertStmt.run(item.inputSentance, item.sentancesWithErrors);
    });

    insertStmt.finalize();
    console.log("Data inserted into the database!");
}
async function main() {
    const GEMINI_API = process.env.GEMINI_API_KEY;
    console.log(GEMINI_API);
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


        
        Example format:
            "{Original sentence1}.";"{Altered sentence1 with mistakes.}";"{Original sentence2}.";"{Altered sentence2 with mistakes.}";...";


        Make sure this structure is followed for every! input sentence. write in plain text format. mandatory! make at least 3! errors! in each and every sentence!\n`;

    const books_pathes = ["./books/book1.txt"];

    const sentances = parseTextFiles(books_pathes);
    const result = await make_errors(GEMINI_API, prompt, sentances);
    writeResultsToDatabase(result);
}
main();
