"use client";

import { getSocket } from "@/lib/socket";
import type { Socket } from "socket.io-client";
import React, { useEffect, useRef } from "react";

function GeoUpdater({ userId }: { userId: string | undefined }) {
  const socketRef = useRef<Socket | null>(null);
  const lastSentRef = useRef<number>(0);

  useEffect(() => {
    if (!userId) return;
    if (!navigator.geolocation) return;

    const socket = getSocket();
    socketRef.current = socket;

       
    const watcher = navigator.geolocation.watchPosition(
      (pos) => {
        const now = Date.now();

        // 🔥 Throttle: send only every 10 seconds
        if (now - lastSentRef.current < 10000) return;

        lastSentRef.current = now;

        socket.emit("update-location", {
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
        });
      },
      (err) => console.log(err),
      {
        enableHighAccuracy: true,
        maximumAge: 5000,
      }
    );

    return () => {
      navigator.geolocation.clearWatch(watcher);
    };
  }, [userId]);

  return null;
}

export default GeoUpdater;
