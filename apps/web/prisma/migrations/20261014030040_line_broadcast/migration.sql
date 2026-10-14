-- AlterTable
ALTER TABLE "Applicant" ADD COLUMN     "mypage_last_accessed_at" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "LineMessage" ADD COLUMN     "broadcast_id" UUID;

-- CreateTable
CREATE TABLE "LineBroadcast" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "template_text" TEXT NOT NULL,
    "tag_id" UUID,
    "recipient_count" SMALLINT NOT NULL,
    "sent_count" SMALLINT NOT NULL,
    "sent_by" UUID NOT NULL,
    "sent_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LineBroadcast_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "linebroadcast_sent_idx" ON "LineBroadcast"("sent_at" DESC);

-- AddForeignKey
ALTER TABLE "LineMessage" ADD CONSTRAINT "LineMessage_broadcast_id_fkey" FOREIGN KEY ("broadcast_id") REFERENCES "LineBroadcast"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LineBroadcast" ADD CONSTRAINT "LineBroadcast_tag_id_fkey" FOREIGN KEY ("tag_id") REFERENCES "Tag"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LineBroadcast" ADD CONSTRAINT "LineBroadcast_sent_by_fkey" FOREIGN KEY ("sent_by") REFERENCES "Staff"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
