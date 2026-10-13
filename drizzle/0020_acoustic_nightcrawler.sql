CREATE TABLE "tier_roles" (
	"tier" text PRIMARY KEY NOT NULL,
	"roles" text[] NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
