import Webcam from "@/components/Webcam";

export default function TranslatorPage() {
  return (
    <main className="min-h-screen bg-[#080d18] p-4 text-white md:p-6">
      <div className="mx-auto mb-5 max-w-6xl">
        <h1 className="text-2xl font-bold">Live Translator</h1>
        <p className="mt-1 text-sm text-slate-400">
          Translate your hand gestures into text in real time.
        </p>
      </div>
      <Webcam mode="translator" />
    </main>
  );
}
