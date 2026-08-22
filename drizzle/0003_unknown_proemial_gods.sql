CREATE TABLE `staffMenuAssignments` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`menuKey` enum('overview','register','inventory','transfers','members','operations','reports','users') NOT NULL,
	`isEnabled` boolean NOT NULL DEFAULT true,
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `staffMenuAssignments_id` PRIMARY KEY(`id`),
	CONSTRAINT `staff_menu_assignment_unique` UNIQUE(`userId`,`menuKey`)
);
--> statement-breakpoint
ALTER TABLE `users` ADD `jobTitle` varchar(100);--> statement-breakpoint
ALTER TABLE `staffMenuAssignments` ADD CONSTRAINT `staffMenuAssignments_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;