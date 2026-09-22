CREATE TABLE `employeeCertificates` (
	`id` int AUTO_INCREMENT NOT NULL,
	`employeeId` int NOT NULL,
	`certificateType` varchar(120) NOT NULL,
	`certificateNumber` varchar(120),
	`issuedDate` timestamp,
	`expiryDate` timestamp,
	`issuer` varchar(160),
	`status` enum('valid','expiring','expired','pending') NOT NULL DEFAULT 'valid',
	`notes` text,
	`createdById` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `employeeCertificates_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `employeeCompensation` (
	`id` int AUTO_INCREMENT NOT NULL,
	`employeeId` int NOT NULL,
	`effectiveDate` timestamp NOT NULL,
	`salaryType` enum('monthly','daily','hourly') NOT NULL,
	`baseSalary` decimal(14,2) NOT NULL,
	`allowances` json,
	`payFrequency` enum('monthly','semi_monthly','weekly') NOT NULL DEFAULT 'semi_monthly',
	`notes` text,
	`createdById` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `employeeCompensation_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `employeeLeaveRequests` (
	`id` int AUTO_INCREMENT NOT NULL,
	`employeeId` int NOT NULL,
	`leaveType` enum('vacation','sick','emergency','service_incentive','other') NOT NULL,
	`startDate` timestamp NOT NULL,
	`endDate` timestamp NOT NULL,
	`reason` text,
	`status` enum('pending','approved','rejected','cancelled') NOT NULL DEFAULT 'pending',
	`reviewedById` int,
	`reviewedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `employeeLeaveRequests_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `employeeProfiles` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int,
	`employeeNumber` varchar(40) NOT NULL,
	`firstName` varchar(80) NOT NULL,
	`middleName` varchar(80),
	`lastName` varchar(80) NOT NULL,
	`birthDate` timestamp,
	`sex` enum('female','male','prefer_not_to_say'),
	`civilStatus` enum('single','married','widowed','separated'),
	`mobile` varchar(40),
	`personalEmail` varchar(240),
	`address` text,
	`hireDate` timestamp,
	`employmentStatus` enum('active','probationary','on_leave','inactive','separated') NOT NULL DEFAULT 'active',
	`department` varchar(120),
	`position` varchar(120),
	`managerId` int,
	`tin` varchar(40),
	`sssNumber` varchar(40),
	`philhealthNumber` varchar(40),
	`pagibigNumber` varchar(40),
	`emergencyContactName` varchar(160),
	`emergencyContactPhone` varchar(40),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `employeeProfiles_id` PRIMARY KEY(`id`),
	CONSTRAINT `employeeProfiles_employeeNumber_unique` UNIQUE(`employeeNumber`)
);
--> statement-breakpoint
CREATE TABLE `philippineHolidays` (
	`id` int AUTO_INCREMENT NOT NULL,
	`holidayDate` timestamp NOT NULL,
	`name` varchar(160) NOT NULL,
	`holidayType` enum('regular','special_non_working','special_working') NOT NULL,
	`year` int NOT NULL,
	`notes` text,
	`createdById` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `philippineHolidays_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `staffMenuAssignments` MODIFY COLUMN `menuKey` enum('overview','register','inventory','transfers','members','operations','reports','users','compliance','hris') NOT NULL;--> statement-breakpoint
ALTER TABLE `employeeCertificates` ADD CONSTRAINT `employeeCertificates_employeeId_employeeProfiles_id_fk` FOREIGN KEY (`employeeId`) REFERENCES `employeeProfiles`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `employeeCertificates` ADD CONSTRAINT `employeeCertificates_createdById_users_id_fk` FOREIGN KEY (`createdById`) REFERENCES `users`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `employeeCompensation` ADD CONSTRAINT `employeeCompensation_employeeId_employeeProfiles_id_fk` FOREIGN KEY (`employeeId`) REFERENCES `employeeProfiles`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `employeeCompensation` ADD CONSTRAINT `employeeCompensation_createdById_users_id_fk` FOREIGN KEY (`createdById`) REFERENCES `users`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `employeeLeaveRequests` ADD CONSTRAINT `employeeLeaveRequests_employeeId_employeeProfiles_id_fk` FOREIGN KEY (`employeeId`) REFERENCES `employeeProfiles`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `employeeLeaveRequests` ADD CONSTRAINT `employeeLeaveRequests_reviewedById_users_id_fk` FOREIGN KEY (`reviewedById`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `employeeProfiles` ADD CONSTRAINT `employeeProfiles_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `philippineHolidays` ADD CONSTRAINT `philippineHolidays_createdById_users_id_fk` FOREIGN KEY (`createdById`) REFERENCES `users`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `employee_certificates_employee_idx` ON `employeeCertificates` (`employeeId`,`expiryDate`);--> statement-breakpoint
CREATE INDEX `employee_compensation_employee_idx` ON `employeeCompensation` (`employeeId`,`effectiveDate`);--> statement-breakpoint
CREATE INDEX `employee_leave_employee_idx` ON `employeeLeaveRequests` (`employeeId`,`startDate`);--> statement-breakpoint
CREATE INDEX `employee_profiles_status_idx` ON `employeeProfiles` (`employmentStatus`);--> statement-breakpoint
CREATE INDEX `employee_profiles_user_idx` ON `employeeProfiles` (`userId`);--> statement-breakpoint
CREATE INDEX `philippine_holidays_year_idx` ON `philippineHolidays` (`year`,`holidayDate`);