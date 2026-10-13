-- CreateEnum
CREATE TYPE "line_message_direction" AS ENUM ('inbound', 'outbound');

-- CreateEnum
CREATE TYPE "line_message_type" AS ENUM ('text', 'image', 'file', 'sticker', 'template', 'flex');

-- CreateTable
CREATE TABLE "LineMessage" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "applicant_id" UUID NOT NULL,
    "direction" "line_message_direction" NOT NULL,
    "message_type" "line_message_type" NOT NULL DEFAULT 'text',
    "content" TEXT,
    "file_url" VARCHAR(500),
    "file_name" VARCHAR(200),
    "is_read" BOOLEAN NOT NULL DEFAULT false,
    "sent_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LineMessage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "linemsg_applicant_idx" ON "LineMessage"("applicant_id", "sent_at" DESC);

-- CreateIndex
CREATE INDEX "linemsg_unread_idx" ON "LineMessage"("is_read", "direction", "sent_at");

-- AddForeignKey
ALTER TABLE "LineMessage" ADD CONSTRAINT "LineMessage_applicant_id_fkey" FOREIGN KEY ("applicant_id") REFERENCES "Applicant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

