import { io, Socket } from "socket.io-client";

const SOCKET_SERVER = process.env.NEXT_PUBLIC_SOCKET_SERVER || "http://localhost:8000";

let socket: Socket | null = null;

export function getSocket(): Socket {
  if (!socket) {
    socket = io(SOCKET_SERVER, {
      transports: ["websocket"],
      autoConnect: true,
      auth: (callback) => {
        fetch("/api/socket-token", { cache: "no-store" })
          .then((response) => response.ok ? response.json() : Promise.reject(new Error("Socket authentication failed")))
          .then(({ token }) => callback({ token }))
          .catch(() => callback({ token: "" }));
      },
    });
  }
  return socket;
}

export function disconnectSocket() {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}
