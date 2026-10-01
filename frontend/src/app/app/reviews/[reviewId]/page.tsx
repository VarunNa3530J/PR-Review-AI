"use client";

import React, { use, useState, useEffect } from "react";
import Link from "next/link";
import { AppShell } from "@/components/layout/AppShell";
import {
  ArrowLeft,
  ExternalLink,
  ShieldAlert,
  CheckCircle2,
  ThumbsUp,
  ThumbsDown,
  EyeOff,
  GitCommit,
  Clock,
  FileText,
  RefreshCw,
} from "lucide-react";

interface Finding {
  id: string;
  severity: "critical" | "high" | "medium" | "low" | "info";
  title: string;
  file_path: string;
  line_start: number;
  line_end: number;
  explanation: string;
  suggested_patch?: string | null;
  source: string;
}

interface ReviewDetailPageProps {
  params: Promise<{ reviewId: string }>;
}

export default function ReviewDetailPage({ params }: ReviewDetailPageProps) {
  const resolvedParams = use(params);
  const reviewId = resolvedParams.reviewId;

  const [review, setReview] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadReview() {
      try {
        const res = await fetch(`http://localhost:8000/api/v1/dashboard/reviews/${reviewId}`, {
          credentials: "include",
        });
        if (res.ok) {
          const data = await res.json();
          setReview(data);
        }
      } catch {
        // Handled
      } finally {
        setLoading(false);
      }
    }
    loadReview();
  }, [reviewId]);

  const findings: Finding[] = review?.findings || [];

  return (
    <AppShell>
      <div className="space-y-8 animate-in fade-in duration-300">
        {/* Top Breadcrumb & Actions */}
        <div className="flex items-center justify-between">
          <Link
            href="/app"
            className="flex items-center gap-2 text-xs font-semibold text-[var(--text-muted)] hover:text-[var(--text)] transition-colors apple-btn-spring"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Overview
          </Link>

          <a
            href="https://github.com"
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-[var(--border)] text-xs font-semibold hover:border-[#26D67C]/40 apple-btn-spring"
          >
            Open on GitHub <ExternalLink className="w-3.5 h-3.5" />
          </a>
        </div>

        {/* PR Review Summary Header */}
        <div className="liquid-glass-card p-6 sm:p-8 rounded-2xl border border-[var(--border)] space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2.5 mb-1.5">
                <span className="text-xs font-mono font-bold text-[var(--text-muted)]">
                  Run #{review?.pr_number || 1}
                </span>
                <span className={`text-xs px-2.5 py-0.5 rounded-full font-bold uppercase ${
                  (review?.risk_level || "low") === "critical" || (review?.risk_level || "low") === "high"
                    ? "bg-rose-500/10 text-rose-500 border border-rose-500/20"
                    : "bg-emerald-500/10 text-emerald-500 border border-emerald-500/20"
                }`}>
                  {review?.risk_level || "HEALTHY"}
                </span>
                <span className="text-xs text-[var(--text-muted)]">{review?.repo || "Workspace"}</span>
              </div>
              <h1 className="text-xl sm:text-2xl font-black tracking-tight text-white">
                {review?.title || "Security & Code Audit"}
              </h1>
            </div>

            <div className="flex items-center gap-4 text-xs text-[var(--text-muted)]">
              <span className="flex items-center gap-1">
                <Clock className="w-4 h-4" /> {((review?.duration_ms || 1000) / 1000).toFixed(1)}s review duration
              </span>
              <span className="flex items-center gap-1">
                <FileText className="w-4 h-4" /> {review?.files_reviewed || review?.files?.length || 0} files scanned
              </span>
            </div>
          </div>

          <p className="text-sm text-[var(--text-muted)] leading-relaxed pt-2 border-t border-[var(--border)]">
            Review findings are verified in real time against AST parsing rules and static security engines.
          </p>
        </div>

        {/* Findings List */}
        <div className="space-y-6">
          <h2 className="text-lg font-bold tracking-tight text-white">Detailed Code Findings ({findings.length})</h2>

          {findings.map((f) => (
            <div
              key={f.id}
              className="liquid-glass-card p-6 rounded-2xl border border-[var(--border)] space-y-4"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span
                      className={`text-[11px] font-bold px-2 py-0.5 rounded uppercase ${
                        f.severity === "critical"
                          ? "bg-rose-500/15 text-rose-600"
                          : "bg-orange-500/15 text-orange-600"
                      }`}
                    >
                      {f.severity}
                    </span>
                    <span className="text-xs font-mono text-[var(--text-muted)]">
                      {f.file_path}:{f.line_start}
                    </span>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-black/5 dark:bg-white/5 text-[var(--text-muted)]">
                      source: {f.source}
                    </span>
                  </div>
                  <h3 className="font-bold text-base tracking-tight">{f.title}</h3>
                </div>

                {/* Feedback Buttons per 01-prd.md F14 */}
                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    title="Mark Helpful"
                    className="p-2 rounded-xl text-[var(--text-muted)] hover:text-[#26D67C] hover:bg-[#26D67C]/10 transition-colors apple-btn-spring"
                  >
                    <ThumbsUp className="w-4 h-4" />
                  </button>
                  <button
                    title="Mark Not Helpful"
                    className="p-2 rounded-xl text-[var(--text-muted)] hover:text-rose-500 hover:bg-rose-500/10 transition-colors apple-btn-spring"
                  >
                    <ThumbsDown className="w-4 h-4" />
                  </button>
                  <button
                    title="Ignore this kind in this repo"
                    className="p-2 rounded-xl text-[var(--text-muted)] hover:text-amber-500 hover:bg-amber-500/10 transition-colors apple-btn-spring"
                  >
                    <EyeOff className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <p className="text-xs sm:text-sm text-[var(--text-muted)] leading-relaxed">
                {f.explanation}
              </p>

              {/* One-click suggested change patch */}
              {f.suggested_patch && (
                <div className="space-y-1.5">
                  <span className="text-xs font-semibold text-[var(--text-muted)]">
                    Suggested Change (1-Click GitHub Patch):
                  </span>
                  <pre className="p-4 rounded-xl bg-black/5 dark:bg-black/60 border border-[var(--border)] text-xs font-mono overflow-x-auto text-emerald-600 dark:text-emerald-400">
                    {f.suggested_patch}
                  </pre>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </AppShell>
  );
}
