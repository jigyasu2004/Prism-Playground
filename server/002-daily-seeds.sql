CREATE TABLE IF NOT EXISTS daily_seeds (day TEXT NOT NULL, game TEXT NOT NULL, seed TEXT NOT NULL, PRIMARY KEY(day,game));
INSERT OR IGNORE INTO migrations VALUES(2,datetime('now'));
