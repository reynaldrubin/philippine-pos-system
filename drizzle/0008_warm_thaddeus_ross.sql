ALTER TABLE `saleReturns` ADD `exchangeSaleId` int;--> statement-breakpoint
ALTER TABLE `saleReturns` ADD CONSTRAINT `sale_returns_exchange_sale_unique` UNIQUE(`exchangeSaleId`);--> statement-breakpoint
ALTER TABLE `saleReturns` ADD CONSTRAINT `saleReturns_exchangeSaleId_sales_id_fk` FOREIGN KEY (`exchangeSaleId`) REFERENCES `sales`(`id`) ON DELETE restrict ON UPDATE no action;