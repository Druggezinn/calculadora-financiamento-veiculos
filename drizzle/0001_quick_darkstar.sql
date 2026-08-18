CREATE TABLE `financialInstitutions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`slug` varchar(64) NOT NULL,
	`displayName` varchar(120) NOT NULL,
	`legalName` varchar(200) NOT NULL,
	`monthlyRate` double NOT NULL,
	`annualRate` double,
	`sourceUrl` text,
	`sourceDescription` text,
	`referenceStart` varchar(10),
	`referenceEnd` varchar(10),
	`sortOrder` int NOT NULL DEFAULT 0,
	`isActive` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `financialInstitutions_id` PRIMARY KEY(`id`),
	CONSTRAINT `financialInstitutions_slug_unique` UNIQUE(`slug`)
);
