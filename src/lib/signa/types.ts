

export type SignaLanguage = "en" | "hi";

export type RecognitionCategory =
  | "alphabet"
  | "word"
  | "symbolic";

export type GestureMeaning = {
  id: string;
  category: RecognitionCategory;
  translations: Record<SignaLanguage, string>;
};

export type SubtitleEntry = {
  id: string;
  text: string;
  language: SignaLanguage;
  createdAt: number;
};
