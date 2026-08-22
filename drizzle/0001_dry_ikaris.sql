CREATE TABLE `auditLogs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int,
	`locationId` int,
	`action` varchar(120) NOT NULL,
	`entityType` varchar(80) NOT NULL,
	`entityId` varchar(80),
	`metadata` json,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `auditLogs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `cashSessions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`registerId` int NOT NULL,
	`openedById` int NOT NULL,
	`closedById` int,
	`status` enum('open','closed') NOT NULL DEFAULT 'open',
	`openingCash` decimal(14,2) NOT NULL,
	`expectedCash` decimal(14,2) NOT NULL DEFAULT '0',
	`closingCash` decimal(14,2),
	`variance` decimal(14,2),
	`openedAt` timestamp NOT NULL DEFAULT (now()),
	`closedAt` timestamp,
	CONSTRAINT `cashSessions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `categories` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(120) NOT NULL,
	`description` text,
	`isActive` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `categories_id` PRIMARY KEY(`id`),
	CONSTRAINT `categories_name_unique` UNIQUE(`name`)
);
--> statement-breakpoint
CREATE TABLE `locationInventory` (
	`id` int AUTO_INCREMENT NOT NULL,
	`locationId` int NOT NULL,
	`productId` int NOT NULL,
	`quantity` decimal(14,3) NOT NULL DEFAULT '0',
	`reservedQuantity` decimal(14,3) NOT NULL DEFAULT '0',
	`lowStockThreshold` decimal(14,3) NOT NULL DEFAULT '0',
	`reorderQuantity` decimal(14,3) NOT NULL DEFAULT '0',
	`priceOverride` decimal(14,2),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `locationInventory_id` PRIMARY KEY(`id`),
	CONSTRAINT `location_inventory_unique` UNIQUE(`locationId`,`productId`)
);
--> statement-breakpoint
CREATE TABLE `locations` (
	`id` int AUTO_INCREMENT NOT NULL,
	`code` varchar(32) NOT NULL,
	`name` varchar(160) NOT NULL,
	`type` enum('store','branch','warehouse','kiosk') NOT NULL DEFAULT 'store',
	`address` text,
	`city` varchar(120),
	`province` varchar(120),
	`postalCode` varchar(20),
	`phone` varchar(40),
	`isActive` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `locations_id` PRIMARY KEY(`id`),
	CONSTRAINT `locations_code_unique` UNIQUE(`code`)
);
--> statement-breakpoint
CREATE TABLE `loyaltyAccounts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`memberId` int NOT NULL,
	`currentPoints` int NOT NULL DEFAULT 0,
	`lifetimeEarned` int NOT NULL DEFAULT 0,
	`lifetimeRedeemed` int NOT NULL DEFAULT 0,
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `loyaltyAccounts_id` PRIMARY KEY(`id`),
	CONSTRAINT `loyaltyAccounts_memberId_unique` UNIQUE(`memberId`)
);
--> statement-breakpoint
CREATE TABLE `loyaltyCards` (
	`id` int AUTO_INCREMENT NOT NULL,
	`memberId` int NOT NULL,
	`cardNumber` varchar(48) NOT NULL,
	`displayToken` varchar(128) NOT NULL,
	`cardType` enum('digital') NOT NULL DEFAULT 'digital',
	`status` enum('active','revoked','expired') NOT NULL DEFAULT 'active',
	`issuedAt` timestamp NOT NULL DEFAULT (now()),
	`expiresAt` timestamp,
	CONSTRAINT `loyaltyCards_id` PRIMARY KEY(`id`),
	CONSTRAINT `loyaltyCards_cardNumber_unique` UNIQUE(`cardNumber`),
	CONSTRAINT `loyaltyCards_displayToken_unique` UNIQUE(`displayToken`)
);
--> statement-breakpoint
CREATE TABLE `loyaltyMembers` (
	`id` int AUTO_INCREMENT NOT NULL,
	`memberNumber` varchar(48) NOT NULL,
	`firstName` varchar(100) NOT NULL,
	`lastName` varchar(100) NOT NULL,
	`mobile` varchar(32) NOT NULL,
	`email` varchar(320),
	`passwordHash` varchar(255) NOT NULL,
	`status` enum('active','suspended','closed') NOT NULL DEFAULT 'active',
	`joinedLocationId` int,
	`joinedAt` timestamp NOT NULL DEFAULT (now()),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `loyaltyMembers_id` PRIMARY KEY(`id`),
	CONSTRAINT `loyaltyMembers_memberNumber_unique` UNIQUE(`memberNumber`),
	CONSTRAINT `loyaltyMembers_mobile_unique` UNIQUE(`mobile`),
	CONSTRAINT `loyaltyMembers_email_unique` UNIQUE(`email`)
);
--> statement-breakpoint
CREATE TABLE `loyaltyTransactions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`memberId` int NOT NULL,
	`accountId` int NOT NULL,
	`type` enum('earn','reversal','adjustment','redeem') NOT NULL,
	`points` int NOT NULL,
	`balanceAfter` int NOT NULL,
	`saleId` int,
	`locationId` int,
	`referenceId` varchar(96),
	`note` text,
	`createdById` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `loyaltyTransactions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `payments` (
	`id` int AUTO_INCREMENT NOT NULL,
	`saleId` int NOT NULL,
	`locationId` int NOT NULL,
	`method` enum('cash','gcash','maya','qrph','debit_card','credit_card','bank_transfer') NOT NULL,
	`provider` varchar(64) NOT NULL DEFAULT 'mock',
	`status` enum('authorized','paid','failed','cancelled','refunded') NOT NULL DEFAULT 'authorized',
	`amount` decimal(14,2) NOT NULL,
	`amountTendered` decimal(14,2),
	`changeAmount` decimal(14,2) NOT NULL DEFAULT '0',
	`reference` varchar(120),
	`metadata` json,
	`processedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `payments_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `products` (
	`id` int AUTO_INCREMENT NOT NULL,
	`sku` varchar(80) NOT NULL,
	`name` varchar(180) NOT NULL,
	`description` text,
	`categoryId` int,
	`price` decimal(14,2) NOT NULL,
	`costPrice` decimal(14,2) NOT NULL DEFAULT '0',
	`taxRate` decimal(6,4) NOT NULL DEFAULT '0.12',
	`isTaxInclusive` boolean NOT NULL DEFAULT false,
	`isActive` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `products_id` PRIMARY KEY(`id`),
	CONSTRAINT `products_sku_unique` UNIQUE(`sku`)
);
--> statement-breakpoint
CREATE TABLE `receipts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`saleId` int NOT NULL,
	`receiptNumber` varchar(48) NOT NULL,
	`format` enum('digital') NOT NULL DEFAULT 'digital',
	`content` json NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `receipts_id` PRIMARY KEY(`id`),
	CONSTRAINT `receipts_saleId_unique` UNIQUE(`saleId`),
	CONSTRAINT `receipts_receiptNumber_unique` UNIQUE(`receiptNumber`)
);
--> statement-breakpoint
CREATE TABLE `registers` (
	`id` int AUTO_INCREMENT NOT NULL,
	`locationId` int NOT NULL,
	`code` varchar(40) NOT NULL,
	`name` varchar(120) NOT NULL,
	`isActive` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `registers_id` PRIMARY KEY(`id`),
	CONSTRAINT `register_location_code_unique` UNIQUE(`locationId`,`code`)
);
--> statement-breakpoint
CREATE TABLE `saleItems` (
	`id` int AUTO_INCREMENT NOT NULL,
	`saleId` int NOT NULL,
	`productId` int,
	`skuSnapshot` varchar(80) NOT NULL,
	`nameSnapshot` varchar(180) NOT NULL,
	`unitPrice` decimal(14,2) NOT NULL,
	`quantity` decimal(14,3) NOT NULL,
	`taxRate` decimal(6,4) NOT NULL DEFAULT '0',
	`taxAmount` decimal(14,2) NOT NULL DEFAULT '0',
	`lineTotal` decimal(14,2) NOT NULL,
	CONSTRAINT `saleItems_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `sales` (
	`id` int AUTO_INCREMENT NOT NULL,
	`receiptNumber` varchar(48) NOT NULL,
	`locationId` int NOT NULL,
	`registerId` int,
	`cashSessionId` int,
	`cashierId` int NOT NULL,
	`memberId` int,
	`status` enum('completed','voided') NOT NULL DEFAULT 'completed',
	`subtotal` decimal(14,2) NOT NULL,
	`taxAmount` decimal(14,2) NOT NULL DEFAULT '0',
	`discountAmount` decimal(14,2) NOT NULL DEFAULT '0',
	`totalAmount` decimal(14,2) NOT NULL,
	`qualifyingAmount` decimal(14,2) NOT NULL DEFAULT '0',
	`pointsEarned` int NOT NULL DEFAULT 0,
	`idempotencyKey` varchar(128) NOT NULL,
	`voidedById` int,
	`voidedAt` timestamp,
	`voidReason` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `sales_id` PRIMARY KEY(`id`),
	CONSTRAINT `sales_receiptNumber_unique` UNIQUE(`receiptNumber`),
	CONSTRAINT `sales_idempotencyKey_unique` UNIQUE(`idempotencyKey`)
);
--> statement-breakpoint
CREATE TABLE `stockMovements` (
	`id` int AUTO_INCREMENT NOT NULL,
	`locationId` int NOT NULL,
	`productId` int NOT NULL,
	`quantityDelta` decimal(14,3) NOT NULL,
	`movementType` enum('receiving','sale','void','adjustment','transfer_shipment','transfer_receipt') NOT NULL,
	`referenceType` varchar(64),
	`referenceId` int,
	`note` text,
	`createdById` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `stockMovements_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `stockTransferItems` (
	`id` int AUTO_INCREMENT NOT NULL,
	`transferId` int NOT NULL,
	`productId` int NOT NULL,
	`quantityRequested` decimal(14,3) NOT NULL,
	`quantityShipped` decimal(14,3) NOT NULL DEFAULT '0',
	`quantityReceived` decimal(14,3) NOT NULL DEFAULT '0',
	CONSTRAINT `stockTransferItems_id` PRIMARY KEY(`id`),
	CONSTRAINT `stock_transfer_product_unique` UNIQUE(`transferId`,`productId`)
);
--> statement-breakpoint
CREATE TABLE `stockTransfers` (
	`id` int AUTO_INCREMENT NOT NULL,
	`transferNumber` varchar(48) NOT NULL,
	`sourceLocationId` int NOT NULL,
	`destinationLocationId` int NOT NULL,
	`status` enum('requested','shipped','received','cancelled') NOT NULL DEFAULT 'requested',
	`requestedById` int NOT NULL,
	`shippedById` int,
	`receivedById` int,
	`note` text,
	`requestedAt` timestamp NOT NULL DEFAULT (now()),
	`shippedAt` timestamp,
	`receivedAt` timestamp,
	CONSTRAINT `stockTransfers_id` PRIMARY KEY(`id`),
	CONSTRAINT `stockTransfers_transferNumber_unique` UNIQUE(`transferNumber`)
);
--> statement-breakpoint
CREATE TABLE `systemSettings` (
	`id` int AUTO_INCREMENT NOT NULL,
	`key` varchar(100) NOT NULL,
	`value` json NOT NULL,
	`updatedById` int,
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `systemSettings_id` PRIMARY KEY(`id`),
	CONSTRAINT `systemSettings_key_unique` UNIQUE(`key`)
);
--> statement-breakpoint
CREATE TABLE `userLocations` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`locationId` int NOT NULL,
	`isPrimary` boolean NOT NULL DEFAULT false,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `userLocations_id` PRIMARY KEY(`id`),
	CONSTRAINT `user_locations_unique` UNIQUE(`userId`,`locationId`)
);
--> statement-breakpoint
ALTER TABLE `users` MODIFY COLUMN `openId` varchar(64);--> statement-breakpoint
ALTER TABLE `users` MODIFY COLUMN `name` varchar(160);--> statement-breakpoint
ALTER TABLE `users` MODIFY COLUMN `role` enum('cashier','manager','admin') NOT NULL DEFAULT 'cashier';--> statement-breakpoint
ALTER TABLE `users` ADD `passwordHash` varchar(255);--> statement-breakpoint
ALTER TABLE `users` ADD `isActive` boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD CONSTRAINT `users_email_unique` UNIQUE(`email`);--> statement-breakpoint
ALTER TABLE `auditLogs` ADD CONSTRAINT `auditLogs_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `auditLogs` ADD CONSTRAINT `auditLogs_locationId_locations_id_fk` FOREIGN KEY (`locationId`) REFERENCES `locations`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `cashSessions` ADD CONSTRAINT `cashSessions_registerId_registers_id_fk` FOREIGN KEY (`registerId`) REFERENCES `registers`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `cashSessions` ADD CONSTRAINT `cashSessions_openedById_users_id_fk` FOREIGN KEY (`openedById`) REFERENCES `users`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `cashSessions` ADD CONSTRAINT `cashSessions_closedById_users_id_fk` FOREIGN KEY (`closedById`) REFERENCES `users`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `locationInventory` ADD CONSTRAINT `locationInventory_locationId_locations_id_fk` FOREIGN KEY (`locationId`) REFERENCES `locations`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `locationInventory` ADD CONSTRAINT `locationInventory_productId_products_id_fk` FOREIGN KEY (`productId`) REFERENCES `products`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `loyaltyAccounts` ADD CONSTRAINT `loyaltyAccounts_memberId_loyaltyMembers_id_fk` FOREIGN KEY (`memberId`) REFERENCES `loyaltyMembers`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `loyaltyCards` ADD CONSTRAINT `loyaltyCards_memberId_loyaltyMembers_id_fk` FOREIGN KEY (`memberId`) REFERENCES `loyaltyMembers`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `loyaltyMembers` ADD CONSTRAINT `loyaltyMembers_joinedLocationId_locations_id_fk` FOREIGN KEY (`joinedLocationId`) REFERENCES `locations`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `loyaltyTransactions` ADD CONSTRAINT `loyaltyTransactions_memberId_loyaltyMembers_id_fk` FOREIGN KEY (`memberId`) REFERENCES `loyaltyMembers`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `loyaltyTransactions` ADD CONSTRAINT `loyaltyTransactions_accountId_loyaltyAccounts_id_fk` FOREIGN KEY (`accountId`) REFERENCES `loyaltyAccounts`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `loyaltyTransactions` ADD CONSTRAINT `loyaltyTransactions_saleId_sales_id_fk` FOREIGN KEY (`saleId`) REFERENCES `sales`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `loyaltyTransactions` ADD CONSTRAINT `loyaltyTransactions_locationId_locations_id_fk` FOREIGN KEY (`locationId`) REFERENCES `locations`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `loyaltyTransactions` ADD CONSTRAINT `loyaltyTransactions_createdById_users_id_fk` FOREIGN KEY (`createdById`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `payments` ADD CONSTRAINT `payments_saleId_sales_id_fk` FOREIGN KEY (`saleId`) REFERENCES `sales`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `payments` ADD CONSTRAINT `payments_locationId_locations_id_fk` FOREIGN KEY (`locationId`) REFERENCES `locations`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `products` ADD CONSTRAINT `products_categoryId_categories_id_fk` FOREIGN KEY (`categoryId`) REFERENCES `categories`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `receipts` ADD CONSTRAINT `receipts_saleId_sales_id_fk` FOREIGN KEY (`saleId`) REFERENCES `sales`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `registers` ADD CONSTRAINT `registers_locationId_locations_id_fk` FOREIGN KEY (`locationId`) REFERENCES `locations`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `saleItems` ADD CONSTRAINT `saleItems_saleId_sales_id_fk` FOREIGN KEY (`saleId`) REFERENCES `sales`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `saleItems` ADD CONSTRAINT `saleItems_productId_products_id_fk` FOREIGN KEY (`productId`) REFERENCES `products`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `sales` ADD CONSTRAINT `sales_locationId_locations_id_fk` FOREIGN KEY (`locationId`) REFERENCES `locations`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `sales` ADD CONSTRAINT `sales_registerId_registers_id_fk` FOREIGN KEY (`registerId`) REFERENCES `registers`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `sales` ADD CONSTRAINT `sales_cashSessionId_cashSessions_id_fk` FOREIGN KEY (`cashSessionId`) REFERENCES `cashSessions`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `sales` ADD CONSTRAINT `sales_cashierId_users_id_fk` FOREIGN KEY (`cashierId`) REFERENCES `users`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `sales` ADD CONSTRAINT `sales_memberId_loyaltyMembers_id_fk` FOREIGN KEY (`memberId`) REFERENCES `loyaltyMembers`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `sales` ADD CONSTRAINT `sales_voidedById_users_id_fk` FOREIGN KEY (`voidedById`) REFERENCES `users`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `stockMovements` ADD CONSTRAINT `stockMovements_locationId_locations_id_fk` FOREIGN KEY (`locationId`) REFERENCES `locations`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `stockMovements` ADD CONSTRAINT `stockMovements_productId_products_id_fk` FOREIGN KEY (`productId`) REFERENCES `products`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `stockMovements` ADD CONSTRAINT `stockMovements_createdById_users_id_fk` FOREIGN KEY (`createdById`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `stockTransferItems` ADD CONSTRAINT `stockTransferItems_transferId_stockTransfers_id_fk` FOREIGN KEY (`transferId`) REFERENCES `stockTransfers`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `stockTransferItems` ADD CONSTRAINT `stockTransferItems_productId_products_id_fk` FOREIGN KEY (`productId`) REFERENCES `products`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `stockTransfers` ADD CONSTRAINT `stockTransfers_sourceLocationId_locations_id_fk` FOREIGN KEY (`sourceLocationId`) REFERENCES `locations`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `stockTransfers` ADD CONSTRAINT `stockTransfers_destinationLocationId_locations_id_fk` FOREIGN KEY (`destinationLocationId`) REFERENCES `locations`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `stockTransfers` ADD CONSTRAINT `stockTransfers_requestedById_users_id_fk` FOREIGN KEY (`requestedById`) REFERENCES `users`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `stockTransfers` ADD CONSTRAINT `stockTransfers_shippedById_users_id_fk` FOREIGN KEY (`shippedById`) REFERENCES `users`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `stockTransfers` ADD CONSTRAINT `stockTransfers_receivedById_users_id_fk` FOREIGN KEY (`receivedById`) REFERENCES `users`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `systemSettings` ADD CONSTRAINT `systemSettings_updatedById_users_id_fk` FOREIGN KEY (`updatedById`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `userLocations` ADD CONSTRAINT `userLocations_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `userLocations` ADD CONSTRAINT `userLocations_locationId_locations_id_fk` FOREIGN KEY (`locationId`) REFERENCES `locations`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `audit_logs_entity_idx` ON `auditLogs` (`entityType`,`entityId`,`createdAt`);--> statement-breakpoint
CREATE INDEX `cash_sessions_register_status_idx` ON `cashSessions` (`registerId`,`status`);--> statement-breakpoint
CREATE INDEX `location_inventory_low_stock_idx` ON `locationInventory` (`locationId`,`quantity`,`lowStockThreshold`);--> statement-breakpoint
CREATE INDEX `locations_active_idx` ON `locations` (`isActive`);--> statement-breakpoint
CREATE INDEX `loyalty_cards_member_status_idx` ON `loyaltyCards` (`memberId`,`status`);--> statement-breakpoint
CREATE INDEX `loyalty_members_name_idx` ON `loyaltyMembers` (`lastName`,`firstName`);--> statement-breakpoint
CREATE INDEX `loyalty_transactions_member_created_idx` ON `loyaltyTransactions` (`memberId`,`createdAt`);--> statement-breakpoint
CREATE INDEX `loyalty_transactions_sale_idx` ON `loyaltyTransactions` (`saleId`);--> statement-breakpoint
CREATE INDEX `payments_sale_idx` ON `payments` (`saleId`);--> statement-breakpoint
CREATE INDEX `products_category_active_idx` ON `products` (`categoryId`,`isActive`);--> statement-breakpoint
CREATE INDEX `sale_items_sale_idx` ON `saleItems` (`saleId`);--> statement-breakpoint
CREATE INDEX `sales_location_created_idx` ON `sales` (`locationId`,`createdAt`);--> statement-breakpoint
CREATE INDEX `sales_member_created_idx` ON `sales` (`memberId`,`createdAt`);--> statement-breakpoint
CREATE INDEX `stock_movements_location_product_idx` ON `stockMovements` (`locationId`,`productId`,`createdAt`);--> statement-breakpoint
CREATE INDEX `stock_transfers_locations_status_idx` ON `stockTransfers` (`sourceLocationId`,`destinationLocationId`,`status`);--> statement-breakpoint
CREATE INDEX `user_locations_location_idx` ON `userLocations` (`locationId`);