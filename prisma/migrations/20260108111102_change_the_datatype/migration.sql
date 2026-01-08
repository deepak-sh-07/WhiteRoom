/*
  Warnings:

  - A unique constraint covering the columns `[room_code]` on the table `Room` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "Room" ALTER COLUMN "room_code" SET DATA TYPE TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Room_room_code_key" ON "Room"("room_code");
