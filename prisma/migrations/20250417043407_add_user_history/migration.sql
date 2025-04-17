-- CreateTable
CREATE TABLE "user_history_view" (
    "entry_id" INTEGER NOT NULL,
    "user_id" UUID NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "entry_type" TEXT NOT NULL,
    "description" TEXT,
    "value" DOUBLE PRECISION,
    "unit" TEXT
);
