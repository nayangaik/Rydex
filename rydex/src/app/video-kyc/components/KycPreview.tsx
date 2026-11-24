import { Video, VideoOff, Mic, MicOff, Loader2 } from "lucide-react";
import { RefObject } from "react";

interface KycPreviewProps {
  previewRef: RefObject<HTMLVideoElement | null>;
  cameraOn: boolean;
  micOn: boolean;
  loading: boolean;
  onToggleCamera: () => void;
  onToggleMic: () => void;
  onJoinCall: () => void;
}

export function KycPreview({
  previewRef,
  cameraOn,
  micOn,
  loading,
  onToggleCamera,
  onToggleMic,
  onJoinCall,
}: KycPreviewProps) {
  return (
    <div className="h-full flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-6xl grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
        <div className="relative rounded-2xl overflow-hidden border border-white/10 bg-white/5">
          <video
            ref={previewRef as any}
            autoPlay
            muted
            playsInline
            className="w-full h-[300px] sm:h-[400px] object-cover"
          />

          {!cameraOn && (
            <div className="absolute inset-0 bg-black flex items-center justify-center">
              <VideoOff size={40} />
            </div>
          )}
        </div>

        <div className="space-y-8 text-center lg:text-left">
          <h1 className="text-3xl sm:text-4xl font-bold">Secure Video KYC</h1>

          <div className="flex justify-center lg:justify-start gap-6">
            <button
              onClick={onToggleCamera}
              className={`w-14 h-14 rounded-full flex items-center justify-center transition ${
                cameraOn
                  ? "bg-white text-black"
                  : "bg-white/10 border border-white/20"
              }`}
            >
              {cameraOn ? <Video /> : <VideoOff />}
            </button>

            <button
              onClick={onToggleMic}
              className={`w-14 h-14 rounded-full flex items-center justify-center transition ${
                micOn
                  ? "bg-white text-black"
                  : "bg-white/10 border border-white/20"
              }`}
            >
              {micOn ? <Mic /> : <MicOff />}
            </button>
          </div>

          <button
            onClick={onJoinCall}
            disabled={loading}
            className="w-full bg-white text-black py-4 rounded-xl font-semibold"
          >
            {loading ? (
              <span className="flex justify-center items-center gap-2">
                <Loader2 className="animate-spin" size={18} />
                Connecting...
              </span>
            ) : (
              "Join Secure Call"
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
