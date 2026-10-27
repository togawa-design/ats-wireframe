-- CreateEnum
CREATE TYPE "rich_menu_status" AS ENUM ('draft', 'published');

-- CreateTable
CREATE TABLE "RichMenu" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" VARCHAR(100) NOT NULL,
    "line_rich_menu_id" VARCHAR(100),
    "chat_bar_text" VARCHAR(14) NOT NULL,
    "image_url" VARCHAR(500),
    "layout" VARCHAR(20) NOT NULL,
    "areas" JSONB NOT NULL,
    "status" "rich_menu_status" NOT NULL DEFAULT 'draft',
    "priority" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RichMenu_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RichMenuRule" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "rich_menu_id" UUID NOT NULL,
    "tag_id" UUID NOT NULL,

    CONSTRAINT "RichMenuRule_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "RichMenuRule_rich_menu_id_tag_id_key" ON "RichMenuRule"("rich_menu_id", "tag_id");

-- AddForeignKey
ALTER TABLE "RichMenuRule" ADD CONSTRAINT "RichMenuRule_rich_menu_id_fkey" FOREIGN KEY ("rich_menu_id") REFERENCES "RichMenu"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RichMenuRule" ADD CONSTRAINT "RichMenuRule_tag_id_fkey" FOREIGN KEY ("tag_id") REFERENCES "Tag"("id") ON DELETE CASCADE ON UPDATE CASCADE;
