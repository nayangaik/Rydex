import test from "node:test";
import assert from "node:assert/strict";
import { bindReconnectRefresh } from "../../rydex/src/lib/socketRecovery.js";

test("reconnect refresh runs after each connect and cleans up its own listener", () => {
  const handlers = new Map();
  const socket = {
    on(event, listener) { handlers.set(listener, event); },
    off(event, listener) { if (handlers.get(listener) === event) handlers.delete(listener); },
    connect() { for (const [listener, event] of handlers) if (event === "connect") listener(); },
  };
  let refreshed = 0;
  const refresh = () => { refreshed += 1; };
  const cleanup = bindReconnectRefresh(socket, refresh);
  assert.equal(handlers.get(refresh), "connect");
  socket.connect();
  socket.connect();
  assert.equal(refreshed, 2);
  cleanup();
  assert.equal(handlers.has(refresh), false);
});
