/**
 * MongoDB → PostgreSQL Migration Script
 * Reads all data from MongoDB Atlas and inserts into local PostgreSQL via Prisma.
 *
 * Run with:
 *   node scripts/migrate-mongo-to-pg.mjs
 */

// Load .env file so Prisma picks up DATABASE_URL
import { readFileSync } from "fs";
import { resolve } from "path";

try {
  const envPath = resolve(process.cwd(), ".env");
  const envContent = readFileSync(envPath, "utf8");
  for (const line of envContent.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    const val = trimmed.slice(eqIdx + 1).trim().replace(/^["']|["']$/g, "");
    if (!process.env[key]) process.env[key] = val;
  }
  console.log("✔  Loaded .env file");
} catch {
  console.warn("⚠  Could not load .env file — ensure DATABASE_URL is set");
}

import mongoose from "mongoose";
import dns from "dns";
dns.setDefaultResultOrder("ipv4first");
dns.setServers(["8.8.8.8", "8.8.4.4"]);
import { PrismaClient } from "@prisma/client";
import { createRequire } from "module";

// ─── Config ──────────────────────────────────────────────────────────────────
const MONGODB_URL =
  "mongodb+srv://rssb19092022_db_user:BgGRPwtMETPcELjp@cluster0.advaxeg.mongodb.net/?appName=Cluster0";

const prisma = new PrismaClient();

// ─── Colour helpers ───────────────────────────────────────────────────────────
const c = {
  green: (s) => `\x1b[32m${s}\x1b[0m`,
  yellow: (s) => `\x1b[33m${s}\x1b[0m`,
  red: (s) => `\x1b[31m${s}\x1b[0m`,
  cyan: (s) => `\x1b[36m${s}\x1b[0m`,
  bold: (s) => `\x1b[1m${s}\x1b[0m`,
};

function log(emoji, label, msg) {
  console.log(`${emoji}  ${c.bold(label)}: ${msg}`);
}

// ─── Mongoose schemas (raw, no validation needed) ─────────────────────────────
const { Schema, model, models, connection } = mongoose;

const UserSchema = new Schema({}, { strict: false, timestamps: true });
const VehicleSchema = new Schema({}, { strict: false, timestamps: true });
const PartnerBankSchema = new Schema({}, { strict: false, timestamps: true });
const PartnerDocsSchema = new Schema({}, { strict: false, timestamps: true });
const BookingSchema = new Schema({}, { strict: false, timestamps: true });

const MongoUser = models.User || model("User", UserSchema);
const MongoVehicle = models.Vehicle || model("Vehicle", VehicleSchema);
const MongoPartnerBank = models.PartnerBank || model("PartnerBank", PartnerBankSchema);
const MongoPartnerDocs = models.PartnerDocs || model("PartnerDocs", PartnerDocsSchema);
const MongoBooking = models.Booking || model("Booking", BookingSchema);

// ─── ID map: MongoDB ObjectId → Prisma cuid ───────────────────────────────────
// We reuse the Mongo hex string as the Prisma id so cross-references stay valid.
function toId(objectId) {
  return objectId ? objectId.toString() : null;
}

// ─── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  console.log("\n" + c.bold(c.cyan("━━━ Rydex MongoDB → PostgreSQL Migration ━━━")) + "\n");

  // 1. Connect to MongoDB
  log("🔌", "MongoDB", "Connecting to Atlas...");
  await mongoose.connect(MONGODB_URL, { bufferCommands: false });
  log("✅", "MongoDB", c.green("Connected!"));

  // ─── USERS ──────────────────────────────────────────────────────────────────
  log("📦", "Users", "Fetching from MongoDB...");
  const mongoUsers = await MongoUser.find({}).lean();
  log("📦", "Users", `Found ${c.yellow(mongoUsers.length)} users`);

  let userCount = 0;
  for (const u of mongoUsers) {
    try {
      await prisma.user.upsert({
        where: { id: toId(u._id) },
        update: {},
        create: {
          id: toId(u._id),
          name: u.name || "Unknown",
          email: u.email,
          password: u.password ?? null,
          image: u.image ?? null,
          role: u.role ?? "user",
          isVerified: u.isVerified ?? false,
          otp: u.otp ?? null,
          otpExpiry: u.otpExpiry ?? null,
          vendorOnboardingStep: u.vendorOnboardingStep ?? 0,
          vendorStatus: u.vendorStatus ?? "pending",
          vendorRejectionReason: u.vendorRejectionReason ?? "",
          videoKycStatus: u.videoKycStatus ?? "not_required",
          videoKycRoomId: u.videoKycRoomId ?? null,
          videoKycRejectionReason: u.videoKycRejectionReason ?? null,
          createdAt: u.createdAt ?? new Date(),
          updatedAt: u.updatedAt ?? new Date(),
        },
      });
      userCount++;
    } catch (err) {
      log("⚠️ ", "User skip", `${u.email} — ${c.red(err.message)}`);
    }
  }
  log("✅", "Users", c.green(`Migrated ${userCount} / ${mongoUsers.length}`));

  // ─── VEHICLES ────────────────────────────────────────────────────────────────
  log("📦", "Vehicles", "Fetching from MongoDB...");
  const mongoVehicles = await MongoVehicle.find({}).lean();
  log("📦", "Vehicles", `Found ${c.yellow(mongoVehicles.length)} vehicles`);

  let vehicleCount = 0;
  for (const v of mongoVehicles) {
    try {
      await prisma.vehicle.upsert({
        where: { id: toId(v._id) },
        update: {},
        create: {
          id: toId(v._id),
          ownerId: toId(v.owner),
          type: v.type ?? "bike",
          vehicleModel: v.vehicleModel ?? v.model ?? "Unknown",
          number: v.number,
          imageUrl: v.imageUrl ?? null,
          baseFare: v.baseFare ?? 0,
          pricePerKM: v.pricePerKM ?? 0,
          waitingCharge: v.waitingCharge ?? 0,
          status: v.status ?? "pending",
          rejectionReason: v.rejectionReason ?? "",
          createdAt: v.createdAt ?? new Date(),
          updatedAt: v.updatedAt ?? new Date(),
        },
      });

      // Update the User's vehicleId to point to this vehicle
      await prisma.user.update({
        where: { id: toId(v.owner) },
        data: { vehicleId: toId(v._id) },
      }).catch(() => {}); // ignore if user not found

      vehicleCount++;
    } catch (err) {
      log("⚠️ ", "Vehicle skip", `${v.number} — ${c.red(err.message)}`);
    }
  }
  log("✅", "Vehicles", c.green(`Migrated ${vehicleCount} / ${mongoVehicles.length}`));

  // ─── PARTNER BANKS ───────────────────────────────────────────────────────────
  log("📦", "PartnerBanks", "Fetching from MongoDB...");
  const mongoBanks = await MongoPartnerBank.find({}).lean();
  log("📦", "PartnerBanks", `Found ${c.yellow(mongoBanks.length)} records`);

  let bankCount = 0;
  for (const b of mongoBanks) {
    try {
      await prisma.partnerBank.upsert({
        where: { id: toId(b._id) },
        update: {},
        create: {
          id: toId(b._id),
          ownerId: toId(b.owner),
          accountHolder: b.accountHolder,
          accountNumber: b.accountNumber,
          ifsc: b.ifsc,
          upi: b.upi ?? null,
          mobileNumber: b.mobileNumber,
          status: b.status ?? "not_added",
          createdAt: b.createdAt ?? new Date(),
          updatedAt: b.updatedAt ?? new Date(),
        },
      });
      bankCount++;
    } catch (err) {
      log("⚠️ ", "Bank skip", `${toId(b._id)} — ${c.red(err.message)}`);
    }
  }
  log("✅", "PartnerBanks", c.green(`Migrated ${bankCount} / ${mongoBanks.length}`));

  // ─── PARTNER DOCS ─────────────────────────────────────────────────────────────
  log("📦", "PartnerDocs", "Fetching from MongoDB...");
  const mongoDocs = await MongoPartnerDocs.find({}).lean();
  log("📦", "PartnerDocs", `Found ${c.yellow(mongoDocs.length)} records`);

  let docsCount = 0;
  for (const d of mongoDocs) {
    try {
      await prisma.partnerDocs.upsert({
        where: { id: toId(d._id) },
        update: {},
        create: {
          id: toId(d._id),
          ownerId: toId(d.owner),
          aadharUrl: d.aadharUrl,
          rcUrl: d.rcUrl,
          licenseUrl: d.licenseUrl,
          status: d.status ?? "pending",
          rejectionReason: d.rejectionReason ?? "",
          createdAt: d.createdAt ?? new Date(),
          updatedAt: d.updatedAt ?? new Date(),
        },
      });
      docsCount++;
    } catch (err) {
      log("⚠️ ", "Docs skip", `${toId(d._id)} — ${c.red(err.message)}`);
    }
  }
  log("✅", "PartnerDocs", c.green(`Migrated ${docsCount} / ${mongoDocs.length}`));

  // ─── BOOKINGS ────────────────────────────────────────────────────────────────
  log("📦", "Bookings", "Fetching from MongoDB...");
  const mongoBookings = await MongoBooking.find({}).lean();
  log("📦", "Bookings", `Found ${c.yellow(mongoBookings.length)} bookings`);

  let bookingCount = 0;
  for (const bk of mongoBookings) {
    try {
      await prisma.booking.upsert({
        where: { id: toId(bk._id) },
        update: {},
        create: {
          id: toId(bk._id),
          vendorId: toId(bk.vendorId),
          vehicleId: toId(bk.vehicleId),
          userId: toId(bk.userId),
          fare: bk.fare ?? 0,
          status: bk.status ?? "pending",
          pickupAt: bk.pickupAt ?? null,
          completedAt: bk.completedAt ?? null,
          createdAt: bk.createdAt ?? new Date(),
          updatedAt: bk.updatedAt ?? new Date(),
        },
      });
      bookingCount++;
    } catch (err) {
      log("⚠️ ", "Booking skip", `${toId(bk._id)} — ${c.red(err.message)}`);
    }
  }
  log("✅", "Bookings", c.green(`Migrated ${bookingCount} / ${mongoBookings.length}`));

  // ─── Done ─────────────────────────────────────────────────────────────────────
  console.log("\n" + c.bold(c.green("━━━ Migration Complete! ━━━")));
  console.log(`  Users:       ${userCount}`);
  console.log(`  Vehicles:    ${vehicleCount}`);
  console.log(`  BankDetails: ${bankCount}`);
  console.log(`  PartnerDocs: ${docsCount}`);
  console.log(`  Bookings:    ${bookingCount}`);
  console.log("\n" + c.cyan("Open pgAdmin and refresh your Rydex database to see the data!") + "\n");
}

main()
  .catch((err) => {
    console.error(c.red("\n❌ Migration failed:"), err);
    process.exit(1);
  })
  .finally(async () => {
    await mongoose.disconnect();
    await prisma.$disconnect();
  });
