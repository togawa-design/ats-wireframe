-- CreateEnum
CREATE TYPE "selection_result" AS ENUM ('pending', 'passed', 'failed', 'withdrawn', 'offer_declined');

-- CreateEnum
CREATE TYPE "evaluation_item_type" AS ENUM ('score5', 'score10', 'text', 'checkbox');

-- CreateTable
CREATE TABLE "Selection" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "applicant_id" UUID NOT NULL,
    "flow_id" UUID NOT NULL,
    "current_stage_id" UUID NOT NULL,
    "result" "selection_result" NOT NULL DEFAULT 'pending',
    "assigned_to" UUID,

    CONSTRAINT "Selection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SelectionHistory" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "selection_id" UUID NOT NULL,
    "from_stage_id" UUID,
    "to_stage_id" UUID NOT NULL,
    "changed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "changed_by" UUID NOT NULL,
    "note" TEXT,
    "decline_reason" TEXT,

    CONSTRAINT "SelectionHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Interview" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "selection_id" UUID NOT NULL,
    "stage_id" UUID NOT NULL,
    "interviewer_id" UUID NOT NULL,
    "calendar_slot_id" UUID,
    "scheduled_at" TIMESTAMP(3) NOT NULL,
    "score" SMALLINT,
    "notes" TEXT,
    "garoon_event_id" VARCHAR(100),
    "is_evaluation_complete" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "Interview_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EvaluationTemplate" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" VARCHAR(100) NOT NULL,
    "stage_id" UUID,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_by" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EvaluationTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EvaluationItem" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "template_id" UUID NOT NULL,
    "question" VARCHAR(200) NOT NULL,
    "item_type" "evaluation_item_type" NOT NULL,
    "sort_order" SMALLINT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EvaluationItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EvaluationResponse" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "interview_id" UUID NOT NULL,
    "item_id" UUID NOT NULL,
    "score" SMALLINT,
    "answer_text" TEXT,
    "submitted_by" UUID NOT NULL,
    "submitted_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EvaluationResponse_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Selection_applicant_id_key" ON "Selection"("applicant_id");

-- CreateIndex
CREATE INDEX "selection_stage_idx" ON "Selection"("current_stage_id");

-- CreateIndex
CREATE INDEX "selection_result_idx" ON "Selection"("result");

-- CreateIndex
CREATE UNIQUE INDEX "eval_resp_interview_idx" ON "EvaluationResponse"("interview_id", "item_id");

-- AddForeignKey
ALTER TABLE "Selection" ADD CONSTRAINT "Selection_applicant_id_fkey" FOREIGN KEY ("applicant_id") REFERENCES "Applicant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Selection" ADD CONSTRAINT "Selection_flow_id_fkey" FOREIGN KEY ("flow_id") REFERENCES "SelectionFlow"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Selection" ADD CONSTRAINT "Selection_current_stage_id_fkey" FOREIGN KEY ("current_stage_id") REFERENCES "SelectionStage"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Selection" ADD CONSTRAINT "Selection_assigned_to_fkey" FOREIGN KEY ("assigned_to") REFERENCES "Staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SelectionHistory" ADD CONSTRAINT "SelectionHistory_selection_id_fkey" FOREIGN KEY ("selection_id") REFERENCES "Selection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SelectionHistory" ADD CONSTRAINT "SelectionHistory_from_stage_id_fkey" FOREIGN KEY ("from_stage_id") REFERENCES "SelectionStage"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SelectionHistory" ADD CONSTRAINT "SelectionHistory_to_stage_id_fkey" FOREIGN KEY ("to_stage_id") REFERENCES "SelectionStage"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SelectionHistory" ADD CONSTRAINT "SelectionHistory_changed_by_fkey" FOREIGN KEY ("changed_by") REFERENCES "Staff"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Interview" ADD CONSTRAINT "Interview_selection_id_fkey" FOREIGN KEY ("selection_id") REFERENCES "Selection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Interview" ADD CONSTRAINT "Interview_stage_id_fkey" FOREIGN KEY ("stage_id") REFERENCES "SelectionStage"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Interview" ADD CONSTRAINT "Interview_interviewer_id_fkey" FOREIGN KEY ("interviewer_id") REFERENCES "Staff"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EvaluationTemplate" ADD CONSTRAINT "EvaluationTemplate_stage_id_fkey" FOREIGN KEY ("stage_id") REFERENCES "SelectionStage"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EvaluationTemplate" ADD CONSTRAINT "EvaluationTemplate_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "Staff"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EvaluationItem" ADD CONSTRAINT "EvaluationItem_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "EvaluationTemplate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EvaluationResponse" ADD CONSTRAINT "EvaluationResponse_interview_id_fkey" FOREIGN KEY ("interview_id") REFERENCES "Interview"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EvaluationResponse" ADD CONSTRAINT "EvaluationResponse_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "EvaluationItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EvaluationResponse" ADD CONSTRAINT "EvaluationResponse_submitted_by_fkey" FOREIGN KEY ("submitted_by") REFERENCES "Staff"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

