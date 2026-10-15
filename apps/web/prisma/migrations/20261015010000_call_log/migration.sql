-- CreateTable
CREATE TABLE "CallLog" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "applicant_id" UUID NOT NULL,
    "staff_id" UUID NOT NULL,
    "called_at" TIMESTAMP(3) NOT NULL,
    "result" VARCHAR(50) NOT NULL,
    "note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CallLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "call_log_applicant_idx" ON "CallLog"("applicant_id", "called_at" DESC);

-- AddForeignKey
ALTER TABLE "CallLog" ADD CONSTRAINT "CallLog_applicant_id_fkey" FOREIGN KEY ("applicant_id") REFERENCES "Applicant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CallLog" ADD CONSTRAINT "CallLog_staff_id_fkey" FOREIGN KEY ("staff_id") REFERENCES "Staff"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
