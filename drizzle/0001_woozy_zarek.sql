CREATE TABLE `chat_messages` (
	`id` text PRIMARY KEY NOT NULL,
	`author_name` text NOT NULL,
	`emoji` text NOT NULL,
	`color` text NOT NULL,
	`content` text NOT NULL,
	`roll_detail` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
