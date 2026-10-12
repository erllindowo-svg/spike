CREATE TYPE "public"."tracking_search_type" AS ENUM('cnpj', 'cnj');--> statement-breakpoint
CREATE TYPE "public"."webhook_processing_status" AS ENUM('pending', 'processing', 'processed', 'failed', 'ignored');--> statement-breakpoint
CREATE TABLE "alerts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid,
	"webhook_event_id" uuid,
	"title" text NOT NULL,
	"description" text,
	"type" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"read_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "companies" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"cnpj" varchar(14) NOT NULL,
	"legal_name" text,
	"registration_status" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "companies_cnpj_unique" UNIQUE("cnpj")
);
--> statement-breakpoint
CREATE TABLE "trackings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"judit_tracking_id" text,
	"company_id" uuid,
	"search_type" "tracking_search_type" NOT NULL,
	"search_key" text NOT NULL,
	"status" text,
	"recurrence_days" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "trackings_judit_tracking_id_unique" UNIQUE("judit_tracking_id"),
	CONSTRAINT "trackings_recurrence_days_positive" CHECK ("trackings"."recurrence_days" IS NULL OR "trackings"."recurrence_days" > 0)
);
--> statement-breakpoint
CREATE TABLE "webhook_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"callback_id" text,
	"event_type" text,
	"reference_type" text,
	"reference_id" text,
	"payload" jsonb NOT NULL,
	"received_at" timestamp with time zone DEFAULT now() NOT NULL,
	"processing_status" "webhook_processing_status" DEFAULT 'pending' NOT NULL,
	"processed_at" timestamp with time zone,
	"processing_error" text,
	CONSTRAINT "webhook_events_callback_id_unique" UNIQUE("callback_id")
);
--> statement-breakpoint
ALTER TABLE "alerts" ADD CONSTRAINT "alerts_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "alerts" ADD CONSTRAINT "alerts_webhook_event_id_webhook_events_id_fk" FOREIGN KEY ("webhook_event_id") REFERENCES "public"."webhook_events"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trackings" ADD CONSTRAINT "trackings_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "alerts_company_id_idx" ON "alerts" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "alerts_webhook_event_id_idx" ON "alerts" USING btree ("webhook_event_id");--> statement-breakpoint
CREATE INDEX "alerts_unread_idx" ON "alerts" USING btree ("created_at") WHERE "alerts"."read_at" IS NULL;--> statement-breakpoint
CREATE INDEX "trackings_company_id_idx" ON "trackings" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "trackings_search_idx" ON "trackings" USING btree ("search_type","search_key");--> statement-breakpoint
CREATE INDEX "webhook_events_reference_id_idx" ON "webhook_events" USING btree ("reference_id");--> statement-breakpoint
CREATE INDEX "webhook_events_processing_status_idx" ON "webhook_events" USING btree ("processing_status","received_at");