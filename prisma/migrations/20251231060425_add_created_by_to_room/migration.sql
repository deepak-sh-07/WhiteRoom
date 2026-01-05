/*
  Warnings:

  - You are about to drop the column `createdBy` on the `Room` table. All the data in the column will be lost.
  - The primary key for the `RoomUser` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to drop the column `password` on the `User` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[userId,roomId]` on the table `RoomUser` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `createdById` to the `Room` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Room" DROP COLUMN "createdBy",
ADD COLUMN     "createdById" INTEGER NOT NULL;

-- AlterTable
ALTER TABLE "RoomUser" DROP CONSTRAINT "RoomUser_pkey",
ADD COLUMN     "id" SERIAL NOT NULL,
ADD CONSTRAINT "RoomUser_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "User" DROP COLUMN "password";

-- CreateIndex
CREATE UNIQUE INDEX "RoomUser_userId_roomId_key" ON "RoomUser"("userId", "roomId");

-- AddForeignKey
ALTER TABLE "Room" ADD CONSTRAINT "Room_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
