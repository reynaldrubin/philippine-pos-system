CREATE TABLE `purchaseOrderItems` (
	`id` int AUTO_INCREMENT NOT NULL,
	`orderId` int NOT NULL,
	`productId` int NOT NULL,
	`quantityOrdered` decimal(14,3) NOT NULL,
	`quantityReceived` decimal(14,3) NOT NULL DEFAULT '0',
	`unitCost` decimal(14,2) NOT NULL DEFAULT '0',
	CONSTRAINT `purchaseOrderItems_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `purchaseOrders` (
	`id` int AUTO_INCREMENT NOT NULL,
	`orderNumber` varchar(48) NOT NULL,
	`locationId` int NOT NULL,
	`requestId` int,
	`supplierName` varchar(180) NOT NULL,
	`createdById` int NOT NULL,
	`approvedById` int,
	`status` enum('draft','submitted','approved','ordered','partially_received','received','cancelled') NOT NULL DEFAULT 'draft',
	`note` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`approvedAt` timestamp,
	`orderedAt` timestamp,
	`receivedAt` timestamp,
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `purchaseOrders_id` PRIMARY KEY(`id`),
	CONSTRAINT `purchaseOrders_orderNumber_unique` UNIQUE(`orderNumber`)
);
--> statement-breakpoint
CREATE TABLE `purchaseRequestItems` (
	`id` int AUTO_INCREMENT NOT NULL,
	`requestId` int NOT NULL,
	`productId` int NOT NULL,
	`quantityRequested` decimal(14,3) NOT NULL,
	`note` text,
	CONSTRAINT `purchaseRequestItems_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `purchaseRequests` (
	`id` int AUTO_INCREMENT NOT NULL,
	`requestNumber` varchar(48) NOT NULL,
	`locationId` int NOT NULL,
	`requestedById` int NOT NULL,
	`approvedById` int,
	`status` enum('draft','submitted','approved','rejected','converted') NOT NULL DEFAULT 'draft',
	`note` text,
	`rejectionReason` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`submittedAt` timestamp,
	`approvedAt` timestamp,
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `purchaseRequests_id` PRIMARY KEY(`id`),
	CONSTRAINT `purchaseRequests_requestNumber_unique` UNIQUE(`requestNumber`)
);
--> statement-breakpoint
ALTER TABLE `purchaseOrderItems` ADD CONSTRAINT `purchaseOrderItems_orderId_purchaseOrders_id_fk` FOREIGN KEY (`orderId`) REFERENCES `purchaseOrders`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `purchaseOrderItems` ADD CONSTRAINT `purchaseOrderItems_productId_products_id_fk` FOREIGN KEY (`productId`) REFERENCES `products`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `purchaseOrders` ADD CONSTRAINT `purchaseOrders_locationId_locations_id_fk` FOREIGN KEY (`locationId`) REFERENCES `locations`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `purchaseOrders` ADD CONSTRAINT `purchaseOrders_requestId_purchaseRequests_id_fk` FOREIGN KEY (`requestId`) REFERENCES `purchaseRequests`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `purchaseOrders` ADD CONSTRAINT `purchaseOrders_createdById_users_id_fk` FOREIGN KEY (`createdById`) REFERENCES `users`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `purchaseOrders` ADD CONSTRAINT `purchaseOrders_approvedById_users_id_fk` FOREIGN KEY (`approvedById`) REFERENCES `users`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `purchaseRequestItems` ADD CONSTRAINT `purchaseRequestItems_requestId_purchaseRequests_id_fk` FOREIGN KEY (`requestId`) REFERENCES `purchaseRequests`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `purchaseRequestItems` ADD CONSTRAINT `purchaseRequestItems_productId_products_id_fk` FOREIGN KEY (`productId`) REFERENCES `products`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `purchaseRequests` ADD CONSTRAINT `purchaseRequests_locationId_locations_id_fk` FOREIGN KEY (`locationId`) REFERENCES `locations`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `purchaseRequests` ADD CONSTRAINT `purchaseRequests_requestedById_users_id_fk` FOREIGN KEY (`requestedById`) REFERENCES `users`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `purchaseRequests` ADD CONSTRAINT `purchaseRequests_approvedById_users_id_fk` FOREIGN KEY (`approvedById`) REFERENCES `users`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `purchase_order_items_order_idx` ON `purchaseOrderItems` (`orderId`);--> statement-breakpoint
CREATE INDEX `purchase_orders_location_status_idx` ON `purchaseOrders` (`locationId`,`status`);--> statement-breakpoint
CREATE INDEX `purchase_request_items_request_idx` ON `purchaseRequestItems` (`requestId`);--> statement-breakpoint
CREATE INDEX `purchase_requests_location_status_idx` ON `purchaseRequests` (`locationId`,`status`);