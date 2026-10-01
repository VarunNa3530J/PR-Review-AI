import Link from "next/link";
import { Sparkles, Check } from "lucide-react";

export default function PricingPage() {
  const plans = [
    {
      name: "Community",
      price: "₹0",
      cadence: "forever",
      description: "Ideal for open-source maintainers and indie hackers.",
      features: [
        "100 public repository reviews / month",
        "20 private repository reviews / month",
        "Python, JS, TS, and Java support",
        "Secrets scanning with live masking",
        "1-click patch suggestion blocks",
      ],
      isPopular: false,
      ctaText: "Current Plan",
      ctaHref: "/app",
    },
    {
      name: "Pro Developer",
      price: "₹1,999",
      cadence: "per month",
      description: "For fast-shipping engineers & high-cadence squads.",
      features: [
        "500 public repository reviews / month",
        "150 private repository reviews / month",
        "Custom plain-English rules (.prreview.yml)",
        "Automated blocker checks on Critical risks",
        "Diff hallucination validation",
        "Priority worker processing queue",
      ],
      isPopular: true,
      ctaText: "Upgrade to Pro",
      ctaHref: "/app",
    },
    {
      name: "Engineering Team",
      price: "₹7,999",
      cadence: "per month",
      description: "Enterprise governance, multi-seat isolation, and full audit trails.",
      features: [
        "2,000 public repository reviews / month",
        "1,000 private repository reviews / month",
        "Slack webhook alerts (AES-256-GCM encrypted)",
        "Organization role-based access control",
        "90-day retention policies",
        "Priority Gemini 3.8 Flash quota allocation",
      ],
      isPopular: false,
      ctaText: "Upgrade to Team",
      ctaHref: "/app",
    },
  ];

  return (
    <div className="min-h-screen bg-[#090A0F] text-[#F5F5F7] flex flex-col justify-between selection:bg-white/20">
      <header className="border-b border-white/[0.08] bg-[#0E1018]/80 backdrop-blur-xl px-6 py-4 flex items-center justify-between sticky top-0 z-40">
        <Link href="/" className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-white text-black flex items-center justify-center font-bold shadow-sm">
            <Sparkles className="w-3.5 h-3.5 fill-black" />
          </div>
          <span className="font-semibold text-sm tracking-tight text-white">PR Review AI</span>
        </Link>
        <Link
          href="/app"
          className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-white text-[#090A0F] hover:bg-zinc-200 apple-press transition-colors shadow-sm"
        >
          Open Studio
        </Link>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-16 flex-1 flex flex-col items-center">
        <div className="text-center space-y-2 mb-14">
          <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded-full bg-white/[0.08] text-[#86868B]">
            Transparent Pricing
          </span>
          <h1 className="text-2xl sm:text-4xl font-semibold tracking-tight text-white">
            Predictable plans for modern engineering
          </h1>
          <p className="text-xs sm:text-sm text-[#86868B] max-w-lg mx-auto">
            Audit every pull request in under 60 seconds. No surprise bills. Secure domestic billing via Razorpay.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 w-full">
          {plans.map((p, idx) => (
            <div
              key={idx}
              className={`apple-card p-6 sm:p-7 rounded-2xl flex flex-col justify-between ${
                p.isPopular ? "border-white/25 ring-1 ring-white/20" : ""
              }`}
            >
              <div>
                {p.isPopular && (
                  <span className="text-[10px] font-mono uppercase text-white bg-white/[0.1] px-2 py-0.5 rounded-full inline-flex items-center gap-1 mb-3">
                    <Sparkles className="w-3 h-3" /> Recommended
                  </span>
                )}
                <h3 className="text-base font-semibold text-white">{p.name}</h3>
                <p className="text-xs text-[#86868B] mt-1 mb-5">{p.description}</p>
                <div className="flex items-baseline gap-1 mb-5">
                  <span className="text-3xl font-bold text-white">{p.price}</span>
                  <span className="text-xs text-[#86868B]">/{p.cadence}</span>
                </div>

                <div className="space-y-2.5 pt-5 border-t border-white/[0.06]">
                  {p.features.map((f, i) => (
                    <div key={i} className="flex items-center gap-2 text-xs text-[#86868B]">
                      <Check className="w-3.5 h-3.5 text-white/90 shrink-0" />
                      <span>{f}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="pt-6 mt-6 border-t border-white/[0.06]">
                <Link
                  href={p.ctaHref}
                  className={`w-full block text-center py-2.5 rounded-lg text-xs font-semibold apple-press transition-all ${
                    p.isPopular
                      ? "bg-white text-[#090A0F] hover:bg-zinc-200 shadow-sm"
                      : "bg-white/[0.06] text-white hover:bg-white/[0.1] border border-white/[0.08]"
                  }`}
                >
                  {p.ctaText}
                </Link>
              </div>
            </div>
          ))}
        </div>
      </main>

      <footer className="border-t border-white/[0.06] py-5 px-6 text-center text-[11px] text-[#86868B]">
        PR Review AI &copy; 2026. Secured via AES-256-GCM token encryption & Razorpay billing.
      </footer>
    </div>
  );
}
