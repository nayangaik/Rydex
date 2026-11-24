import { setDefaultResultOrder } from "node:dns";
setDefaultResultOrder("ipv4first");
import express from "express";
import http from "node:http";
import dotenv from "dotenv";
import { Server } from "socket.io";
import crypto from "node:crypto";
import mongoose from "mongoose";
import User from "./models/user.models.js";
import { validateBookingEvent, bookingEventRooms, safeEqual, validId } from "./lib/bookingEvents.js";

dotenv.config();
const app = express();
const server = http.createServer(app);
const port = process.env.PORT || 5000;
app.use(express.json({ limit: "256kb" }));
function verifyClientToken(token) {
  const [body, sig, extra] = String(token || "").split(".");
  if (!body || !sig || extra || !process.env.SOCKET_AUTH_SECRET) return null;
  const expected = crypto.createHmac("sha256", process.env.SOCKET_AUTH_SECRET).update(body).digest("base64url");
  if (!safeEqual(sig, expected)) return null;
  try { const claims = JSON.parse(Buffer.from(body, "base64url").toString()); return claims.exp > Date.now() && validId(claims.sub) && typeof claims.role === "string" ? claims : null; } catch { return null; }
}
const io = new Server(server, { cors: { origin: [process.env.NEXT_BASE_URL, "http://localhost:3000", "http://localhost:3001"].filter(Boolean), methods: ["GET", "POST"], credentials: true } });
let dbConnected = false;
mongoose.connect(process.env.MONGODB_URL, { serverSelectionTimeoutMS: 10000, socketTimeoutMS: 45000 }).then(() => { dbConnected = true; console.log("MongoDB connected"); }).catch((err) => console.warn("MongoDB connection failed:", err.message));
const safeDb = async (fn) => { if (dbConnected) try { await fn(); } catch (e) { console.error("DB op failed:", e.message); } };
app.get("/health", (_req, res) => res.json({ status: "ok", db: dbConnected ? "connected" : "disconnected" }));
app.post("/booking-event", (req, res) => {
  const checked = validateBookingEvent(req.body, req.get("x-internal-service-token"), process.env.INTERNAL_SERVICE_TOKEN);
  if (checked.status !== 200) return res.status(checked.status).json({ success: false, message: checked.error });
  const { bookingId, event, payload, recipients } = checked.value;
  const rooms = bookingEventRooms({ bookingId, recipients });
  io.to(rooms[0]).to(rooms[1]).to(rooms[2]).emit(event, payload);
  return res.json({ success: true });
});
app.post("/kyc-end-call", (req, res) => {
  if (!process.env.INTERNAL_SERVICE_TOKEN || !safeEqual(req.get("x-internal-service-token"), process.env.INTERNAL_SERVICE_TOKEN)) return res.status(401).json({ success: false, message: "Unauthorized" });
  const { roomId, action } = req.body || {};
  if (!validId(roomId) || !["end", "cancel"].includes(action)) return res.status(400).json({ success: false, message: "Valid roomId and action are required" });
  io.to(`kyc-${roomId}`).emit("kyc-call-ended", { action });
  return res.json({ success: true });
});
async function isBookingMember(bookingId, userId) {
  if (!process.env.BOOKING_SERVICE_URL || !process.env.INTERNAL_SERVICE_TOKEN) return false;
  try {
    const response = await fetch(new URL(`/internal/booking/${encodeURIComponent(bookingId)}/members/${encodeURIComponent(userId)}`, process.env.BOOKING_SERVICE_URL), { headers: { "x-internal-service-token": process.env.INTERNAL_SERVICE_TOKEN }, signal: AbortSignal.timeout(2500) });
    return response.ok && (await response.json()).allowed === true;
  } catch { return false; }
}
io.use((socket, next) => { const identity = verifyClientToken(socket.handshake.auth?.token); if (!identity) return next(new Error("Unauthorized")); socket.data.identity = identity; next(); });
io.on("connection", (socket) => {
  const { sub: userId } = socket.data.identity;
  socket.join(`user-${userId}`);
  safeDb(() => User.findByIdAndUpdate(userId, { socketId: socket.id, isOnline: true }));
  socket.on("join-booking", async (bookingId, ack = () => {}) => {
    if (!validId(bookingId) || !(await isBookingMember(bookingId, userId))) return ack({ ok: false, error: "Booking access denied" });
    socket.join(`booking-${bookingId}`); ack({ ok: true });
  });
  socket.on("driver-location-update", async (data, ack = () => {}) => {
    if (!data || !validId(data.bookingId) || !Number.isFinite(data.latitude) || !Number.isFinite(data.longitude) || Math.abs(data.latitude) > 90 || Math.abs(data.longitude) > 180) return ack({ ok: false, error: "Invalid location payload" });
    if (!socket.rooms.has(`booking-${data.bookingId}`) || !(await isBookingMember(data.bookingId, userId))) return ack({ ok: false, error: "Booking access denied" });
    const bookingService = process.env.BOOKING_SERVICE_URL;
    if (!bookingService || !process.env.INTERNAL_SERVICE_TOKEN) return ack({ ok: false, error: "Location authorization unavailable" });
    try {
      const response = await fetch(new URL(`/internal/booking/${encodeURIComponent(data.bookingId)}/location`, bookingService), { method: "POST", headers: { "content-type": "application/json", "x-internal-service-token": process.env.INTERNAL_SERVICE_TOKEN, "x-user-id": userId }, body: JSON.stringify({ latitude: data.latitude, longitude: data.longitude }), signal: AbortSignal.timeout(2500) });
      if (!response.ok) return ack({ ok: false, error: "Location update denied" });
      socket.to(`booking-${data.bookingId}`).emit("driver-location", { bookingId: data.bookingId, latitude: data.latitude, longitude: data.longitude }); ack({ ok: true });
    } catch { ack({ ok: false, error: "Location update failed" }); }
  });
  socket.on("chat-message", async (msg, ack = () => {}) => {
    if (!msg || !validId(msg.rideId) || typeof msg.text !== "string" || !msg.text.trim() || msg.text.length > 2000) return ack({ ok: false, error: "Invalid chat payload" });
    if (!socket.rooms.has(`booking-${msg.rideId}`) || !(await isBookingMember(msg.rideId, userId))) return ack({ ok: false, error: "Booking access denied" });
    const identity = socket.data.identity;
    const sender = identity.role === "user" ? "user" : ["vendor", "partner"].includes(identity.role) ? "driver" : null;
    if (!sender || msg.sender !== sender) return ack({ ok: false, error: "Chat sender is not authorized" });
    io.to(`booking-${msg.rideId}`).emit("chat-message", { id: validId(msg.id) ? msg.id : crypto.randomUUID(), rideId: msg.rideId, text: msg.text.trim(), sender, createdAt: msg.createdAt || new Date().toISOString(), status: "sent" });
    ack({ ok: true });
  });
  socket.on("join-kyc-room", async (roomId, ack = () => {}) => {
    if (!validId(roomId)) return ack({ ok: false, error: "Invalid roomId" });
    try {
      const vendor = await User.findOne({ videoKycRoomId: roomId }, { _id: 1 });
      if (!vendor || (socket.data.identity.role !== "admin" && String(vendor._id) !== userId)) return ack({ ok: false, error: "KYC room access denied" });
      socket.join(`kyc-${roomId}`); ack({ ok: true });
    } catch { ack({ ok: false, error: "KYC authorization failed" }); }
  });
  socket.on("kyc-end-call", (_data, ack = () => {}) => ack({ ok: false, error: "KYC call control requires an internal service request" }));
  socket.on("update-location", async (data, ack = () => {}) => {
    const { latitude, longitude } = data || {};
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || Math.abs(latitude) > 90 || Math.abs(longitude) > 180) return ack({ ok: false, error: "Invalid coordinates" });
    await safeDb(() => User.findByIdAndUpdate(userId, { location: { type: "Point", coordinates: [longitude, latitude] }, lastLocationUpdate: new Date() })); ack({ ok: true });
  });
  socket.on("disconnect", () => safeDb(() => User.findOneAndUpdate({ _id: userId, socketId: socket.id }, { isOnline: false, socketId: null })));
});
server.listen(port, () => console.log(`Socket server running on port ${port}`));
