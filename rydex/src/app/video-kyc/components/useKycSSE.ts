import { useEffect } from "react";
import { useRouter } from "next/navigation";

export function useKycSSE(roomId: string | null, isAdmin: boolean) {
  const router = useRouter();

  useEffect(() => {
    // Admins don't need SSE; they are the ones driving the state change
    if (!roomId || isAdmin) return;

    const eventSource = new EventSource("/api/vendor/kyc-stream");

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);

        if (data.videoKycStatus === "approved") {
          eventSource.close();
          router.push("/partner?kyc=approved");
        } else if (data.videoKycStatus === "rejected") {
          eventSource.close();
          router.push("/partner?kyc=rejected");
        }
      } catch {
        // Ignore malformed JSON
      }
    };

    eventSource.onerror = () => {
      eventSource.close();
    };

    return () => eventSource.close();
  }, [roomId, isAdmin, router]);
}
