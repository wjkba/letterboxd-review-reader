ALTER TABLE `reviews` ADD `viewing_id` text;--> statement-breakpoint
ALTER TABLE `reviews` ADD `liked` integer DEFAULT false NOT NULL;