import sqlite3 from "sqlite3";
import path from "path";

const db = new sqlite3.Database("./sentences.db", (err) => {
    if (err) {
        console.error("Error connecting to database:", err.message);
    } else {
        console.log("Connected to the SQLite database.");

        db.run(
            `CREATE TABLE IF NOT EXISTS sentences (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    original TEXT,
                    altered TEXT
                )`,
            (err) => {
                if (err) {
                    console.error("Error creating table:", err.message);
                }
            }
        );
    }
});
export default db;
