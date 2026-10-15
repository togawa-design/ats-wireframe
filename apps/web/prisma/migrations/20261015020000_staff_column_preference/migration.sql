-- CreateTable
CREATE TABLE "StaffColumnPreference" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "staff_id" UUID NOT NULL,
    "columns" JSONB NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StaffColumnPreference_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "StaffColumnPreference_staff_id_key" ON "StaffColumnPreference"("staff_id");

-- AddForeignKey
ALTER TABLE "StaffColumnPreference" ADD CONSTRAINT "StaffColumnPreference_staff_id_fkey" FOREIGN KEY ("staff_id") REFERENCES "Staff"("id") ON DELETE CASCADE ON UPDATE CASCADE;
