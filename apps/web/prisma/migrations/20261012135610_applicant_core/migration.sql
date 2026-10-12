-- CreateEnum
CREATE TYPE "applicant_type" AS ENUM ('新卒', '既卒', '第二新卒');

-- CreateEnum
CREATE TYPE "position_type" AS ENUM ('sogo', 'gino');

-- CreateEnum
CREATE TYPE "call_status" AS ENUM ('none', 'callback_needed', 'no_answer');

-- CreateEnum
CREATE TYPE "hire_type" AS ENUM ('new_grad', 'mid_career');

-- CreateTable
CREATE TABLE "Applicant" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "last_name" VARCHAR(50) NOT NULL,
    "first_name" VARCHAR(50) NOT NULL,
    "last_name_kana" VARCHAR(50),
    "first_name_kana" VARCHAR(50),
    "email" VARCHAR(255) NOT NULL,
    "phone" VARCHAR(20),
    "school_id" UUID,
    "department" VARCHAR(100),
    "graduation_year" SMALLINT,
    "applicant_type" "applicant_type" NOT NULL DEFAULT '新卒',
    "line_user_id" VARCHAR(50),
    "line_linked_at" TIMESTAMP(3),
    "primary_source_id" UUID,
    "agency_contact_id" UUID,
    "position_type" "position_type",
    "memo" TEXT,
    "document_deadline" DATE,
    "offer_acceptance_deadline" DATE,
    "resume_url" VARCHAR(500),
    "call_status" "call_status" NOT NULL DEFAULT 'none',
    "hire_type" "hire_type" NOT NULL DEFAULT 'new_grad',
    "sf_contact_id" VARCHAR(20),
    "sf_employment_cache" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Applicant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ApplicantSource" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "applicant_id" UUID NOT NULL,
    "media_id" UUID,
    "qr_code_id" UUID,
    "external_applicant_id" VARCHAR(100),
    "raw_data" JSONB,

    CONSTRAINT "ApplicantSource_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ApplicantTag" (
    "applicant_id" UUID NOT NULL,
    "tag_id" UUID NOT NULL,
    "tagged_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "tagged_by" UUID,

    CONSTRAINT "ApplicantTag_pkey" PRIMARY KEY ("applicant_id","tag_id")
);

-- CreateTable
CREATE TABLE "LineRegistrationToken" (
    "token" VARCHAR(64) NOT NULL,
    "applicant_id" UUID NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "used_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LineRegistrationToken_pkey" PRIMARY KEY ("token")
);

-- CreateIndex
CREATE UNIQUE INDEX "Applicant_line_user_id_key" ON "Applicant"("line_user_id");

-- CreateIndex
CREATE UNIQUE INDEX "Applicant_primary_source_id_key" ON "Applicant"("primary_source_id");

-- CreateIndex
CREATE INDEX "applicant_email_idx" ON "Applicant"("email");

-- CreateIndex
CREATE INDEX "applicant_sf_idx" ON "Applicant"("sf_contact_id");

-- CreateIndex
CREATE INDEX "applicant_created_idx" ON "Applicant"("created_at" DESC);

-- AddForeignKey
ALTER TABLE "Applicant" ADD CONSTRAINT "Applicant_school_id_fkey" FOREIGN KEY ("school_id") REFERENCES "School"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Applicant" ADD CONSTRAINT "Applicant_primary_source_id_fkey" FOREIGN KEY ("primary_source_id") REFERENCES "ApplicantSource"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApplicantSource" ADD CONSTRAINT "ApplicantSource_applicant_id_fkey" FOREIGN KEY ("applicant_id") REFERENCES "Applicant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApplicantSource" ADD CONSTRAINT "ApplicantSource_media_id_fkey" FOREIGN KEY ("media_id") REFERENCES "Media"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApplicantSource" ADD CONSTRAINT "ApplicantSource_qr_code_id_fkey" FOREIGN KEY ("qr_code_id") REFERENCES "QRCode"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApplicantTag" ADD CONSTRAINT "ApplicantTag_applicant_id_fkey" FOREIGN KEY ("applicant_id") REFERENCES "Applicant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApplicantTag" ADD CONSTRAINT "ApplicantTag_tag_id_fkey" FOREIGN KEY ("tag_id") REFERENCES "Tag"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApplicantTag" ADD CONSTRAINT "ApplicantTag_tagged_by_fkey" FOREIGN KEY ("tagged_by") REFERENCES "Staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LineRegistrationToken" ADD CONSTRAINT "LineRegistrationToken_applicant_id_fkey" FOREIGN KEY ("applicant_id") REFERENCES "Applicant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

