
import Link from "next/link";

const modules = [
  {
    number: "01",
    icon: "◎",
    title: "Live Translator",
    description:
      "Recognize one-hand ISL gestures using your webcam in real time.",
    action: "Open translator",
    href: "/translator",
  },
  {
    number: "02",
    icon: "✳",
    title: "Training Studio",
    description:
      "Capture normalized hand landmarks and export your gesture dataset.",
    action: "Collect samples",
    href: "/training",
  },
  {
    number: "03",
    icon: "◈",
    title: "Model Testing",
    description:
      "Test your trained model with live camera input and inspect confidence.",
    action: "Test model",
    href: "/testing",
  },
  {
    number: "04",
    icon: "▥",
    title: "Model Insights",
    description:
      "Review dataset composition and your current model training snapshot.",
    action: "View insights",
    href: "/insights",
  },
];

const stats = [
  {
    value: "3",
    label: "One-hand gesture labels",
    detail: "HELLO · YES · NO",
  },
  {
    value: "63",
    label: "Landmark features",
    detail: "21 landmarks × 3 coordinates",
  },
  {
    value: "2",
    label: "Hands detected",
    detail: "Current model uses one hand",
  },
];

export default function Dashboard() {
  return (
    <div className="min-h-screen w-full bg-[#080d18] px-4 py-6 text-slate-100 sm:px-6 lg:px-8">
      <div className="mx-auto w-full max-w-7xl space-y-8">

        {/* Hero */}
        <section className="relative overflow-hidden rounded-3xl border border-indigo-500/20 bg-[#101a35] px-6 py-10 sm:px-10 sm:py-14">
          <div className="pointer-events-none absolute -right-20 -top-32 h-80 w-80 rounded-full bg-indigo-600/15 blur-3xl" />
          <div className="pointer-events-none absolute bottom-0 right-1/3 h-48 w-48 rounded-full bg-cyan-500/10 blur-3xl" />

          <div className="relative max-w-3xl">
            <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1.5">
              <span className="h-2 w-2 rounded-full bg-emerald-400" />
              <span className="text-xs font-semibold text-emerald-300">
                ISL GESTURE WORKSPACE
              </span>
            </div>

            <h1 className="text-4xl font-extrabold leading-tight tracking-tight text-white sm:text-5xl lg:text-6xl">
              Breaking barriers
              <br />
              through{" "}
              <span className="text-cyan-400">
                understanding.
              </span>
            </h1>

            <p className="mt-5 max-w-2xl text-sm leading-7 text-slate-300 sm:text-base">
              Explore live recognition, grow your gesture dataset, and
              evaluate your machine-learning model from a single workspace.
            </p>

            <Link
              href="/translator"
              className="mt-7 inline-flex items-center gap-3 rounded-xl bg-indigo-600 px-6 py-3 text-sm font-bold text-white shadow-lg shadow-indigo-950/40 transition-colors hover:bg-indigo-500"
            >
              Launch live translator
              <span>→</span>
            </Link>
          </div>
        </section>

        {/* Modules */}
        <section>
          <div className="mb-5 flex items-end justify-between">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.25em] text-indigo-400">
                Explore tools
              </p>
              <h2 className="mt-2 text-xl font-bold text-white sm:text-2xl">
                Your project modules
              </h2>
            </div>

            <span className="text-xs text-slate-500">
              4 modules
            </span>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {modules.map((item) => (
              <Link
                key={item.number}
                href={item.href}
                className="group relative flex min-h-[205px] flex-col rounded-2xl border border-slate-800 bg-[#101827] p-5 transition-all duration-200 hover:-translate-y-1 hover:border-indigo-500/50 hover:bg-[#141f33] sm:p-6"
              >
                <div className="flex items-center justify-between">
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-indigo-500/20 bg-indigo-500/10 text-xl text-indigo-400">
                    {item.icon}
                  </div>

                  <span className="text-xs font-semibold tracking-widest text-slate-600">
                    {item.number}
                  </span>
                </div>

                <h3 className="mt-5 text-lg font-bold text-white">
                  {item.title}
                </h3>

                <p className="mt-2 max-w-lg text-sm leading-6 text-slate-400">
                  {item.description}
                </p>

                <div className="mt-auto pt-5 text-sm font-semibold text-indigo-400 transition-colors group-hover:text-indigo-300">
                  {item.action} →
                </div>
              </Link>
            ))}
          </div>
        </section>

        {/* Stats */}
        <section>
          <div className="mb-4">
            <p className="text-[10px] font-bold uppercase tracking-[0.25em] text-indigo-400">
              Model overview
            </p>
            <h2 className="mt-2 text-xl font-bold text-white">
              Current system snapshot
            </h2>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            {stats.map((stat) => (
              <div
                key={stat.label}
                className="rounded-2xl border border-slate-800 bg-[#101827] p-5"
              >
                <p className="text-3xl font-extrabold text-white">
                  {stat.value}
                </p>

                <p className="mt-2 text-sm font-semibold text-slate-200">
                  {stat.label}
                </p>

                <p className="mt-2 text-xs text-slate-500">
                  {stat.detail}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* Footer */}
        <footer className="border-t border-slate-800 py-5">
          <p className="text-center text-xs text-slate-500">
            Signa · Indian Sign Language Gesture Recognition
          </p>
        </footer>

      </div>
    </div>
  );
}
