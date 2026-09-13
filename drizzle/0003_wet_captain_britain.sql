CREATE TABLE `chat_authority` (
	`id` integer PRIMARY KEY NOT NULL,
	`primary_gm_client_id` text NOT NULL,
	`primary_gm_name` text NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
