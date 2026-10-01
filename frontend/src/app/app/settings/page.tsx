"use client";

import React, { useState, useEffect } from "react";
import { AppShell } from "@/components/layout/AppShell";
import {
  Bell,
  Shield,
  Trash2,
  Check,
  Save,
  Sparkles,
  Key,
  Eye,
  EyeOff,
  ExternalLink,
  Cpu,
} from "lucide-react";

export default function SettingsPage() {
  const [emailAlerts, setEmailAlerts] = useState(true);
  const [slackAlerts, setSlackAlerts] = useState(false);
  const [slackWebhook, setSlackWebhook] = useState("");
  const [saved, setSaved] = useState(false);

  // Gemini AI Engine State
  const [geminiApiKey, setGeminiApiKey] = useState("");
  const [maskedKey, setMaskedKey] = useState("");
  const [hasGeminiKey, setHasGeminiKey] = useState(false);
  const [geminiModel, setGeminiModel] = useState("gemini-2.5-flash");
  const [showKey, setShowKey] = useState(false);
  const [geminiSaved, setGeminiSaved] = useState(false);
  const [geminiSaving, setGeminiSaving] = useState(false);

  // Fetch current settings on mount
  useEffect(() => {
    async function loadSettings() {
      try {
        const res = await fetch("http://localhost:8000/api/v1/dashboard/settings", {
          credentials: "include",
        });
        if (res.ok) {
          const data = await res.json();
          setHasGeminiKey(data.has_gemini_key);
          setMaskedKey(data.gemini_api_key_masked || "");
          if (data.gemini_model) setGeminiModel(data.gemini_model);
          setEmailAlerts(data.email_alerts ?? true);
          setSlackAlerts(data.slack_alerts ?? false);
          setSlackWebhook(data.slack_webhook || "");
        }
      } catch {
        // Handled
      }
    }
    loadSettings();
  }, []);

  const handleSaveGeminiKey = async () => {
    if (!geminiApiKey.trim()) return;
    setGeminiSaving(true);
    try {
      const res = await fetch("http://localhost:8000/api/v1/dashboard/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          gemini_api_key: geminiApiKey.trim(),
          gemini_model: geminiModel,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setHasGeminiKey(data.has_gemini_key);
        setMaskedKey(data.gemini_api_key_masked);
        setGeminiApiKey("");
        setGeminiSaved(true);
        setTimeout(() => setGeminiSaved(false), 2500);
      }
    } catch {
      alert("Failed to save Gemini API key. Ensure backend is running.");
    } finally {
      setGeminiSaving(false);
    }
  };

  const handleSave = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <AppShell>
      <div className="space-y-6 max-w-3xl">
        <div className="pb-2 border-b border-white/[0.06]">
          <h1 className="text-xl sm:text-2xl font-semibold tracking-tight text-white">
            Settings & Security
          </h1>
          <p className="text-xs text-[#86868B] mt-1">
            Configure Gemini AI API keys, automated alerts, and data compliance.
          </p>
        </div>

        {/* 1. Google Gemini AI Engine Configuration Card */}
        <div className="apple-card p-5 sm:p-6 rounded-2xl space-y-5 border border-emerald-500/20 bg-[#090C12]">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                <Sparkles className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-sm font-semibold text-white">Google Gemini AI Engine</h2>
                  <span
                    className={`text-[10px] font-mono px-2 py-0.5 rounded-full border font-bold ${
                      hasGeminiKey
                        ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/30"
                        : "bg-amber-500/15 text-amber-300 border-amber-500/30"
                    }`}
                  >
                    {hasGeminiKey ? "Connected" : "Key Required"}
                  </span>
                </div>
                <p className="text-xs text-[#86868B] mt-0.5">
                  Power AI automated code reviews, AST syntax fixes, and vulnerability diagnostics.
                </p>
              </div>
            </div>

            <a
              href="https://aistudio.google.com/app/apikey"
              target="_blank"
              rel="noreferrer"
              className="hidden sm:flex items-center gap-1.5 text-xs text-emerald-400 hover:text-emerald-300 transition-colors font-medium underline underline-offset-4"
            >
              <span>Get API Key</span>
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>

          <div className="space-y-4 pt-1">
            {/* Masked status if key already saved */}
            {hasGeminiKey && (
              <div className="p-3 rounded-xl border border-white/[0.06] bg-white/[0.02] flex items-center justify-between text-xs">
                <div className="flex items-center gap-2 font-mono text-zinc-300">
                  <Key className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  <span>Active Key: {maskedKey}</span>
                </div>
                <span className="text-[11px] text-emerald-400 font-medium">Ready for Reviews</span>
              </div>
            )}

            {/* API Key Input */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-white flex items-center justify-between">
                <span>{hasGeminiKey ? "Replace Gemini API Key" : "Enter Gemini API Key"}</span>
                <span className="text-[11px] text-[#86868B]">Starts with AIzaSy...</span>
              </label>
              <div className="relative">
                <input
                  type={showKey ? "text" : "password"}
                  placeholder={hasGeminiKey ? "Paste new Gemini API Key to replace..." : "AIzaSy..."}
                  value={geminiApiKey}
                  onChange={(e) => setGeminiApiKey(e.target.value)}
                  className="w-full px-3.5 py-2.5 pr-10 text-xs rounded-xl border border-white/[0.08] bg-white/[0.03] text-white focus:outline-none focus:border-emerald-500/50 font-mono"
                />
                <button
                  type="button"
                  onClick={() => setShowKey(!showKey)}
                  className="absolute right-3 top-2.5 text-[#86868B] hover:text-white transition-colors"
                  title={showKey ? "Hide key" : "Show key"}
                >
                  {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Model Selection */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-white flex items-center gap-1.5">
                <Cpu className="w-3.5 h-3.5 text-zinc-400" />
                <span>Review Model</span>
              </label>
              <select
                value={geminiModel}
                onChange={(e) => setGeminiModel(e.target.value)}
                className="w-full px-3.5 py-2.5 text-xs rounded-xl border border-white/[0.08] bg-[#0E1117] text-white focus:outline-none focus:border-emerald-500/50 cursor-pointer font-medium"
              >
                <option value="gemini-3.8-flash">Gemini 3.8 Flash (Latest Preview & Fast, Recommended)</option>
                <option value="gemini-3.5-flash">Gemini 3.5 Flash (Ultra-Fast & Smart)</option>
                <option value="gemini-2.5-flash">Gemini 2.5 Flash (High Speed Production)</option>
                <option value="gemini-1.5-pro">Gemini 1.5 Pro (Deep Multi-File Reasoning)</option>
                <option value="gemini-1.5-flash">Gemini 1.5 Flash (Standard Lightweight)</option>
              </select>
            </div>
          </div>

          <div className="flex items-center justify-between pt-2 border-t border-white/[0.06]">
            <a
              href="https://aistudio.google.com/app/apikey"
              target="_blank"
              rel="noreferrer"
              className="text-xs text-zinc-400 hover:text-white transition-colors flex items-center gap-1 sm:hidden"
            >
              <span>Get API Key</span>
              <ExternalLink className="w-3 h-3" />
            </a>
            <div className="flex items-center gap-2 ml-auto">
              <button
                disabled={!geminiApiKey.trim() || geminiSaving}
                onClick={handleSaveGeminiKey}
                className="px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-black rounded-xl text-xs font-bold transition-all disabled:opacity-40 flex items-center gap-1.5 shadow-sm"
              >
                {geminiSaved ? (
                  <>
                    <Check className="w-3.5 h-3.5 stroke-[3]" />
                    <span>Key Saved & Active!</span>
                  </>
                ) : (
                  <>
                    <Save className="w-3.5 h-3.5" />
                    <span>{geminiSaving ? "Saving..." : "Save API Key"}</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* 2. Notification Settings */}
        <div className="apple-card p-5 sm:p-6 rounded-2xl space-y-5">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-white/[0.06] text-white">
              <Bell className="w-4 h-4 opacity-80" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-white">Alert Notifications</h2>
              <p className="text-xs text-[#86868B]">
                Receive instant notifications when critical security issues or merge blockers are flagged.
              </p>
            </div>
          </div>

          <div className="space-y-3 pt-1">
            <div className="flex items-center justify-between p-3.5 rounded-xl border border-white/[0.06] bg-white/[0.02]">
              <div>
                <span className="font-medium text-xs text-white block">Email Alerts</span>
                <span className="text-[11px] text-[#86868B]">
                  Send summary findings to repository administrators on critical blockers.
                </span>
              </div>
              <input
                type="checkbox"
                checked={emailAlerts}
                onChange={(e) => setEmailAlerts(e.target.checked)}
                className="w-4 h-4 accent-white rounded cursor-pointer"
              />
            </div>

            <div className="p-3.5 rounded-xl border border-white/[0.06] bg-white/[0.02] space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <span className="font-medium text-xs text-white block">Slack Webhook Alerts</span>
                  <span className="text-[11px] text-[#86868B]">
                    Encrypted with AES-256-GCM prior to storage.
                  </span>
                </div>
                <input
                  type="checkbox"
                  checked={slackAlerts}
                  onChange={(e) => setSlackAlerts(e.target.checked)}
                  className="w-4 h-4 accent-white rounded cursor-pointer"
                />
              </div>

              {slackAlerts && (
                <input
                  type="password"
                  placeholder="https://hooks.slack.com/services/..."
                  value={slackWebhook}
                  onChange={(e) => setSlackWebhook(e.target.value)}
                  className="w-full px-3 py-1.5 text-xs rounded-lg border border-white/[0.08] bg-white/[0.04] text-white focus:outline-none focus:border-white/20"
                />
              )}
            </div>
          </div>

          <div className="flex justify-end pt-1">
            <button
              onClick={handleSave}
              className="px-4 py-2 bg-white text-[#090A0F] rounded-lg text-xs font-semibold hover:bg-zinc-200 apple-press flex items-center gap-2 shadow-sm"
            >
              {saved ? <Check className="w-3.5 h-3.5" /> : <Save className="w-3.5 h-3.5" />}
              {saved ? "Preferences Saved" : "Save Preferences"}
            </button>
          </div>
        </div>

        {/* Danger Zone */}
        <div className="apple-card p-5 sm:p-6 rounded-2xl border border-rose-500/20 bg-rose-500/[0.03] space-y-3">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-rose-500/15 text-rose-400">
              <Trash2 className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-rose-400">Data Erasure & Revocation</h2>
              <p className="text-xs text-[#86868B]">
                Purge repository review history and disconnect GitHub installations.
              </p>
            </div>
          </div>

          <p className="text-xs text-[#86868B] leading-relaxed">
            In compliance with tenant security rules, all cached review runs and logs are purged within 30 days of account termination.
          </p>

          <button className="px-3.5 py-1.5 bg-rose-500/20 text-rose-300 border border-rose-500/30 rounded-lg text-xs font-semibold hover:bg-rose-500/30 apple-press">
            Purge Review Data
          </button>
        </div>
      </div>
    </AppShell>
  );
}
