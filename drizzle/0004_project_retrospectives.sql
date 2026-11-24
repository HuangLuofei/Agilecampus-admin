CREATE TYPE "public"."retrospective_status" AS ENUM('draft', 'published');--> statement-breakpoint
CREATE TABLE "project_retrospectives" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"created_by_id" uuid,
	"title" text NOT NULL,
	"summary" text DEFAULT '' NOT NULL,
	"went_well" text DEFAULT '' NOT NULL,
	"challenges" text DEFAULT '' NOT NULL,
	"lessons" text DEFAULT '' NOT NULL,
	"next_steps" text DEFAULT '' NOT NULL,
	"status" "retrospective_status" DEFAULT 'draft' NOT NULL,
	"published_by_id" uuid,
	"published_at" timestamp with time zone,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "project_retrospectives_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade,
	CONSTRAINT "project_retrospectives_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE set null,
	CONSTRAINT "project_retrospectives_published_by_id_users_id_fk" FOREIGN KEY ("published_by_id") REFERENCES "public"."users"("id") ON DELETE set null
);--> statement-breakpoint
CREATE INDEX "project_retrospectives_project_created_idx" ON "project_retrospectives" USING btree ("project_id","created_at");--> statement-breakpoint
CREATE INDEX "project_retrospectives_project_status_idx" ON "project_retrospectives" USING btree ("project_id","status");
