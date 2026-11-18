

import AppShell from "@/components/AppShell";

const metrics = [
  ["110", "Total samples", "Current CSV dataset"],
  ["63", "Input features", "21 landmarks × x, y, z"],
  ["3", "Gesture classes", "HELLO · YES · NO"],
  ["100%", "Reported holdout accuracy", "28 / 28 test examples"],
];

const distribution = [
  { name: "HELLO", count: 40, width: "100%" },
  { name: "YES", count: 40, width: "100%" },
  { name: "NO", count: 30, width: "75%" },
];

export default function InsightsPage() {
  return (
    <AppShell
      eyebrow="Analytics"
      title="Model Insights"
      description="A snapshot of the dataset and training run currently documented for this project."
    >
      {/* Metrics */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {metrics.map(([value, label, note]) => (
          <div
            key={label}
            className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
          >
            <p className="text-3xl font-extrabold tracking-tight text-indigo-600">
              {value}
            </p>

            <p className="mt-2 text-sm font-bold">
              {label}
            </p>

            <p className="mt-1 text-xs text-slate-500">
              {note}
            </p>
          </div>
        ))}
      </div>

      <div className="mt-6 grid gap-5 lg:grid-cols-2">

        {/* Dataset distribution */}
        <section className="rounded-2xl border border-slate-200 bg-white p-6">
          <h2 className="text-lg font-extrabold">
            Dataset distribution
          </h2>

          <p className="mt-1 text-sm text-slate-500">
            Samples per gesture label
          </p>

          <div className="mt-6 space-y-5">
            {distribution.map((item) => (
              <div key={item.name}>
                <div className="mb-2 flex justify-between text-sm">
                  <span className="font-semibold">
                    {item.name}
                  </span>

                  <span className="font-bold text-slate-500">
                    {item.count}
                  </span>
                </div>

                <div className="h-3 overflow-hidden rounded-full bg-slate-100">
                  <div
                    className="h-full rounded-full bg-indigo-500"
                    style={{ width: item.width }}
                  />
                </div>
              </div>
            ))}
          </div>

          <p className="mt-6 text-xs text-slate-400">
            Total: 110 samples. Distribution is not perfectly balanced.
          </p>
        </section>

        {/* Training snapshot */}
        <section className="rounded-2xl border border-slate-200 bg-white p-6">
          <h2 className="text-lg font-extrabold">
            Training snapshot
          </h2>

          <p className="mt-1 text-sm text-slate-500">
            Previously reported Random Forest evaluation
          </p>

          <div className="mt-6 rounded-xl bg-emerald-50 p-5">
            <p className="text-3xl font-extrabold text-emerald-700">
              28 / 28
            </p>

            <p className="mt-1 text-sm font-semibold text-emerald-800">
              Correct predictions in random test split
            </p>
          </div>

          <div className="mt-5 space-y-3 text-sm leading-6 text-slate-600">
            <p>• HELLO: 40 samples</p>
            <p>• YES: 40 samples</p>
            <p>• NO: 30 samples</p>
            <p>• Feature vector: 63 normalized coordinates</p>
          </div>
        </section>
      </div>

      {/* Important note */}
      <div className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 p-5">
        <h2 className="font-extrabold text-amber-950">
          Important evaluation limitation
        </h2>

        <p className="mt-2 text-sm leading-6 text-amber-900">
          The reported 100% result came from a small random holdout
          split. Similar frames from the same capture session can appear
          in both training and test sets, making the score optimistic.
          For a credible evaluation, collect multiple sessions and
          people, then hold out complete sessions or people from training.
        </p>
      </div>
    </AppShell>
  );
}
