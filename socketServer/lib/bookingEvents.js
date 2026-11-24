import crypto from "node:crypto";

const allowedEvents = new Set(["new-booking", "booking-updated", "payment-updated", "ride-started", "ride-completed"]);
const validId = (value) => typeof value === "string" && /^[A-Za-z0-9_-]{1,128}$/.test(value);
const validPayload = (value) => value && typeof value === "object" && !Array.isArray(value) && JSON.stringify(value).length <= 200_000;
const safeEqual = (a, b) => { const aa = Buffer.from(a || ""); const bb = Buffer.from(b || ""); return aa.length === bb.length && crypto.timingSafeEqual(aa, bb); };

export function validateBookingEvent(body, token, configuredToken) {
  if (!configuredToken || !safeEqual(token, configuredToken)) return { status: 401, error: "Unauthorized internal service request" };
  if (!body || typeof body !== "object" || Array.isArray(body)) return { status: 400, error: "JSON object required" };
  const { bookingId, event, payload, recipients } = body;
  if (!validId(bookingId)) return { status: 400, error: "Valid bookingId is required" };
  if (!allowedEvents.has(event)) return { status: 400, error: "Unsupported booking event" };
  if (!Array.isArray(recipients) || recipients.length !== 2 || recipients.some((id) => !validId(id)) || new Set(recipients).size !== 2) return { status: 400, error: "Exactly two distinct valid recipient IDs are required" };
  if (!validPayload(payload) || payload.bookingId !== bookingId) return { status: 400, error: "Payload must be an object for this booking" };
  return { status: 200, value: { bookingId, event, payload, recipients } };
}

export function bookingEventRooms({ bookingId, recipients }) {
  return [...recipients.map((id) => `user-${id}`), `booking-${bookingId}`];
}

export { safeEqual, validId };
