CREATE TABLE IF NOT EXISTS migrations (version INTEGER PRIMARY KEY, applied_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS profiles (user_id TEXT PRIMARY KEY, xp INTEGER NOT NULL DEFAULT 0 CHECK(xp>=0), crystals INTEGER NOT NULL DEFAULT 0 CHECK(crystals>=0), equipped TEXT NOT NULL DEFAULT '{}', created_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS sessions (id TEXT PRIMARY KEY, user_id TEXT NOT NULL, expires INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS runs (id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES profiles(user_id), game TEXT NOT NULL, version TEXT NOT NULL, difficulty TEXT NOT NULL, mode TEXT NOT NULL, seed TEXT NOT NULL, started_at INTEGER NOT NULL, ended_at INTEGER, elapsed INTEGER NOT NULL DEFAULT 0, active_since INTEGER, state TEXT NOT NULL, status TEXT NOT NULL, assisted INTEGER NOT NULL DEFAULT 0, practice INTEGER NOT NULL DEFAULT 0, revision INTEGER NOT NULL DEFAULT 0, daily TEXT, summary TEXT, reward TEXT);
CREATE INDEX IF NOT EXISTS runs_user_date ON runs(user_id, started_at DESC);
CREATE TABLE IF NOT EXISTS actions (run_id TEXT NOT NULL REFERENCES runs(id), action_id TEXT NOT NULL, revision INTEGER NOT NULL, timestamp INTEGER NOT NULL, action TEXT NOT NULL, PRIMARY KEY(run_id,action_id));
CREATE TABLE IF NOT EXISTS reward_transactions (run_id TEXT PRIMARY KEY REFERENCES runs(id), user_id TEXT NOT NULL, xp INTEGER NOT NULL, crystals INTEGER NOT NULL, breakdown TEXT NOT NULL, created_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS inventory (user_id TEXT NOT NULL, item_id TEXT NOT NULL, purchased_at TEXT NOT NULL, cost INTEGER NOT NULL DEFAULT 0, PRIMARY KEY(user_id,item_id));
CREATE TABLE IF NOT EXISTS achievements (user_id TEXT NOT NULL, achievement TEXT NOT NULL, awarded_at TEXT NOT NULL, run_id TEXT NOT NULL, PRIMARY KEY(user_id,achievement));
CREATE TABLE IF NOT EXISTS challenges (user_id TEXT NOT NULL, day TEXT NOT NULL, challenge TEXT NOT NULL, run_id TEXT NOT NULL, PRIMARY KEY(user_id,day,challenge));
INSERT OR IGNORE INTO migrations VALUES(1,datetime('now'));
CREATE UNIQUE INDEX IF NOT EXISTS actions_one_revision ON actions(run_id,revision);
CREATE INDEX IF NOT EXISTS actions_timestamp ON actions(timestamp);
CREATE TRIGGER IF NOT EXISTS inventory_charge AFTER INSERT ON inventory BEGIN
 UPDATE profiles SET crystals=crystals-NEW.cost WHERE user_id=NEW.user_id;
END;
CREATE TRIGGER IF NOT EXISTS reward_credit AFTER INSERT ON reward_transactions BEGIN
 UPDATE profiles SET xp=xp+NEW.xp,crystals=crystals+NEW.crystals WHERE user_id=NEW.user_id;
END;
CREATE TRIGGER IF NOT EXISTS reward_adjust AFTER UPDATE ON reward_transactions BEGIN
 UPDATE profiles SET xp=xp+NEW.xp-OLD.xp,crystals=crystals+NEW.crystals-OLD.crystals WHERE user_id=NEW.user_id;
 UPDATE runs SET reward=NEW.breakdown WHERE id=NEW.run_id;
END;
CREATE TRIGGER IF NOT EXISTS challenge_credit AFTER INSERT ON challenges BEGIN
 UPDATE reward_transactions SET xp=xp+CASE WHEN NEW.challenge='daily' THEN 25 ELSE 15 END,
 crystals=crystals+CASE WHEN NEW.challenge='daily' THEN 5 ELSE 3 END,
 breakdown=json_set(breakdown,'$.xp',xp+CASE WHEN NEW.challenge='daily' THEN 25 ELSE 15 END,'$.crystals',crystals+CASE WHEN NEW.challenge='daily' THEN 5 ELSE 3 END,
 '$.daily',COALESCE(json_extract(breakdown,'$.daily'),0)+CASE WHEN NEW.challenge='daily' THEN 25 ELSE 0 END,
 '$.mission',COALESCE(json_extract(breakdown,'$.mission'),0)+CASE WHEN NEW.challenge!='daily' THEN 15 ELSE 0 END)
 WHERE run_id=NEW.run_id;
END;
CREATE TRIGGER IF NOT EXISTS run_finalized AFTER UPDATE OF status ON runs
WHEN OLD.status='playing' AND NEW.status IN ('completed','failed','abandoned') BEGIN
 INSERT OR IGNORE INTO reward_transactions(run_id,user_id,xp,crystals,breakdown,created_at)
 VALUES(NEW.id,NEW.user_id,COALESCE(json_extract(NEW.reward,'$.xp'),0),COALESCE(json_extract(NEW.reward,'$.crystals'),0),COALESCE(NEW.reward,'{"xp":0,"crystals":0}'),datetime('now'));
 INSERT OR IGNORE INTO challenges SELECT NEW.user_id,NEW.daily,'daily',NEW.id WHERE NEW.status='completed' AND NEW.practice=0 AND NEW.assisted=0 AND NEW.daily=date(NEW.started_at/1000,'unixepoch');
 INSERT OR IGNORE INTO challenges SELECT NEW.user_id,date(NEW.started_at/1000,'unixepoch'),'two-games',NEW.id WHERE NEW.status='completed' AND NEW.practice=0 AND NEW.assisted=0 AND
 (SELECT COUNT(DISTINCT game) FROM runs WHERE user_id=NEW.user_id AND status='completed' AND practice=0 AND assisted=0 AND date(started_at/1000,'unixepoch')=date(NEW.started_at/1000,'unixepoch'))>=2;
 INSERT OR IGNORE INTO challenges SELECT NEW.user_id,date(NEW.started_at/1000,'unixepoch'),'clear-puzzle',NEW.id WHERE NEW.status='completed' AND NEW.practice=0 AND NEW.assisted=0 AND json_extract(NEW.summary,'$.puzzle')=1;
 INSERT OR IGNORE INTO achievements SELECT NEW.user_id,'first-completion',datetime('now'),NEW.id WHERE NEW.status='completed' AND NEW.practice=0 AND NEW.assisted=0;
 INSERT OR IGNORE INTO achievements SELECT NEW.user_id,'all-sixteen',datetime('now'),NEW.id WHERE NEW.status='completed' AND NEW.practice=0 AND NEW.assisted=0 AND (SELECT COUNT(DISTINCT game) FROM runs WHERE user_id=NEW.user_id AND status='completed')=16;
 INSERT OR IGNORE INTO achievements SELECT NEW.user_id,'perfect-memory',datetime('now'),NEW.id WHERE NEW.status='completed' AND NEW.practice=0 AND NEW.assisted=0 AND NEW.game IN ('orbit','recall') AND json_extract(NEW.summary,'$.accuracy')=1;
 INSERT OR IGNORE INTO achievements SELECT NEW.user_id,'efficient-puzzle',datetime('now'),NEW.id WHERE NEW.status='completed' AND NEW.practice=0 AND NEW.assisted=0 AND json_extract(NEW.summary,'$.puzzle')=1 AND json_extract(NEW.summary,'$.efficient')=1;
 INSERT OR IGNORE INTO achievements SELECT NEW.user_id,'harmony-six',datetime('now'),NEW.id WHERE NEW.status='completed' AND NEW.practice=0 AND NEW.assisted=0 AND json_extract(NEW.summary,'$.chain')>=6;
END;

CREATE TABLE IF NOT EXISTS daily_seeds (day TEXT NOT NULL, game TEXT NOT NULL, seed TEXT NOT NULL, PRIMARY KEY(day,game));
