-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "staff_role" AS ENUM ('admin', 'recruiter', 'interviewer', 'viewer');

-- CreateEnum
CREATE TYPE "staff_position_access" AS ENUM ('sogo', 'gino', 'both');

-- CreateEnum
CREATE TYPE "audit_action" AS ENUM ('login', 'logout', 'export', 'status_change', 'offer', 'acceptance', 'line_send', 'edit_applicant', 'document_export');

-- CreateEnum
CREATE TYPE "school_type" AS ENUM ('大学', '大学院', '短大', '専門', '高専');

-- CreateEnum
CREATE TYPE "media_sync_type" AS ENUM ('api', 'csv');

-- CreateEnum
CREATE TYPE "stage_type" AS ENUM ('entry', 'screening', 'interview_1st', 'interview_2nd', 'interview_final', 'offer', 'acceptance');

-- CreateTable
CREATE TABLE "Staff" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" VARCHAR(100) NOT NULL,
    "email" VARCHAR(255) NOT NULL,
    "google_id" VARCHAR(255) NOT NULL,
    "garoon_user_id" VARCHAR(100),
    "role" "staff_role" NOT NULL DEFAULT 'recruiter',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "position_type_access" "staff_position_access" NOT NULL DEFAULT 'both',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Staff_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StaffSession" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "staff_id" UUID NOT NULL,
    "ip_address" VARCHAR(45) NOT NULL,
    "user_agent" VARCHAR(500) NOT NULL,
    "logged_in_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "logged_out_at" TIMESTAMP(3),

    CONSTRAINT "StaffSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "staff_id" UUID NOT NULL,
    "action" "audit_action" NOT NULL,
    "target_type" VARCHAR(50),
    "target_id" UUID,
    "before_value" JSONB,
    "after_value" JSONB,
    "ip_address" VARCHAR(45) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Tag" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" VARCHAR(50) NOT NULL,
    "color" VARCHAR(7) NOT NULL,
    "created_by" UUID NOT NULL,

    CONSTRAINT "Tag_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "School" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" VARCHAR(200) NOT NULL,
    "type" "school_type" NOT NULL,
    "category" VARCHAR(50),
    "sf_account_id" VARCHAR(20),

    CONSTRAINT "School_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Media" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" VARCHAR(100) NOT NULL,
    "field_mapping" JSONB NOT NULL,
    "sync_type" "media_sync_type" NOT NULL,
    "cost" INTEGER,

    CONSTRAINT "Media_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QRCode" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "label" VARCHAR(100) NOT NULL,
    "liff_url" VARCHAR(500) NOT NULL,
    "auto_tags" JSONB NOT NULL,
    "scan_count" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "QRCode_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SelectionFlow" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" VARCHAR(100) NOT NULL,
    "is_default" BOOLEAN NOT NULL,
    "is_active" BOOLEAN NOT NULL,

    CONSTRAINT "SelectionFlow_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SelectionStage" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "flow_id" UUID NOT NULL,
    "name" VARCHAR(50) NOT NULL,
    "order" SMALLINT NOT NULL,
    "stage_type" "stage_type" NOT NULL,

    CONSTRAINT "SelectionStage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Staff_email_key" ON "Staff"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Staff_google_id_key" ON "Staff"("google_id");

-- CreateIndex
CREATE INDEX "staff_email_idx" ON "Staff"("email");

-- CreateIndex
CREATE INDEX "staff_google_id_idx" ON "Staff"("google_id");

-- CreateIndex
CREATE INDEX "session_staff_idx" ON "StaffSession"("staff_id", "logged_out_at");

-- CreateIndex
CREATE INDEX "audit_staff_idx" ON "AuditLog"("staff_id", "created_at");

-- CreateIndex
CREATE INDEX "audit_target_idx" ON "AuditLog"("target_type", "target_id");

-- CreateIndex
CREATE UNIQUE INDEX "Tag_name_key" ON "Tag"("name");

-- CreateIndex
CREATE UNIQUE INDEX "School_name_key" ON "School"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Media_name_key" ON "Media"("name");

-- AddForeignKey
ALTER TABLE "StaffSession" ADD CONSTRAINT "StaffSession_staff_id_fkey" FOREIGN KEY ("staff_id") REFERENCES "Staff"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_staff_id_fkey" FOREIGN KEY ("staff_id") REFERENCES "Staff"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Tag" ADD CONSTRAINT "Tag_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "Staff"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SelectionStage" ADD CONSTRAINT "SelectionStage_flow_id_fkey" FOREIGN KEY ("flow_id") REFERENCES "SelectionFlow"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

