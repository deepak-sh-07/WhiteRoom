-- CreateEnum
CREATE TYPE "RoomRole" AS ENUM ('HOST', 'PEER');

-- CreateEnum
CREATE TYPE "RoomStatus" AS ENUM ('PENDING', 'APPROVED', 'JOINED', 'LEFT', 'KICKED');

-- AlterTable
ALTER TABLE "RoomUser" ADD COLUMN     "role" "RoomRole" NOT NULL DEFAULT 'PEER',
ADD COLUMN     "status" "RoomStatus" NOT NULL DEFAULT 'PENDING';
