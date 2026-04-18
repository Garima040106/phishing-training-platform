import { motion } from "framer-motion";
import { Shield } from "lucide-react";

const MotionDiv = motion.div;

export default function LoadingScreen() {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#070811]">
      <div className="relative flex flex-col items-center gap-4">
        <MotionDiv
          animate={{ scale: [1, 1.24, 1], opacity: [0.55, 0.2, 0.55] }}
          transition={{ duration: 1.6, repeat: Number.POSITIVE_INFINITY, ease: "easeInOut" }}
          className="absolute h-24 w-24 rounded-full border-2 border-violet-400/55"
        />

        <MotionDiv
          animate={{ scale: [1, 1.12, 1] }}
          transition={{ duration: 1.35, repeat: Number.POSITIVE_INFINITY, ease: "easeInOut" }}
          className="relative inline-flex h-16 w-16 items-center justify-center rounded-full border border-violet-300/45 bg-violet-500/10 shadow-[0_0_32px_rgba(108,99,255,0.4)]"
        >
          <Shield className="h-8 w-8 text-violet-300" />
        </MotionDiv>

        <MotionDiv
          initial={{ opacity: 0.15 }}
          animate={{ opacity: [0.35, 1, 0.35] }}
          transition={{ duration: 1.8, repeat: Number.POSITIVE_INFINITY, ease: "easeInOut" }}
          className="text-base font-bold tracking-[0.2em] text-violet-200"
        >
          PhishGuard AI
        </MotionDiv>
      </div>
    </div>
  );
}
