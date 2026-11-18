

import type { GestureMeaning } from "./types";

export const gestureDictionary: Record<string, GestureMeaning> = {
  HELLO: {
    id: "GREETING",
    category: "word",
    translations: {
      en: "Hello",
      hi: "नमस्ते",
    },
  },

  YES: {
    id: "AFFIRMATION",
    category: "word",
    translations: {
      en: "Yes",
      hi: "हाँ",
    },
  },

  NO: {
    id: "NEGATION",
    category: "word",
    translations: {
      en: "No",
      hi: "नहीं",
    },
  },

  HEART: {
    id: "LOVE",
    category: "symbolic",
    translations: {
      en: "Love",
      hi: "प्यार",
    },
  },
};

export function getGestureMeaning(label: string) {
  return gestureDictionary[label.toUpperCase()] ?? null;
}
