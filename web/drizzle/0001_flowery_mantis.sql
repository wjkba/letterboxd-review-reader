CREATE TABLE `scrape_logs` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`film_id` integer NOT NULL,
	`message` text NOT NULL,
	`level` text DEFAULT 'info' NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`film_id`) REFERENCES `films`(`id`) ON UPDATE no action ON DELETE cascade
);
