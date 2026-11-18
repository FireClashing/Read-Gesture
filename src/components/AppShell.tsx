
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

const navigation = [
  {
    label: "Overview",
    href: "/",
    icon: "⌂",
  },
  {
    label: "Live Translator",
    href: "/translator",
    icon: "◎",
  },
  {
    label: "Training Studio",
    href: "/training",
    icon: "✳",
  },
  {
    label: "Model Testing",
    href: "/testing",
    icon: "◈",
  },
  {
    label: "Model Insights",
    href: "/insights",
    icon: "▥",
  },
];

export default function AppShell({
  children,
}: {
  children: ReactNode;
}) {
  const pathname = usePathname();

  return (
    <div className="flex min-h-screen bg-[#080d18] text-slate-100">
      {/* Sidebar */}
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 flex-col border-r border-slate-800 bg-[#0b1220] md:flex">
        {/* Brand */}
        <div className="flex h-20 items-center gap-3 border-b border-slate-800 px-6">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-600 text-xl font-bold text-white shadow-lg shadow-indigo-950/40">
            S
          </div>

          <div>
            <h1 className="text-lg font-bold tracking-tight text-white">
              signa<span className="text-indigo-400">.</span>
            </h1>
            <p className="text-xs text-slate-400">
              ISL gesture workspace
            </p>
          </div>
        </div>

        {/* Navigation */}
        <div className="flex-1 px-4 py-7">
          <p className="mb-4 px-3 text-[10px] font-bold uppercase tracking-[0.22em] text-slate-500">
            Workspace
          </p>

          <nav className="space-y-2">
            {navigation.map((item) => {
              const active =
                item.href === "/"
                  ? pathname === "/"
                  : pathname.startsWith(item.href);

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={`flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-semibold transition-colors ${
                    active
                      ? "border border-indigo-500/30 bg-indigo-500/15 text-indigo-300"
                      : "border border-transparent text-slate-400 hover:bg-slate-800 hover:text-white"
                  }`}
                >
                  <span className="flex h-6 w-6 items-center justify-center text-lg">
                    {item.icon}
                  </span>
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>
        </div>

        {/* Server status */}
        <div className="m-4 rounded-2xl border border-slate-800 bg-[#080d18] p-4">
          <div className="mb-3 flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-emerald-400" />
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              Local ML server
            </span>
          </div>

          <p className="text-sm font-semibold text-white">
            Your model runs locally.
          </p>

          <p className="mt-2 text-xs leading-5 text-slate-500">
            FastAPI · MediaPipe · Random Forest
          </p>

          <div className="mt-3 rounded-lg bg-slate-900 px-3 py-2">
            <p className="text-xs text-slate-400">
              API endpoint
            </p>
            <p className="mt-1 break-all font-mono text-[10px] text-indigo-300">
              localhost:8000
            </p>
          </div>
        </div>
      </aside>

      {/* Main area */}
      <div className="flex min-h-screen min-w-0 flex-1 flex-col md:ml-64">
        {/* Mobile header */}
        <header className="border-b border-slate-800 bg-[#0b1220] px-4 py-3 md:hidden">
          <div className="mb-3 flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-600 font-bold text-white">
              S
            </div>
            <div>
              <p className="font-bold text-white">
                signa<span className="text-indigo-400">.</span>
              </p>
              <p className="text-[10px] text-slate-500">
                ISL gesture workspace
              </p>
            </div>
          </div>

          <nav className="flex gap-2 overflow-x-auto pb-1">
            {navigation.map((item) => {
              const active =
                item.href === "/"
                  ? pathname === "/"
                  : pathname.startsWith(item.href);

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`shrink-0 rounded-lg px-3 py-2 text-xs font-semibold ${
                    active
                      ? "bg-indigo-500/20 text-indigo-300"
                      : "bg-slate-800 text-slate-400"
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </header>

        {/* Page content */}
        <main className="min-w-0 flex-1 bg-[#080d18]">
          {children}
        </main>
      </div>
    </div>
  );
}
