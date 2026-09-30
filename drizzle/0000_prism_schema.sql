CREATE TABLE `achievements` (
	`user_id` text NOT NULL,
	`achievement` text NOT NULL,
	`awarded_at` text NOT NULL,
	`run_id` text NOT NULL,
	PRIMARY KEY(`user_id`, `achievement`)
);
--> statement-breakpoint
CREATE TABLE `actions` (
	`run_id` text NOT NULL,
	`action_id` text NOT NULL,
	`revision` integer NOT NULL,
	`timestamp` integer NOT NULL,
	`action` text NOT NULL,
	PRIMARY KEY(`run_id`, `action_id`),
	FOREIGN KEY (`run_id`) REFERENCES `runs`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `actions_one_revision` ON `actions` (`run_id`,`revision`);--> statement-breakpoint
CREATE INDEX `actions_timestamp` ON `actions` (`timestamp`);--> statement-breakpoint
CREATE TABLE `challenges` (
	`user_id` text NOT NULL,
	`day` text NOT NULL,
	`challenge` text NOT NULL,
	`run_id` text NOT NULL,
	PRIMARY KEY(`user_id`, `day`, `challenge`)
);
--> statement-breakpoint
CREATE TABLE `inventory` (
	`user_id` text NOT NULL,
	`item_id` text NOT NULL,
	`purchased_at` text NOT NULL,
	`cost` integer DEFAULT 0 NOT NULL,
	PRIMARY KEY(`user_id`, `item_id`)
);
--> statement-breakpoint
CREATE TABLE `profiles` (
	`user_id` text PRIMARY KEY NOT NULL,
	`xp` integer DEFAULT 0 NOT NULL,
	`crystals` integer DEFAULT 0 NOT NULL,
	`equipped` text DEFAULT '{}' NOT NULL,
	`created_at` text NOT NULL,
	CONSTRAINT "xp_nonnegative" CHECK("profiles"."xp" >= 0),
	CONSTRAINT "crystals_nonnegative" CHECK("profiles"."crystals" >= 0)
);
--> statement-breakpoint
CREATE TABLE `reward_transactions` (
	`run_id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`xp` integer NOT NULL,
	`crystals` integer NOT NULL,
	`breakdown` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`run_id`) REFERENCES `runs`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `runs` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`game` text NOT NULL,
	`version` text NOT NULL,
	`difficulty` text NOT NULL,
	`mode` text NOT NULL,
	`seed` text NOT NULL,
	`started_at` integer NOT NULL,
	`ended_at` integer,
	`elapsed` integer DEFAULT 0 NOT NULL,
	`active_since` integer,
	`state` text NOT NULL,
	`status` text NOT NULL,
	`assisted` integer DEFAULT 0 NOT NULL,
	`practice` integer DEFAULT 0 NOT NULL,
	`revision` integer DEFAULT 0 NOT NULL,
	`daily` text,
	`summary` text,
	`reward` text,
	FOREIGN KEY (`user_id`) REFERENCES `profiles`(`user_id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `runs_user_date` ON `runs` (`user_id`,`started_at`);