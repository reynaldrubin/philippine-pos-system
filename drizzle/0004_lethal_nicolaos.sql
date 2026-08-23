CREATE TABLE `authRateLimits` (
	`id` int AUTO_INCREMENT NOT NULL,
	`channel` enum('staff','member') NOT NULL,
	`keyHash` varchar(64) NOT NULL,
	`failures` int NOT NULL DEFAULT 0,
	`windowEndsAt` timestamp NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `authRateLimits_id` PRIMARY KEY(`id`),
	CONSTRAINT `auth_rate_limits_channel_key_unique` UNIQUE(`channel`,`keyHash`)
);
--> statement-breakpoint
CREATE INDEX `auth_rate_limits_window_idx` ON `authRateLimits` (`windowEndsAt`);