"use client";

import { useEffect } from "react";
import { useDispatch } from "react-redux";
import { useSession } from "next-auth/react";
import { AppDispatch } from "@/redux/store";
import { setUserData } from "@/redux/userSlice";
import axios from "axios";

/**
 * InitUser — renders nothing but fetches the current user profile
 * on mount (when session is authenticated) and populates Redux store.
 */
export default function InitUser() {
  const { data: session, status } = useSession();
  const dispatch = useDispatch<AppDispatch>();

  useEffect(() => {
    if (status !== "authenticated") return;

    let cancelled = false;

    const fetchUser = async () => {
      try {
        const res = await axios.get("/api/me");
        if (!cancelled) {
          dispatch(setUserData(res.data));
        }
      } catch (err) {
        console.error("InitUser: failed to fetch user", err);
      }
    };

    fetchUser();

    return () => {
      cancelled = true;
    };
  }, [status, session?.user?.id, dispatch]);

  return null;
}

