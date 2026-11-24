CREATE TYPE "public"."asset_review_status" AS ENUM('draft', 'in_review', 'approved', 'changes_requested');--> statement-breakpoint
ALTER TABLE "assets" ADD COLUMN "review_status" "asset_review_status" DEFAULT 'draft' NOT NULL;--> statement-breakpoint
ALTER TABLE "assets" ADD COLUMN "review_note" text;--> statement-breakpoint
ALTER TABLE "assets" ADD COLUMN "reviewed_by_id" uuid;--> statement-breakpoint
ALTER TABLE "assets" ADD COLUMN "reviewed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "assets" ADD CONSTRAINT "assets_reviewed_by_id_users_id_fk" FOREIGN KEY ("reviewed_by_id") REFERENCES "public"."users"("id") ON DELETE set null;--> statement-breakpoint
CREATE TABLE "document_comments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"document_id" uuid NOT NULL,
	"author_id" uuid NOT NULL,
	"quote" text,
	"content" text NOT NULL,
	"resolved_at" timestamp with time zone,
	"resolved_by_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "document_comments_document_id_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE cascade,
	CONSTRAINT "document_comments_author_id_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."users"("id") ON DELETE cascade,
	CONSTRAINT "document_comments_resolved_by_id_users_id_fk" FOREIGN KEY ("resolved_by_id") REFERENCES "public"."users"("id") ON DELETE set null
);--> statement-breakpoint
CREATE INDEX "document_comments_document_created_idx" ON "document_comments" USING btree ("document_id","created_at");
