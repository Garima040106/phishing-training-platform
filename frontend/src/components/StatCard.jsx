import React from "react";
import { motion } from "framer-motion";

const MotionDiv = motion.div;

const StatCard = ({ title, children }) => {
  return (
    <MotionDiv whileHover={{ scale: 1.05 }} className="bg-white p-6 rounded-lg shadow-md">
      <h3 className="mb-2 text-lg font-medium text-gray-600">{title}</h3>
      {children}
    </MotionDiv>
  );
};

export default StatCard;
