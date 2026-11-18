
import Webcam from "@/components/Webcam";

export default function TestingPage() {
  return (
    <main className="min-h-screen bg-[#080d18] p-4 text-white md:p-6">
      <div className="mx-auto mb-5 max-w-6xl">
        <h1 className="text-2xl font-bold">Model Testing</h1>
        <p className="mt-1 text-sm text-slate-400">
          Test your trained model with live camera input.
        </p>
      </div>
      <Webcam mode="testing" />
    </main>
  );
}
