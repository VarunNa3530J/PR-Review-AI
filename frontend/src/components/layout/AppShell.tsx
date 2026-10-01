"use client";

import React, { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Sparkles,
  LayoutDashboard,
  GitPullRequest,
  ShieldCheck,
  BarChart3,
  FolderGit2,
  Settings,
  Zap,
  Search,
  Bell,
  Menu,
  X,
} from "lucide-react";

interface AppShellProps {
  children: React.ReactNode;
}

export function AppShell({ children }: AppShellProps) {
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const mainNav = [
    { label: "Dashboard", href: "/app", icon: LayoutDashboard },
    { label: "History & Audits", href: "/app?tab=history", icon: GitPullRequest },
    { label: "Repositories", href: "/app/repos", icon: FolderGit2 },
    { label: "Code Quality", href: "/app/quality", icon: BarChart3 },
    { label: "Security & Rules", href: "/app/quality", icon: ShieldCheck },
  ];

  const bottomNav = [
    { label: "Settings", href: "/app/settings", icon: Settings },
    { label: "Subscription", href: "/pricing", icon: Zap },
  ];

  const [isCollapsed, setIsCollapsed] = useState(false);

  return (
    <div className="h-screen bg-[#07080B] text-[#F5F5F7] flex flex-col antialiased selection:bg-white/20 overflow-hidden">
      {/* Top Header - Dark Glass */}
      <header className="h-14 border-b border-white/[0.08] bg-[#0A0C10]/90 backdrop-blur-xl px-4 sm:px-6 flex items-center justify-between shrink-0 z-40 transition-colors">
        {/* Left: Brand Identity + Sidebar Collapse Toggle */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="hidden md:flex p-1.5 rounded-lg text-[#86868B] hover:text-white hover:bg-white/[0.06] transition-colors"
            title={isCollapsed ? "Maximize Sidebar" : "Minimize Sidebar"}
          >
            <Menu className="w-4 h-4" />
          </button>

          <Link href="/" className="flex items-center gap-2.5 group">
            <div className="w-7 h-7 rounded-lg bg-white text-black flex items-center justify-center font-black shadow-sm group-hover:scale-105 transition-transform">
              <Sparkles className="w-3.5 h-3.5 fill-black" />
            </div>
            <span className="font-semibold text-sm tracking-tight text-[#F5F5F7]">PR Review AI</span>
          </Link>
        </div>

        {/* Right: Search, Alerts, Account */}
        <div className="flex items-center gap-3">
          <div className="relative hidden md:block">
            <Search className="w-3.5 h-3.5 text-[#86868B] absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Search code, pull requests, files..."
              className="w-64 bg-white/[0.04] border border-white/[0.08] rounded-lg pl-8 pr-10 py-1.5 text-xs text-[#F5F5F7] focus:outline-none focus:border-white/25 transition-all placeholder:text-[#636366]"
            />
            <span className="absolute right-2.5 top-2 text-[10px] text-[#636366] bg-white/[0.06] px-1 py-0.5 rounded font-mono">
              /
            </span>
          </div>

          <button
            className="w-8 h-8 rounded-lg bg-white/[0.04] border border-white/[0.08] flex items-center justify-center text-[#86868B] hover:text-white transition-colors apple-press"
            aria-label="Notifications"
          >
            <Bell className="w-3.5 h-3.5" />
          </button>

          <div className="w-7 h-7 rounded-full bg-white/[0.12] border border-white/[0.1] text-xs font-semibold flex items-center justify-center text-white cursor-pointer hover:bg-white/[0.18] transition-colors">
            A
          </div>

          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="md:hidden p-1.5 text-[#86868B] hover:text-white"
            aria-label="Toggle menu"
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </header>

      {/* Main Container with Sidebar + Content */}
      <div className="flex flex-1 min-h-0 overflow-hidden">
        {/* Left Fixed Sidebar with Minimize/Maximize Toggle */}
        <aside
          className={`h-full bg-[#0A0C10] border-r border-white/[0.08] p-3 flex flex-col justify-between transition-all duration-200 shrink-0 ${
            isCollapsed ? "md:w-16 w-16" : "md:w-56 w-56"
          } ${mobileMenuOpen ? "fixed inset-y-14 left-0 z-30" : "hidden md:flex"}`}
        >
          {/* Main Navigation */}
          <div className="space-y-2">
            {/* Collapse/Expand Action within Sidebar */}
            <div className={`hidden md:flex items-center pb-2 border-b border-white/[0.06] ${isCollapsed ? "justify-center" : "justify-between px-1"}`}>
              {!isCollapsed && <span className="text-[10px] uppercase font-mono tracking-wider text-[#86868B] font-semibold">Navigation</span>}
              <button
                onClick={() => setIsCollapsed(!isCollapsed)}
                className="p-1 rounded-md text-[#86868B] hover:text-white hover:bg-white/[0.06] transition-colors"
                title={isCollapsed ? "Expand sidebar" : "Minimize sidebar"}
              >
                {isCollapsed ? <Menu className="w-4 h-4" /> : <X className="w-3.5 h-3.5" />}
              </button>
            </div>

            <nav className="space-y-1">
              {mainNav.map((item) => {
                const Icon = item.icon;
                const isActive =
                  item.label === "Dashboard" ? pathname === "/app" : pathname.startsWith(item.href);

                return (
                  <Link
                    key={item.label}
                    href={item.href}
                    onClick={() => setMobileMenuOpen(false)}
                    title={isCollapsed ? item.label : undefined}
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-medium transition-all ${
                      isCollapsed ? "justify-center px-2" : ""
                    } ${
                      isActive
                        ? "bg-[#1E222B] text-white shadow-sm font-semibold border border-white/[0.08]"
                        : "text-[#8E95A2] hover:text-white hover:bg-white/[0.04]"
                    }`}
                  >
                    <Icon className="w-4 h-4 shrink-0 opacity-80" />
                    {!isCollapsed && <span className="truncate">{item.label}</span>}
                  </Link>
                );
              })}

              <div className="pt-2 pb-1">
                <div className="h-px bg-white/[0.06] mx-1"></div>
              </div>

              {bottomNav.map((item) => {
                const Icon = item.icon;
                const isActive = pathname.startsWith(item.href);
                return (
                  <Link
                    key={item.label}
                    href={item.href}
                    onClick={() => setMobileMenuOpen(false)}
                    title={isCollapsed ? item.label : undefined}
                    className={`flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-medium transition-all ${
                      isCollapsed ? "justify-center px-2" : ""
                    } ${
                      isActive
                        ? "bg-[#1E222B] text-white"
                        : "text-[#8E95A2] hover:text-white hover:bg-white/[0.04]"
                    }`}
                  >
                    <Icon className="w-4 h-4 shrink-0 opacity-80" />
                    {!isCollapsed && <span className="truncate">{item.label}</span>}
                  </Link>
                );
              })}
            </nav>
          </div>

          {/* Usage / Plan Overview (Matching Screenshot exactly) */}
          {!isCollapsed ? (
            <div className="bg-[#12151C] border border-white/[0.08] rounded-2xl p-3.5 space-y-2.5 relative">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-white">Active Plan</span>
                <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded-full bg-white/[0.08] text-[#8E95A2] font-semibold">
                  FREE TIER
                </span>
              </div>
              <div className="text-[11px] text-[#8E95A2] leading-tight">
                Review pipeline active.
              </div>
              <Link
                href="/pricing"
                className="block text-center py-2 bg-white text-black font-bold text-xs rounded-xl hover:bg-zinc-200 transition-colors shadow-sm"
              >
                Manage Plan
              </Link>
            </div>
          ) : (
            <div className="flex justify-center py-2">
              <button
                onClick={() => setIsCollapsed(false)}
                className="w-8 h-8 rounded-xl bg-white/[0.08] hover:bg-white/[0.12] flex items-center justify-center text-white"
                title="Expand sidebar"
              >
                <span className="w-2 h-2 rounded-full bg-emerald-400" />
              </button>
            </div>
          )}
        </aside>

        {/* Dynamic Workspace */}
        <main className="flex-1 p-3 sm:p-4 overflow-y-auto w-full max-w-[1920px] mx-auto flex flex-col min-h-0">
          {children}
        </main>
      </div>
    </div>
  );
}
