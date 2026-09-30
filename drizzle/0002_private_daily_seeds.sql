CREATE TABLE `daily_seeds` (
	`day` text NOT NULL,
	`game` text NOT NULL,
	`seed` text NOT NULL,
	PRIMARY KEY(`day`, `game`)
);
