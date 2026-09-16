'use client';

import { motion } from 'framer-motion';
import { type ReactNode } from 'react';

/** Subtle page transition; disabled automatically for reduced-motion users. */
export default function DashboardTemplate({ children }: { children: ReactNode }) {
  return (
    <motion.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.18, ease: [0.2, 0, 0, 1] }}>
      {children}
    </motion.div>
  );
}
