import {
  validateActivityCatalog,
  type ActivityCatalog,
} from "../shared/activities";
import { DatabaseSync } from "node:sqlite";
import {
  validateDay,
  validateDays,
  validatePeriod,
  type DraftDay,
} from "../shared/worklogs";

export class ConflictError extends Error {}

export function openDraftStore(filename: string) {
  const db = new DatabaseSync(filename);
  db.exec(`CREATE TABLE IF NOT EXISTS draft_days (
    date TEXT PRIMARY KEY, revision INTEGER NOT NULL, entries TEXT NOT NULL
  )`);

  db.exec(`CREATE TABLE IF NOT EXISTS activity_catalog (
    id INTEGER PRIMARY KEY CHECK (id = 1), revision INTEGER NOT NULL, activities TEXT NOT NULL
  )`);

  function readActivities(): ActivityCatalog {
    const row = db
      .prepare("SELECT revision, activities FROM activity_catalog WHERE id = 1")
      .get() as { revision: number; activities: string } | undefined;
    return row
      ? validateActivityCatalog({
          revision: row.revision,
          activities: JSON.parse(row.activities),
        })
      : { revision: 0, activities: [] };
  }
  function saveActivities(input: unknown): ActivityCatalog {
    const catalog = validateActivityCatalog(input);
    db.exec("BEGIN IMMEDIATE");
    try {
      if (readActivities().revision !== catalog.revision)
        throw new ConflictError(
          "O catálogo foi alterado em outra aba. Suas edições continuam aqui; copie-as e recarregue o catálogo antes de salvar.",
        );
      const saved = { ...catalog, revision: catalog.revision + 1 };
      db.prepare(
        `INSERT INTO activity_catalog (id, revision, activities) VALUES (1, ?, ?)
        ON CONFLICT(id) DO UPDATE SET revision = excluded.revision, activities = excluded.activities`,
      ).run(saved.revision, JSON.stringify(saved.activities));
      db.exec("COMMIT");
      return saved;
    } catch (error) {
      db.exec("ROLLBACK");
      throw error;
    }
  }

  type DayRow = { date: string; revision: number; entries: string };
  const decode = (row: DayRow): DraftDay =>
    validateDay({ ...row, entries: JSON.parse(row.entries) });

  function read(date: string): DraftDay {
    const row = db
      .prepare("SELECT date, revision, entries FROM draft_days WHERE date = ?")
      .get(date) as DayRow | undefined;
    return row ? decode(row) : validateDay({ date, revision: 0, entries: [] });
  }

  function readRange(from: string, to: string): DraftDay[] {
    validatePeriod(from, to);
    return (
      db
        .prepare(
          "SELECT date, revision, entries FROM draft_days WHERE date BETWEEN ? AND ? ORDER BY date",
        )
        .all(from, to) as DayRow[]
    ).map(decode);
  }

  function saveMany(input: unknown): DraftDay[] {
    const days = validateDays(input);
    db.exec("BEGIN IMMEDIATE");
    try {
      for (const day of days) {
        if (read(day.date).revision !== day.revision) {
          throw new ConflictError(
            `O dia ${day.date.split("-").reverse().join("/")} foi alterado em outra aba. Nenhum dia desta operação foi salvo. Suas edições continuam na tela; copie-as antes de recarregar.`,
          );
        }
      }
      const saved = days.map((day) => ({ ...day, revision: day.revision + 1 }));
      const write =
        db.prepare(`INSERT INTO draft_days (date, revision, entries) VALUES (?, ?, ?)
        ON CONFLICT(date) DO UPDATE SET revision = excluded.revision, entries = excluded.entries`);
      for (const day of saved)
        write.run(day.date, day.revision, JSON.stringify(day.entries));
      db.exec("COMMIT");
      return saved;
    } catch (error) {
      db.exec("ROLLBACK");
      throw error;
    }
  }

  function save(input: unknown): DraftDay {
    return saveMany([input])[0];
  }
  return {
    read,
    readRange,
    save,
    saveMany,
    readActivities,
    saveActivities,
    close: () => db.close(),
  };
}
