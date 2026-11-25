"use client";

import { useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { XClose as X } from "@untitledui/icons";
import { Sidebar } from "./Sidebar";

interface MobileNavProps {
  isOpen: boolean;
  onClose: () => void;
  isCollapsed: boolean;
  onToggle: () => void;
}

export function MobileNav({ isOpen, onClose, isCollapsed, onToggle }: MobileNavProps) {
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 z-40 md:hidden"
            onClick={onClose}
          />
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label="Navigation menu"
            initial={{ x: -300 }}
            animate={{ x: 0 }}
            exit={{ x: -300 }}
            transition={{ type: "spring", damping: 25, stiffness: 200 }}
            className="fixed inset-y-0 left-0 z-50 md:hidden"
          >
            <div className="relative h-full">
              <Sidebar isCollapsed={false} onToggle={onToggle} onNavigate={onClose} hideCollapseButton />
              <button
                type="button"
                onClick={onClose}
                aria-label="Close navigation menu"
                className="absolute top-4 right-4 w-8 h-8 rounded-full bg-white/20 flex items-center justify-center text-primary-foreground hover:bg-white/30 transition-standard"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
