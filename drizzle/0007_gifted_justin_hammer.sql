CREATE TABLE `cashCountEntries` (
	`id` int AUTO_INCREMENT NOT NULL,
	`cashSessionId` int NOT NULL,
	`denomination` decimal(14,2) NOT NULL,
	`quantity` int NOT NULL,
	`countedAmount` decimal(14,2) NOT NULL,
	`countedById` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `cashCountEntries_id` PRIMARY KEY(`id`),
	CONSTRAINT `cash_count_session_denomination_unique` UNIQUE(`cashSessionId`,`denomination`)
);
--> statement-breakpoint
CREATE TABLE `cashSafeDrops` (
	`id` int AUTO_INCREMENT NOT NULL,
	`cashSessionId` int NOT NULL,
	`locationId` int NOT NULL,
	`amount` decimal(14,2) NOT NULL,
	`reason` text NOT NULL,
	`status` enum('pending','approved','rejected') NOT NULL DEFAULT 'pending',
	`createdById` int NOT NULL,
	`approvedById` int,
	`approvedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `cashSafeDrops_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `returnPayments` (
	`id` int AUTO_INCREMENT NOT NULL,
	`returnId` int NOT NULL,
	`originalPaymentId` int,
	`method` enum('cash','gcash','maya','qrph','debit_card','credit_card','bank_transfer') NOT NULL,
	`provider` varchar(64) NOT NULL DEFAULT 'mock',
	`status` enum('refunded') NOT NULL DEFAULT 'refunded',
	`amount` decimal(14,2) NOT NULL,
	`reference` varchar(120),
	`processedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `returnPayments_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `saleReturnItems` (
	`id` int AUTO_INCREMENT NOT NULL,
	`returnId` int NOT NULL,
	`saleItemId` int NOT NULL,
	`productId` int NOT NULL,
	`quantity` decimal(14,3) NOT NULL,
	`refundAmount` decimal(14,2) NOT NULL,
	CONSTRAINT `saleReturnItems_id` PRIMARY KEY(`id`),
	CONSTRAINT `sale_return_item_unique` UNIQUE(`returnId`,`saleItemId`)
);
--> statement-breakpoint
CREATE TABLE `saleReturns` (
	`id` int AUTO_INCREMENT NOT NULL,
	`returnNumber` varchar(48) NOT NULL,
	`saleId` int NOT NULL,
	`locationId` int NOT NULL,
	`cashSessionId` int,
	`status` enum('completed') NOT NULL DEFAULT 'completed',
	`reasonCode` enum('customer_change_mind','damaged','wrong_item','pricing_error','other') NOT NULL,
	`reasonNote` text,
	`refundAmount` decimal(14,2) NOT NULL,
	`refundMethod` enum('cash','gcash','maya','qrph','debit_card','credit_card','bank_transfer') NOT NULL,
	`processedById` int NOT NULL,
	`approvedById` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `saleReturns_id` PRIMARY KEY(`id`),
	CONSTRAINT `saleReturns_returnNumber_unique` UNIQUE(`returnNumber`)
);
--> statement-breakpoint
ALTER TABLE `stockMovements` MODIFY COLUMN `movementType` enum('receiving','sale','void','return','adjustment','transfer_shipment','transfer_receipt') NOT NULL;--> statement-breakpoint
ALTER TABLE `cashSessions` ADD `varianceReason` text;--> statement-breakpoint
ALTER TABLE `cashSessions` ADD `varianceApprovalStatus` enum('not_required','pending','approved') DEFAULT 'not_required' NOT NULL;--> statement-breakpoint
ALTER TABLE `cashSessions` ADD `varianceApprovedById` int;--> statement-breakpoint
ALTER TABLE `cashSessions` ADD `varianceApprovedAt` timestamp;--> statement-breakpoint
ALTER TABLE `cashCountEntries` ADD CONSTRAINT `cashCountEntries_cashSessionId_cashSessions_id_fk` FOREIGN KEY (`cashSessionId`) REFERENCES `cashSessions`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `cashCountEntries` ADD CONSTRAINT `cashCountEntries_countedById_users_id_fk` FOREIGN KEY (`countedById`) REFERENCES `users`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `cashSafeDrops` ADD CONSTRAINT `cashSafeDrops_cashSessionId_cashSessions_id_fk` FOREIGN KEY (`cashSessionId`) REFERENCES `cashSessions`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `cashSafeDrops` ADD CONSTRAINT `cashSafeDrops_locationId_locations_id_fk` FOREIGN KEY (`locationId`) REFERENCES `locations`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `cashSafeDrops` ADD CONSTRAINT `cashSafeDrops_createdById_users_id_fk` FOREIGN KEY (`createdById`) REFERENCES `users`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `cashSafeDrops` ADD CONSTRAINT `cashSafeDrops_approvedById_users_id_fk` FOREIGN KEY (`approvedById`) REFERENCES `users`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `returnPayments` ADD CONSTRAINT `returnPayments_returnId_saleReturns_id_fk` FOREIGN KEY (`returnId`) REFERENCES `saleReturns`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `returnPayments` ADD CONSTRAINT `returnPayments_originalPaymentId_payments_id_fk` FOREIGN KEY (`originalPaymentId`) REFERENCES `payments`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `saleReturnItems` ADD CONSTRAINT `saleReturnItems_returnId_saleReturns_id_fk` FOREIGN KEY (`returnId`) REFERENCES `saleReturns`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `saleReturnItems` ADD CONSTRAINT `saleReturnItems_saleItemId_saleItems_id_fk` FOREIGN KEY (`saleItemId`) REFERENCES `saleItems`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `saleReturnItems` ADD CONSTRAINT `saleReturnItems_productId_products_id_fk` FOREIGN KEY (`productId`) REFERENCES `products`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `saleReturns` ADD CONSTRAINT `saleReturns_saleId_sales_id_fk` FOREIGN KEY (`saleId`) REFERENCES `sales`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `saleReturns` ADD CONSTRAINT `saleReturns_locationId_locations_id_fk` FOREIGN KEY (`locationId`) REFERENCES `locations`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `saleReturns` ADD CONSTRAINT `saleReturns_cashSessionId_cashSessions_id_fk` FOREIGN KEY (`cashSessionId`) REFERENCES `cashSessions`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `saleReturns` ADD CONSTRAINT `saleReturns_processedById_users_id_fk` FOREIGN KEY (`processedById`) REFERENCES `users`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `saleReturns` ADD CONSTRAINT `saleReturns_approvedById_users_id_fk` FOREIGN KEY (`approvedById`) REFERENCES `users`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `cash_safe_drops_session_status_idx` ON `cashSafeDrops` (`cashSessionId`,`status`);--> statement-breakpoint
CREATE INDEX `return_payments_return_idx` ON `returnPayments` (`returnId`);--> statement-breakpoint
CREATE INDEX `sale_returns_sale_created_idx` ON `saleReturns` (`saleId`,`createdAt`);--> statement-breakpoint
CREATE INDEX `sale_returns_location_created_idx` ON `saleReturns` (`locationId`,`createdAt`);--> statement-breakpoint
ALTER TABLE `cashSessions` ADD CONSTRAINT `cashSessions_varianceApprovedById_users_id_fk` FOREIGN KEY (`varianceApprovedById`) REFERENCES `users`(`id`) ON DELETE restrict ON UPDATE no action;