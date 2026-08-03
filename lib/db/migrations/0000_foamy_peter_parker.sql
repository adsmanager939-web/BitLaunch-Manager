CREATE TABLE IF NOT EXISTS "sessions" (
	"session_id" text PRIMARY KEY NOT NULL,
	"server_id" text,
	"user_id" text NOT NULL,
	"phase" text NOT NULL,
	"steps" json DEFAULT '[]'::json NOT NULL,
	"server_ip" text,
	"wg_public_key" text,
	"wg_config" text,
	"error" text,
	"started_at" timestamp with time zone NOT NULL
);
