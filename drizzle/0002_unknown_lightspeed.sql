ALTER TABLE `films` ADD `read_status` text DEFAULT 'unread' NOT NULL;--> statement-breakpoint
ALTER TABLE `films` ADD `reviews_read` integer DEFAULT 0 NOT NULL;