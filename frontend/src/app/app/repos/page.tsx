"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { AppShell } from "@/components/layout/AppShell";
import {
  FolderGit2,
  ExternalLink,
  Search,
  Plus,
  RefreshCw,
} from "lucide-react";

interface Repo {
  id: string;
  github_repo_id: number;
  full_name: string;
  is_private: boolean;
  is_enabled: boolean;
  quality_score: number;
}

export default function RepositoriesPage() {
  const [search, setSearch] = useState("");
  const [repos, setRepos] = useState<Repo[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadRepos() {
      try {
        const res = await fetch("http://localhost:8000/api/v1/repos", { credentials: "include" });
        if (res.ok) {
          const data = await res.json();
          setRepos(data);
        }
      } catch {
        // Handled silently
      } finally {
        setLoading(false);
      }
    }
    loadRepos();
  }, []);

  const toggleRepo = async (id: string, currentEnabled: boolean) => {
    try {
      const res = await fetch(`http://localhost:8000/api/v1/repos/${id}?enabled=${!currentEnabled}`, {
        method: "PATCH",
        credentials: "include",
      });
      if (res.ok) {
        setRepos((prev) =>
          prev.map((r) => (r.id === id ? { ...r, is_enabled: !currentEnabled } : r))
        );
      }
    } catch {
      // Handled
    }
  };

  const filteredRepos = repos.filter((r) =>
    r.full_name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <AppShell>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b border-white/[0.06]">
          <div>
            <h1 className="text-xl sm:text-2xl font-semibold tracking-tight text-white">
              Connected Repositories
            </h1>
            <p className="text-xs text-[#86868B] mt-1">
              Configure bot reviews, static security scans, and PR merge guards.
            </p>
          </div>
          <a
            href="https://github.com/apps/pr-review-ai-dev/installations/new"
            target="_blank"
            rel="noreferrer"
            className="px-3.5 py-2 bg-white text-[#090A0F] rounded-lg text-xs font-semibold hover:bg-zinc-200 apple-press flex items-center gap-2 shrink-0 shadow-sm"
          >
            <Plus className="w-3.5 h-3.5" />
            Connect GitHub Repos
          </a>
        </div>

        {/* Search */}
        <div className="relative max-w-sm">
          <Search className="w-3.5 h-3.5 text-[#86868B] absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Filter repositories..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 rounded-lg border border-white/[0.08] bg-white/[0.03] text-xs text-white placeholder:text-[#636366] focus:outline-none focus:border-white/20 transition-all"
          />
        </div>

        {/* Repository List / Authentic Empty State */}
        {loading ? (
          <div className="p-12 text-center text-xs text-[#86868B] flex items-center justify-center gap-2">
            <RefreshCw className="w-4 h-4 animate-spin text-white" />
            Loading connected repositories...
          </div>
        ) : filteredRepos.length === 0 ? (
          <div className="apple-card rounded-2xl p-10 sm:p-14 text-center max-w-xl mx-auto space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-white/[0.06] border border-white/[0.08] flex items-center justify-center mx-auto text-white">
              <FolderGit2 className="w-6 h-6 opacity-80" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-white">No Repositories Connected Yet</h3>
              <p className="text-xs text-[#86868B] mt-1.5 leading-relaxed max-w-md mx-auto">
                Install the PR Review AI GitHub App on your personal account or organization to begin automated code analysis.
              </p>
            </div>
            <div className="pt-2">
              <a
                href="https://github.com/apps/pr-review-ai-dev/installations/new"
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 px-4 py-2 bg-white text-[#090A0F] rounded-lg text-xs font-semibold hover:bg-zinc-200 apple-press shadow-sm"
              >
                <Plus className="w-3.5 h-3.5" />
                Install GitHub App
              </a>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredRepos.map((repo) => (
              <div
                key={repo.id}
                className="apple-card p-4 rounded-xl flex flex-col justify-between space-y-4"
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded bg-white/[0.06] text-[#86868B]">
                      {repo.is_private ? "Private" : "Public"}
                    </span>

                    {/* Toggle Switch */}
                    <button
                      onClick={() => toggleRepo(repo.id, repo.is_enabled)}
                      className={`px-2.5 py-1 rounded text-[11px] font-semibold transition-colors ${
                        repo.is_enabled
                          ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/20"
                          : "bg-white/[0.06] text-[#86868B] border border-white/[0.08]"
                      }`}
                    >
                      {repo.is_enabled ? "Enabled" : "Disabled"}
                    </button>
                  </div>

                  <h3 className="font-semibold text-sm text-white hover:text-white/80 transition-colors">
                    {repo.full_name}
                  </h3>
                </div>

                <div className="pt-3 border-t border-white/[0.06] flex items-center justify-between text-xs text-[#86868B]">
                  <span>Quality Score: {repo.quality_score}/100</span>
                  <Link
                    href={`/app/quality?repo=${repo.id}`}
                    className="hover:text-white transition-colors"
                  >
                    View Metrics &rarr;
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
}
