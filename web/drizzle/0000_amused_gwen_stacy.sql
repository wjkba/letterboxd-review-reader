CREATE TABLE `films` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`slug` text NOT NULL,
	`title` text NOT NULL,
	`year` integer,
	`poster_path` text,
	`tmdb_id` integer,
	`scrape_status` text DEFAULT 'pending' NOT NULL,
	`scrape_error` text,
	`last_scraped_at` integer,
	`review_count` integer DEFAULT 0 NOT NULL,
	`added_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `films_slug_unique` ON `films` (`slug`);--> statement-breakpoint
CREATE TABLE `reviews` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`film_id` integer NOT NULL,
	`author` text NOT NULL,
	`author_url` text,
	`rating` integer,
	`watched_date` text,
	`review_url` text NOT NULL,
	`html` text NOT NULL,
	`scraped_at` integer NOT NULL,
	FOREIGN KEY (`film_id`) REFERENCES `films`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `reviews_film_url_idx` ON `reviews` (`film_id`,`review_url`);--> statement-breakpoint
CREATE TABLE `scrape_jobs` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`film_id` integer NOT NULL,
	`started_at` integer NOT NULL,
	`finished_at` integer,
	`status` text NOT NULL,
	`pages_scraped` integer DEFAULT 0 NOT NULL,
	`reviews_added` integer DEFAULT 0 NOT NULL,
	`error` text,
	FOREIGN KEY (`film_id`) REFERENCES `films`(`id`) ON UPDATE no action ON DELETE cascade
);
