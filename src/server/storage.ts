import { DatabaseSync } from "node:sqlite";
import { validateDay, type DraftDay } from "../shared/worklogs";

export class ConflictError extends Error {}

export function openDraftStore(filename: string) {
  const db = new DatabaseSync(filename);
  db.exec(`CREATE TABLE IF NOT EXISTS draft_days (
    date TEXT PRIMARY KEY, revision INTEGER NOT NULL, entries TEXT NOT NULL
  )`);

  function read(date: string): DraftDay {
    const row = db
      .prepare("SELECT revision, entries FROM draft_days WHERE date = ?")
      .get(date) as { revision: number; entries: string } | undefined;
    return row
      ? validateDay({
          date,
          revision: row.revision,
          entries: JSON.parse(row.entries),
        })
      : validateDay({ date, revision: 0, entries: [] });
  }

  function save(input: unknown): DraftDay {
    const day = validateDay(input);
    db.exec("BEGIN IMMEDIATE");
    try {
      if (read(day.date).revision !== day.revision) {
        throw new ConflictError(
          "Este dia foi alterado em outra aba. Copie suas alterações antes de recarregar.",
        );
      }
      const saved = { ...day, revision: day.revision + 1 };
      db.prepare(
        `INSERT INTO draft_days (date, revision, entries) VALUES (?, ?, ?)
        ON CONFLICT(date) DO UPDATE SET revision = excluded.revision, entries = excluded.entries`,
      ).run(saved.date, saved.revision, JSON.stringify(saved.entries));
      db.exec("COMMIT");
      return saved;
    } catch (error) {
      db.exec("ROLLBACK");
      throw error;
    }
  }

  return { read, save, close: () => db.close() };
}
