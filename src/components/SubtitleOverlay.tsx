

"use client";

import { useEffect, useState } from "react";
import type { SignaLanguage } from "@/lib/signa/types";

type Props = {
  text: string;
  language: SignaLanguage;
  inactivityMs?: number;
};

export default function SubtitleOverlay({
  text,
  language,
  inactivityMs = 4000,
}: Props) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!text.trim()) {
      setVisible(false);
      return;
    }

    setVisible(true);

    const hideTimer = window.setTimeout(() => {
      setVisible(false);
    }, inactivityMs);

    return () => window.clearTimeout(hideTimer);
  }, [text, inactivityMs]);

  return (
    <div
      aria-live="polite"
      className={`pointer-events-none fixed bottom-8 left-1/2 z-50 w-[90%] max-w-3xl -translate-x-1/2 transition-opacity duration-500 ${
        visible ? "opacity-100" : "opacity-0"
      }`}
    >
      <div className="rounded-2xl border border-white/10 bg-[#080d18]/95 px-6 py-4 text-center shadow-2xl backdrop-blur">
        <p className="mb-1 text-xs font-semibold uppercase tracking-widest text-cyan-400">
          {language === "en" ? "Live subtitle" : "लाइव उपशीर्षक"}
        </p>

        <p
          className="text-xl font-bold leading-relaxed text-white sm:text-2xl"
          lang={language === "en" ? "en-IN" : "hi-IN"}
        >
          {text}
        </p>
      </div>
    </div>
  );
}
