-- AlterTable
ALTER TABLE "user_history_view" ADD CONSTRAINT "user_history_view_pkey" PRIMARY KEY ("entry_id", "user_id", "date");
