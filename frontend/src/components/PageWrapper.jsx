import { motion } from "framer-motion";

const MotionDiv = motion.div;

export default function PageWrapper({ children, className = "" }) {
  return (
    <MotionDiv
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -16 }}
      transition={{ duration: 0.25, ease: "easeOut" }}
      className={className}
    >
      {children}
    </MotionDiv>
  );
}
