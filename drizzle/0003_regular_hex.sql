CREATE TABLE `localAuthSessions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`sessionHash` varchar(128) NOT NULL,
	`expiresAt` timestamp NOT NULL,
	`revokedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `localAuthSessions_id` PRIMARY KEY(`id`),
	CONSTRAINT `localAuthSessions_sessionHash_unique` UNIQUE(`sessionHash`)
);
--> statement-breakpoint
CREATE TABLE `localLoginAttempts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`username` varchar(64) NOT NULL,
	`wasSuccessful` boolean NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `localLoginAttempts_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `localUsers` (
	`id` int AUTO_INCREMENT NOT NULL,
	`username` varchar(64) NOT NULL,
	`passwordHash` varchar(512) NOT NULL,
	`role` enum('user','admin') NOT NULL DEFAULT 'user',
	`failedLoginCount` int NOT NULL DEFAULT 0,
	`lockUntil` timestamp,
	`lastLoginAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `localUsers_id` PRIMARY KEY(`id`),
	CONSTRAINT `localUsers_username_unique` UNIQUE(`username`)
);
--> statement-breakpoint
CREATE INDEX `localAuthSessions_sessionHash_idx` ON `localAuthSessions` (`sessionHash`);--> statement-breakpoint
CREATE INDEX `localLoginAttempts_username_idx` ON `localLoginAttempts` (`username`);