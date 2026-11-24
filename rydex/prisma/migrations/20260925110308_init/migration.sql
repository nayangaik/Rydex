-- CreateEnum
CREATE TYPE "Role" AS ENUM ('user', 'vendor', 'admin', 'partner');

-- CreateEnum
CREATE TYPE "VendorStatus" AS ENUM ('pending', 'approved', 'rejected');

-- CreateEnum
CREATE TYPE "VideoKycStatus" AS ENUM ('not_required', 'pending', 'in_progress', 'approved', 'rejected');

-- CreateEnum
CREATE TYPE "VehicleType" AS ENUM ('bike', 'car', 'loading', 'truck', 'auto');

-- CreateEnum
CREATE TYPE "ApprovalStatus" AS ENUM ('approved', 'pending', 'rejected');

-- CreateEnum
CREATE TYPE "BankStatus" AS ENUM ('not_added', 'added', 'verified');

-- CreateEnum
CREATE TYPE "BookingStatus" AS ENUM ('pending', 'active', 'completed', 'cancelled');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT,
    "image" TEXT,
    "role" "Role" NOT NULL DEFAULT 'user',
    "isVerified" BOOLEAN NOT NULL DEFAULT false,
    "otp" TEXT,
    "otpExpiry" TIMESTAMP(3),
    "vendorOnboardingStep" INTEGER NOT NULL DEFAULT 0,
    "vendorStatus" "VendorStatus" NOT NULL DEFAULT 'pending',
    "vendorRejectionReason" TEXT DEFAULT '',
    "vendorProfileCompleted" BOOLEAN NOT NULL DEFAULT false,
    "vendorApprovedAt" TIMESTAMP(3),
    "isVendorBlocked" BOOLEAN NOT NULL DEFAULT false,
    "videoKycStatus" "VideoKycStatus" NOT NULL DEFAULT 'not_required',
    "videoKycRoomId" TEXT,
    "videoKycRejectionReason" TEXT,
    "isOnline" BOOLEAN NOT NULL DEFAULT false,
    "socketId" TEXT,
    "currentVehicleType" "VehicleType",
    "locationLng" DOUBLE PRECISION,
    "locationLat" DOUBLE PRECISION,
    "lastLocationUpdate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "vehicleId" TEXT,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Vehicle" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "type" "VehicleType" NOT NULL,
    "vehicleModel" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "imageUrl" TEXT,
    "baseFare" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "pricePerKM" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "waitingCharge" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "status" "ApprovalStatus" NOT NULL DEFAULT 'pending',
    "rejectionReason" TEXT DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Vehicle_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PartnerBank" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "accountHolder" TEXT NOT NULL,
    "accountNumber" TEXT NOT NULL,
    "ifsc" TEXT NOT NULL,
    "upi" TEXT,
    "mobileNumber" TEXT NOT NULL,
    "status" "BankStatus" NOT NULL DEFAULT 'not_added',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PartnerBank_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PartnerDocs" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "aadharUrl" TEXT NOT NULL,
    "rcUrl" TEXT NOT NULL,
    "licenseUrl" TEXT NOT NULL,
    "status" "ApprovalStatus" NOT NULL DEFAULT 'pending',
    "rejectionReason" TEXT DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PartnerDocs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Booking" (
    "id" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "vehicleId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "fare" DOUBLE PRECISION NOT NULL,
    "status" "BookingStatus" NOT NULL DEFAULT 'pending',
    "pickupAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Booking_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_vehicleId_key" ON "User"("vehicleId");

-- CreateIndex
CREATE INDEX "User_email_idx" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_role_idx" ON "User"("role");

-- CreateIndex
CREATE UNIQUE INDEX "Vehicle_ownerId_key" ON "Vehicle"("ownerId");

-- CreateIndex
CREATE UNIQUE INDEX "Vehicle_number_key" ON "Vehicle"("number");

-- CreateIndex
CREATE INDEX "Vehicle_status_idx" ON "Vehicle"("status");

-- CreateIndex
CREATE UNIQUE INDEX "PartnerBank_ownerId_key" ON "PartnerBank"("ownerId");

-- CreateIndex
CREATE UNIQUE INDEX "PartnerDocs_ownerId_key" ON "PartnerDocs"("ownerId");

-- CreateIndex
CREATE INDEX "Booking_vendorId_idx" ON "Booking"("vendorId");

-- CreateIndex
CREATE INDEX "Booking_vehicleId_idx" ON "Booking"("vehicleId");

-- CreateIndex
CREATE INDEX "Booking_status_idx" ON "Booking"("status");

-- CreateIndex
CREATE INDEX "Booking_completedAt_idx" ON "Booking"("completedAt");

-- CreateIndex
CREATE INDEX "Booking_vendorId_completedAt_status_idx" ON "Booking"("vendorId", "completedAt", "status");

-- AddForeignKey
ALTER TABLE "Vehicle" ADD CONSTRAINT "Vehicle_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PartnerBank" ADD CONSTRAINT "PartnerBank_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PartnerDocs" ADD CONSTRAINT "PartnerDocs_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
