ALTER TABLE "courses" ADD COLUMN "access_tier" text DEFAULT 'free' NOT NULL;--> statement-breakpoint
ALTER TABLE "lessons" ADD COLUMN "video_url" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "access_tier" text DEFAULT 'free' NOT NULL;