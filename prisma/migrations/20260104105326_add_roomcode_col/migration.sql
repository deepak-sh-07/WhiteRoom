/*
  Warnings:

  - Added the required column `room_code` to the `Room` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Room" ADD COLUMN     "room_code" INTEGER NOT NULL;
