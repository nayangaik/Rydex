import type { Socket } from "socket.io-client";

export function bindReconnectRefresh(socket: Socket, refresh: () => void): () => void;
