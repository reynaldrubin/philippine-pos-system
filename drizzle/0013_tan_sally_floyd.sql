CREATE TABLE `timekeepingScheduleRequests` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`requestedDate` timestamp NOT NULL,
	`scheduleId` int,
	`requestType` enum('schedule_change','time_correction','overtime') NOT NULL,
	`reason` text NOT NULL,
	`status` enum('pending','approved','rejected','cancelled') NOT NULL DEFAULT 'pending',
	`reviewedById` int,
	`reviewedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `timekeepingScheduleRequests_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `timekeepingSchedules` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(120) NOT NULL,
	`startTime` varchar(5) NOT NULL,
	`endTime` varchar(5) NOT NULL,
	`graceMinutes` int NOT NULL DEFAULT 15,
	`daysOfWeek` json NOT NULL,
	`isActive` boolean NOT NULL DEFAULT true,
	`createdById` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `timekeepingSchedules_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `staffMenuAssignments` MODIFY COLUMN `menuKey` enum('overview','register','inventory','transfers','members','operations','reports','users','compliance','hris','timekeeping') NOT NULL;--> statement-breakpoint
ALTER TABLE `timekeepingScheduleRequests` ADD CONSTRAINT `tk_req_user_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `timekeepingScheduleRequests` ADD CONSTRAINT `tk_req_sched_fk` FOREIGN KEY (`scheduleId`) REFERENCES `timekeepingSchedules`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `timekeepingScheduleRequests` ADD CONSTRAINT `tk_req_reviewer_fk` FOREIGN KEY (`reviewedById`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `timekeepingSchedules` ADD CONSTRAINT `tk_sched_creator_fk` FOREIGN KEY (`createdById`) REFERENCES `users`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `tk_req_user_date_idx` ON `timekeepingScheduleRequests` (`userId`,`requestedDate`);--> statement-breakpoint
CREATE INDEX `tk_req_status_idx` ON `timekeepingScheduleRequests` (`status`);--> statement-breakpoint
CREATE INDEX `tk_sched_active_idx` ON `timekeepingSchedules` (`isActive`);
