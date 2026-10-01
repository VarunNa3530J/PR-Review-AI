import Link from "next/link";
import { Sparkles, ArrowRight, CheckCircle2, Lock, Zap } from "lucide-react";

export default function Home() {
  return (
    <div className="min-h-screen bg-[#090A0F] text-[#F5F5F7] flex flex-col justify-between selection:bg-white/20">
      {/* Top Navbar */}
      <header className="border-b border-white/[0.08] bg-[#0E1018]/80 backdrop-blur-xl px-6 py-4 flex items-center justify-between sticky top-0 z-50">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-white text-black flex items-center justify-center font-bold shadow-sm">
            <Sparkles className="w-3.5 h-3.5 fill-black" />
          </div>
          <span className="font-semibold text-sm tracking-tight text-white">PR Review AI</span>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/app"
            className="px-3.5 py-1.5 bg-white text-[#090A0F] rounded-lg text-xs font-semibold hover:bg-zinc-200 apple-press shadow-sm flex items-center gap-1.5"
          >
            Open Studio
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      </header>

      {/* Hero Section */}
      <main className="max-w-4xl mx-auto px-6 py-20 text-center flex-1 flex flex-col items-center justify-center">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/[0.06] border border-white/[0.08] text-[#86868B] text-xs font-mono mb-8">
          <Zap className="w-3 h-3 text-white" />
          Powered by Gemini 3.8 Flash & Apple Design
        </div>

        <h1 className="text-3xl sm:text-5xl font-bold tracking-tight text-white max-w-2xl leading-tight mb-5">
          Automated Code Review for GitHub Pull Requests
        </h1>

        <p className="text-sm sm:text-base text-[#86868B] max-w-xl mb-10 leading-relaxed">
          Open a pull request. In under 60 seconds, PR Review AI scans secrets, runs static security checks, and posts verified 1-click fixes directly on affected lines.
        </p>

        <div className="flex flex-col sm:flex-row items-center gap-3 mb-16">
          <Link
            href="/app"
            className="px-5 py-2.5 bg-white text-[#090A0F] rounded-xl font-semibold text-xs apple-press hover:bg-zinc-200 shadow-sm flex items-center gap-2"
          >
            Launch Review Studio
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
          <a
            href="https://github.com/apps/pr-review-ai-dev/installations/new"
            target="_blank"
            rel="noreferrer"
            className="px-5 py-2.5 bg-white/[0.04] border border-white/[0.08] text-white rounded-xl font-semibold text-xs apple-press hover:bg-white/[0.08]"
          >
            Install GitHub App
          </a>
        </div>

        {/* Feature Highlights Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-left w-full mt-4">
          <div className="apple-card p-5 rounded-2xl">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-400 flex items-center justify-center mb-3">
              <CheckCircle2 className="w-4 h-4" />
            </div>
            <h3 className="font-semibold text-sm text-white mb-1.5">Zero Hallucinations</h3>
            <p className="text-xs text-[#86868B] leading-relaxed">
              Every AI finding is mapped against real git diff lines. Stale or hallucinated lines are purged before posting.
            </p>
          </div>

          <div className="apple-card p-5 rounded-2xl">
            <div className="w-8 h-8 rounded-lg bg-rose-500/10 text-rose-400 flex items-center justify-center mb-3">
              <Lock className="w-4 h-4" />
            </div>
            <h3 className="font-semibold text-sm text-white mb-1.5">Private & In-Memory</h3>
            <p className="text-xs text-[#86868B] leading-relaxed">
              Customer source code is processed strictly in-memory. Detected secrets are masked and stripped from AI prompts.
            </p>
          </div>

          <div className="apple-card p-5 rounded-2xl">
            <div className="w-8 h-8 rounded-lg bg-blue-500/10 text-blue-400 flex items-center justify-center mb-3">
              <Zap className="w-4 h-4" />
            </div>
            <h3 className="font-semibold text-sm text-white mb-1.5">One-Click Fixes</h3>
            <p className="text-xs text-[#86868B] leading-relaxed">
              Proposes clean patches formatted in native GitHub suggestion markdown blocks for instant commit.
            </p>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-white/[0.06] py-5 px-6 text-center text-xs text-[#86868B]">
        PR Review AI &copy; 2026. Built with FastAPI, Celery, Google Gemini & Next.js.
      </footer>
    </div>
  );
}
