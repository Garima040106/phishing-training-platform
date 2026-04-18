import { motion } from "framer-motion";

const MotionDiv = motion.div;

export default function GlowCard({ children, className = "", ...props }) {
  return (
    <MotionDiv
      whileHover={{
        scale: 1.015,
        boxShadow: "0 0 0 1px rgba(108,99,255,0.55), 0 0 30px rgba(108,99,255,0.26), 0 10px 34px rgba(0,0,0,0.45)",
      }}
      transition={{ type: "spring", stiffness: 240, damping: 20 }}
      className={`rounded-xl border border-white/10 bg-surface/95 shadow-card backdrop-blur-sm ${className}`}
      {...props}
    >
      {children}
    </MotionDiv>
  );
}