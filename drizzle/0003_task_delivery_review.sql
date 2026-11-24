CREATE TYPE "public"."task_delivery_status" AS ENUM('submitted', 'approved', 'rejected');--> statement-breakpoint
ALTER TABLE "tasks" ADD COLUMN "acceptance_criteria" text;--> statement-breakpoint
CREATE TABLE "task_deliveries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"task_id" uuid NOT NULL,
	"submitted_by_id" uuid NOT NULL,
	"note" text NOT NULL,
	"status" "task_delivery_status" DEFAULT 'submitted' NOT NULL,
	"review_note" text,
	"reviewed_by_id" uuid,
	"submitted_at" timestamp with time zone DEFAULT now() NOT NULL,
	"reviewed_at" timestamp with time zone,
	CONSTRAINT "task_deliveries_task_id_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."tasks"("id") ON DELETE cascade,
	CONSTRAINT "task_deliveries_submitted_by_id_users_id_fk" FOREIGN KEY ("submitted_by_id") REFERENCES "public"."users"("id") ON DELETE cascade,
	CONSTRAINT "task_deliveries_reviewed_by_id_users_id_fk" FOREIGN KEY ("reviewed_by_id") REFERENCES "public"."users"("id") ON DELETE set null
);--> statement-breakpoint
CREATE INDEX "task_deliveries_task_submitted_idx" ON "task_deliveries" USING btree ("task_id","submitted_at");
