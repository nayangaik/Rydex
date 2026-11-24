import test from "node:test";
import assert from "node:assert/strict";
import { validateBookingEvent, bookingEventRooms } from "../lib/bookingEvents.js";

const body = { bookingId: "booking_1", event: "booking-updated", recipients: ["user_1", "vendor_1"], payload: { bookingId: "booking_1", status: "confirmed" } };
test("accepts authenticated, recipient-scoped booking events", () => {
  assert.equal(validateBookingEvent(body, "secret", "secret").status, 200);
});
test("targets only the listed participants and the authorized booking room", () => {
  assert.deepEqual(bookingEventRooms(body), ["user-user_1", "user-vendor_1", "booking-booking_1"]);
});
test("rejects missing and incorrect internal tokens", () => {
  assert.equal(validateBookingEvent(body, "", "secret").status, 401);
  assert.equal(validateBookingEvent(body, "wrong", "secret").status, 401);
});
test("rejects invalid IDs, events, recipient targeting, and payloads", () => {
  for (const input of [
    { ...body, bookingId: "bad id" }, { ...body, event: "broadcast-everywhere" },
    { ...body, recipients: ["user_1"] }, { ...body, recipients: ["user_1", "user_1"] },
    { ...body, payload: { bookingId: "other" } }, { ...body, payload: [] },
  ]) assert.equal(validateBookingEvent(input, "secret", "secret").status, 400);
});
