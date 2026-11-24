/** @param {{ on: (event: string, listener: () => void) => unknown, off: (event: string, listener: () => void) => unknown }} socket @param {() => void} refresh */
export function bindReconnectRefresh(socket, refresh) {
  socket.on("connect", refresh);
  return () => socket.off("connect", refresh);
}
