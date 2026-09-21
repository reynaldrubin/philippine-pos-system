CREATE TABLE `reportTemplates` (
	`id` int AUTO_INCREMENT NOT NULL,
	`ownerId` int NOT NULL,
	`locationId` int,
	`name` varchar(120) NOT NULL,
	`metric` enum('revenue','transactions','products') NOT NULL,
	`groupBy` enum('products','locations') NOT NULL,
	`presentation` enum('bars','table') NOT NULL,
	`startDate` timestamp,
	`endDate` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `reportTemplates_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `reportTemplates` ADD CONSTRAINT `reportTemplates_ownerId_users_id_fk` FOREIGN KEY (`ownerId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `reportTemplates` ADD CONSTRAINT `reportTemplates_locationId_locations_id_fk` FOREIGN KEY (`locationId`) REFERENCES `locations`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `report_templates_owner_idx` ON `reportTemplates` (`ownerId`,`updatedAt`);--> statement-breakpoint
CREATE INDEX `report_templates_location_idx` ON `reportTemplates` (`locationId`);