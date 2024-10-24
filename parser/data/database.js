import { open } from "sqlite";
import sqlite3 from "sqlite3";
async function initializeDatabase() {
    const db = await open({
        filename: "./sentences.db",
        driver: sqlite3.Database,
    });

    console.log("Connected to the SQLite database.");

    await db.exec(`
        CREATE TABLE IF NOT EXISTS last_state (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            last_processed_book INTEGER,
            last_processed_sentence INTEGER
        )
    `);

    await db.exec(`
        CREATE TABLE IF NOT EXISTS books (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT
        )
    `);

    await db.exec(`
        CREATE TABLE IF NOT EXISTS sentences (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            original TEXT,
            altered TEXT,
            book_id INTEGER,
            FOREIGN KEY (book_id) REFERENCES books(id)
        )
    `);

    return db;
}

const db = await initializeDatabase();

export default db;
