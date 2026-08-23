CREATE TABLE `businessProfiles` (
	`id` int AUTO_INCREMENT NOT NULL,
	`legalName` varchar(240) NOT NULL,
	`tradeName` varchar(240),
	`tin` varchar(32) NOT NULL,
	`vatStatus` enum('vat','non_vat') NOT NULL,
	`registeredAddress` text NOT NULL,
	`invoiceLabel` varchar(80) NOT NULL DEFAULT 'Invoice',
	`isActive` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `businessProfiles_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `fiscalDocuments` (
	`id` int AUTO_INCREMENT NOT NULL,
	`invoiceSeriesId` int NOT NULL,
	`locationId` int NOT NULL,
	`saleId` int,
	`documentNumber` varchar(96) NOT NULL,
	`sequenceNumber` int NOT NULL,
	`status` enum('allocated','issued','voided') NOT NULL DEFAULT 'allocated',
	`metadata` json,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `fiscalDocuments_id` PRIMARY KEY(`id`),
	CONSTRAINT `fiscal_documents_series_number_unique` UNIQUE(`invoiceSeriesId`,`documentNumber`),
	CONSTRAINT `fiscal_documents_sale_unique` UNIQUE(`saleId`)
);
--> statement-breakpoint
CREATE TABLE `invoiceSeries` (
	`id` int AUTO_INCREMENT NOT NULL,
	`businessProfileId` int NOT NULL,
	`locationId` int NOT NULL,
	`code` varchar(32) NOT NULL,
	`prefix` varchar(32) NOT NULL,
	`nextSequence` int NOT NULL DEFAULT 1,
	`numberPadding` int NOT NULL DEFAULT 8,
	`isActive` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `invoiceSeries_id` PRIMARY KEY(`id`),
	CONSTRAINT `invoice_series_location_code_unique` UNIQUE(`locationId`,`code`)
);
--> statement-breakpoint
CREATE TABLE `receiptDevices` (
	`id` int AUTO_INCREMENT NOT NULL,
	`locationId` int NOT NULL,
	`invoiceSeriesId` int NOT NULL,
	`code` varchar(40) NOT NULL,
	`serialNumber` varchar(120),
	`permitNumber` varchar(120),
	`isActive` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `receiptDevices_id` PRIMARY KEY(`id`),
	CONSTRAINT `receipt_devices_location_code_unique` UNIQUE(`locationId`,`code`)
);
--> statement-breakpoint
CREATE TABLE `taxRegistrations` (
	`id` int AUTO_INCREMENT NOT NULL,
	`businessProfileId` int NOT NULL,
	`birRdoCode` varchar(16),
	`certificateNumber` varchar(80),
	`effectiveFrom` timestamp,
	`effectiveTo` timestamp,
	`status` enum('active','inactive') NOT NULL DEFAULT 'active',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `taxRegistrations_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `fiscalDocuments` ADD CONSTRAINT `fiscalDocuments_invoiceSeriesId_invoiceSeries_id_fk` FOREIGN KEY (`invoiceSeriesId`) REFERENCES `invoiceSeries`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `fiscalDocuments` ADD CONSTRAINT `fiscalDocuments_locationId_locations_id_fk` FOREIGN KEY (`locationId`) REFERENCES `locations`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `fiscalDocuments` ADD CONSTRAINT `fiscalDocuments_saleId_sales_id_fk` FOREIGN KEY (`saleId`) REFERENCES `sales`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `invoiceSeries` ADD CONSTRAINT `invoiceSeries_businessProfileId_businessProfiles_id_fk` FOREIGN KEY (`businessProfileId`) REFERENCES `businessProfiles`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `invoiceSeries` ADD CONSTRAINT `invoiceSeries_locationId_locations_id_fk` FOREIGN KEY (`locationId`) REFERENCES `locations`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `receiptDevices` ADD CONSTRAINT `receiptDevices_locationId_locations_id_fk` FOREIGN KEY (`locationId`) REFERENCES `locations`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `receiptDevices` ADD CONSTRAINT `receiptDevices_invoiceSeriesId_invoiceSeries_id_fk` FOREIGN KEY (`invoiceSeriesId`) REFERENCES `invoiceSeries`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `taxRegistrations` ADD CONSTRAINT `taxRegistrations_businessProfileId_businessProfiles_id_fk` FOREIGN KEY (`businessProfileId`) REFERENCES `businessProfiles`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `business_profiles_active_idx` ON `businessProfiles` (`isActive`);--> statement-breakpoint
CREATE INDEX `fiscal_documents_location_created_idx` ON `fiscalDocuments` (`locationId`,`createdAt`);--> statement-breakpoint
CREATE INDEX `invoice_series_location_active_idx` ON `invoiceSeries` (`locationId`,`isActive`);--> statement-breakpoint
CREATE INDEX `receipt_devices_series_active_idx` ON `receiptDevices` (`invoiceSeriesId`,`isActive`);--> statement-breakpoint
CREATE INDEX `tax_registrations_profile_status_idx` ON `taxRegistrations` (`businessProfileId`,`status`);