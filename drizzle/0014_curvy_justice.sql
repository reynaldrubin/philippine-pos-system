CREATE TABLE `payrollItems` (
	`id` int AUTO_INCREMENT NOT NULL,
	`payrollRunId` int NOT NULL,
	`employeeId` int,
	`userId` int NOT NULL,
	`daysWorked` decimal(8,2) NOT NULL DEFAULT '0',
	`hoursWorked` decimal(8,2) NOT NULL DEFAULT '0',
	`lateMinutes` int NOT NULL DEFAULT 0,
	`undertimeMinutes` int NOT NULL DEFAULT 0,
	`overtimeMinutes` int NOT NULL DEFAULT 0,
	`basePay` decimal(14,2) NOT NULL DEFAULT '0',
	`overtimePay` decimal(14,2) NOT NULL DEFAULT '0',
	`allowances` decimal(14,2) NOT NULL DEFAULT '0',
	`deductions` decimal(14,2) NOT NULL DEFAULT '0',
	`netPay` decimal(14,2) NOT NULL DEFAULT '0',
	`notes` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `payrollItems_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `payrollRuns` (
	`id` int AUTO_INCREMENT NOT NULL,
	`periodStart` timestamp NOT NULL,
	`periodEnd` timestamp NOT NULL,
	`status` enum('computed','approved','paid') NOT NULL DEFAULT 'computed',
	`totalGross` decimal(14,2) NOT NULL DEFAULT '0',
	`totalDeductions` decimal(14,2) NOT NULL DEFAULT '0',
	`totalNet` decimal(14,2) NOT NULL DEFAULT '0',
	`computedById` int NOT NULL,
	`approvedById` int,
	`approvedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `payrollRuns_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `payrollItems` ADD CONSTRAINT `pay_item_run_fk` FOREIGN KEY (`payrollRunId`) REFERENCES `payrollRuns`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `payrollItems` ADD CONSTRAINT `pay_item_emp_fk` FOREIGN KEY (`employeeId`) REFERENCES `employeeProfiles`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `payrollItems` ADD CONSTRAINT `pay_item_user_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `payrollRuns` ADD CONSTRAINT `pay_run_computed_fk` FOREIGN KEY (`computedById`) REFERENCES `users`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `payrollRuns` ADD CONSTRAINT `pay_run_approved_fk` FOREIGN KEY (`approvedById`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `payroll_items_run_idx` ON `payrollItems` (`payrollRunId`);--> statement-breakpoint
CREATE INDEX `payroll_items_user_idx` ON `payrollItems` (`userId`);--> statement-breakpoint
CREATE INDEX `payroll_runs_period_idx` ON `payrollRuns` (`periodStart`,`periodEnd`);--> statement-breakpoint
CREATE INDEX `payroll_runs_status_idx` ON `payrollRuns` (`status`);
