
import Webcam from "@/components/Webcam";

export default function TrainingPage() {
  return (
    <main className="min-h-screen bg-[#080d18] p-4 text-white md:p-6">
      <div className="mx-auto mb-5 max-w-6xl">
        <h1 className="text-2xl font-bold">Training Studio</h1>
        <p className="mt-1 text-sm text-slate-400">
          Collect and manage your gesture samples.
        </p>
      </div>
      <Webcam mode="training" />
    </main>
  );
}
