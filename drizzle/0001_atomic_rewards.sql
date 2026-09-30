CREATE TRIGGER IF NOT EXISTS inventory_charge AFTER INSERT ON inventory BEGIN
 UPDATE profiles SET crystals=crystals-NEW.cost WHERE user_id=NEW.user_id;
END;
--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS reward_credit AFTER INSERT ON reward_transactions BEGIN
 UPDATE profiles SET xp=xp+NEW.xp,crystals=crystals+NEW.crystals WHERE user_id=NEW.user_id;
END;
--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS reward_adjust AFTER UPDATE ON reward_transactions BEGIN
 UPDATE profiles SET xp=xp+NEW.xp-OLD.xp,crystals=crystals+NEW.crystals-OLD.crystals WHERE user_id=NEW.user_id;
 UPDATE runs SET reward=NEW.breakdown WHERE id=NEW.run_id;
END;
--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS challenge_credit AFTER INSERT ON challenges BEGIN
 UPDATE reward_transactions SET xp=xp+CASE WHEN NEW.challenge='daily' THEN 25 ELSE 15 END,
 crystals=crystals+CASE WHEN NEW.challenge='daily' THEN 5 ELSE 3 END,
 breakdown=json_set(breakdown,'$.xp',xp+CASE WHEN NEW.challenge='daily' THEN 25 ELSE 15 END,'$.crystals',crystals+CASE WHEN NEW.challenge='daily' THEN 5 ELSE 3 END,
 '$.daily',COALESCE(json_extract(breakdown,'$.daily'),0)+CASE WHEN NEW.challenge='daily' THEN 25 ELSE 0 END,
 '$.mission',COALESCE(json_extract(breakdown,'$.mission'),0)+CASE WHEN NEW.challenge!='daily' THEN 15 ELSE 0 END)
 WHERE run_id=NEW.run_id;
END;
--> statement-breakpoint
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
--> statement-breakpoint
