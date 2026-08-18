CREATE TABLE `adminAuditLogs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`actorOpenId` varchar(64) NOT NULL,
	`action` varchar(80) NOT NULL,
	`targetType` varchar(80) NOT NULL,
	`targetId` varchar(128),
	`previousValue` text,
	`nextValue` text,
	`sourceUrl` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `adminAuditLogs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `appSettings` (
	`id` int NOT NULL,
	`brandName` varchar(80) NOT NULL DEFAULT 'AutoFin',
	`logoUrl` text,
	`logoStorageKey` varchar(500),
	`updatedByOpenId` varchar(64),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `appSettings_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `rateSyncRuns` (
	`id` int AUTO_INCREMENT NOT NULL,
	`actorOpenId` varchar(64) NOT NULL,
	`sourceUrl` text NOT NULL,
	`status` enum('success','partial','failed') NOT NULL,
	`referenceStart` varchar(10),
	`referenceEnd` varchar(10),
	`recordsFound` int NOT NULL DEFAULT 0,
	`recordsUpdated` int NOT NULL DEFAULT 0,
	`details` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `rateSyncRuns_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `financialInstitutions` ADD `bcbCnpj8` varchar(8);