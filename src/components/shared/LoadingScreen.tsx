// ============================================================
// Loading Screen Component
// ============================================================

import { motion } from 'motion/react';
import { Bus } from 'lucide-react';

export function LoadingScreen() {
  return (
    <div className="fixed inset-0 bg-surface-50 dark:bg-surface-950 flex flex-col items-center justify-center z-50">
      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.5, type: 'spring' }}
        className="flex flex-col items-center gap-4"
      >
        <motion.div
          animate={{
            y: [0, -8, 0],
          }}
          transition={{
            duration: 1.5,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
          className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary-500 to-primary-700 flex items-center justify-center shadow-glow"
        >
          <Bus className="w-8 h-8 text-white" />
        </motion.div>
        <div className="text-center">
          <h2 className="text-lg font-bold text-surface-800 dark:text-surface-200 font-[family-name:var(--font-display)]">
            TRACER
          </h2>
          <p className="text-sm text-surface-500 dark:text-surface-400 mt-1">
            Memuat...
          </p>
        </div>
        <div className="flex gap-1.5 mt-2">
          {[0, 1, 2].map((i) => (
            <motion.div
              key={i}
              className="w-2 h-2 rounded-full bg-primary-500"
              animate={{ opacity: [0.3, 1, 0.3] }}
              transition={{
                duration: 1,
                repeat: Infinity,
                delay: i * 0.2,
              }}
            />
          ))}
        </div>
      </motion.div>
    </div>
  );
}
