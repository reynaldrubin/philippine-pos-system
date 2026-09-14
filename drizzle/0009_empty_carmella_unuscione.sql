CREATE TABLE `cashMovements` (
	`id` int AUTO_INCREMENT NOT NULL,
	`locationId` int NOT NULL,
	`cashSessionId` int,
	`type` enum('cash_in','cash_out') NOT NULL,
	`category` varchar(100) NOT NULL,
	`amount` decimal(14,2) NOT NULL,
	`note` text NOT NULL,
	`createdById` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `cashMovements_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `staffAttendance` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`locationId` int NOT NULL,
	`eventType` enum('time_in','time_out') NOT NULL,
	`note` text,
	`recordedById` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `staffAttendance_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `cashMovements` ADD CONSTRAINT `cashMovements_locationId_locations_id_fk` FOREIGN KEY (`locationId`) REFERENCES `locations`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `cashMovements` ADD CONSTRAINT `cashMovements_cashSessionId_cashSessions_id_fk` FOREIGN KEY (`cashSessionId`) REFERENCES `cashSessions`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `cashMovements` ADD CONSTRAINT `cashMovements_createdById_users_id_fk` FOREIGN KEY (`createdById`) REFERENCES `users`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `staffAttendance` ADD CONSTRAINT `staffAttendance_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `staffAttendance` ADD CONSTRAINT `staffAttendance_locationId_locations_id_fk` FOREIGN KEY (`locationId`) REFERENCES `locations`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `staffAttendance` ADD CONSTRAINT `staffAttendance_recordedById_users_id_fk` FOREIGN KEY (`recordedById`) REFERENCES `users`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `cash_movements_location_created_idx` ON `cashMovements` (`locationId`,`createdAt`);--> statement-breakpoint
CREATE INDEX `staff_attendance_location_created_idx` ON `staffAttendance` (`locationId`,`createdAt`);--> statement-breakpoint
CREATE INDEX `staff_attendance_user_created_idx` ON `staffAttendance` (`userId`,`createdAt`);