"use client";

import { useRouter } from "next/navigation";
import {
  ArrowRight,
  Award,
  CircleDollarSign,
  Gavel,
  Layers,
  Radio,
  ShieldCheck,
  Wallet,
} from "lucide-react";
import { LandingNav } from "@/components/landing/landing-nav";
import { LandingFooter } from "@/components/landing/landing-footer";
import { LiveStats } from "@/components/landing/live-stats";
import { AnimatedGradientText } from "@/components/magicui/animated-gradient-text";
import { ShimmerButton } from "@/components/magicui/shimmer-button";
import { BentoCard, BentoGrid } from "@/components/magicui/bento-grid";
import { DotPattern } from "@/components/magicui/dot-pattern";
import { BorderBeam } from "@/components/magicui/border-beam";
import { Ripple } from "@/components/magicui/ripple";
import { Marquee } from "@/components/magicui/marquee";
import { BlurFade } from "@/components/magicui/blur-fade";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const WALLETS = ["Freighter", "xBull", "Albedo", "Lobstr", "Hana", "Rabet", "Ledger"];

const FEATURES = [
  {
    Icon: Layers,
    name: "Milestone-based escrow",
    description:
      "Lock funds once, release them milestone by milestone. Partial settlement keeps both sides aligned through long engagements.",
    className: "md:col-span-2",
  },
  {
    Icon: Award,
    name: "On-chain reputation",
    description: "Every completed deal and dispute updates a tamper-proof trust score in the registry contract.",
    className: "md:col-span-1",
  },
  {
    Icon: Gavel,
    name: "Arbiter dispute resolution",
    description: "A neutral third party can split escrowed funds fairly when a deal goes sideways.",
    className: "md:col-span-1",
  },
  {
    Icon: Radio,
    name: "Real-time activity",
    description:
      "Contract events stream straight into the UI — balances, statuses and feeds update without a refresh.",
    className: "md:col-span-2",
  },
];

export default function LandingPage() {
  const router = useRouter();

  return (
    <div className="relative flex min-h-screen flex-col">
      <LandingNav />

      {/* Hero */}
      <section className="relative overflow-hidden px-4 pb-20 pt-32 sm:px-6">
        <DotPattern
          className={cn(
            "[mask-image:radial-gradient(560px_circle_at_center,white,transparent)]",
            "absolute inset-0 -z-10 opacity-60",
          )}
        />
        <div className="mx-auto max-w-3xl text-center">
          <BlurFade delay={0.1} inView>
            <AnimatedGradientText className="mx-auto">
              <ShieldCheck className="mr-1.5 h-3.5 w-3.5" />
              <span className="text-sm">Built on Stellar · Soroban smart contracts</span>
            </AnimatedGradientText>
          </BlurFade>

          <BlurFade delay={0.2} inView>
            <h1 className="mt-6 text-balance text-4xl font-bold tracking-tight sm:text-6xl">
              Trustless{" "}
              <span className="bg-gradient-to-r from-primary to-amber-500 bg-clip-text text-transparent">
                escrow
              </span>{" "}
              for two-sided marketplaces
            </h1>
          </BlurFade>

          <BlurFade delay={0.3} inView>
            <p className="mx-auto mt-6 max-w-2xl text-pretty text-lg text-muted-foreground">
              Aegis locks buyer funds in a Soroban smart contract and releases them as work is
              delivered — with on-chain reputation, milestone payouts and arbiter-backed dispute
              resolution. No middlemen, no chargebacks.
            </p>
          </BlurFade>

          <BlurFade delay={0.4} inView>
            <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <ShimmerButton onClick={() => router.push("/dashboard")} className="shadow-lg">
                <span className="flex items-center gap-2 text-sm font-medium text-white">
                  Launch app <ArrowRight className="h-4 w-4" />
                </span>
              </ShimmerButton>
              <Button variant="outline" size="lg" asChild>
                <a href="#how">See how it works</a>
              </Button>
            </div>
          </BlurFade>
        </div>

        {/* Hero preview */}
        <BlurFade delay={0.5} inView>
          <div className="relative mx-auto mt-16 max-w-3xl">
            <div className="relative overflow-hidden rounded-2xl border bg-card/60 p-6 shadow-2xl backdrop-blur">
              <BorderBeam size={250} duration={12} delay={9} />
              <div className="flex items-center justify-between border-b pb-4">
                <div className="flex items-center gap-2 font-medium">
                  <ShieldCheck className="h-5 w-5 text-primary" /> Escrow #1042
                </div>
                <span className="rounded-full bg-warning/10 px-2.5 py-0.5 text-xs font-medium text-warning">
                  Delivered
                </span>
              </div>
              <div className="grid grid-cols-1 gap-6 pt-5 sm:grid-cols-3">
                <div>
                  <p className="text-xs text-muted-foreground">In escrow</p>
                  <p className="text-2xl font-semibold">2,500.00</p>
                </div>
                <div className="sm:col-span-2">
                  <div className="mb-1 flex justify-between text-xs text-muted-foreground">
                    <span>Milestones</span>
                    <span>2 / 3 released</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-muted">
                    <div className="h-full w-2/3 bg-primary" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </BlurFade>

        {/* Live stats */}
        <div className="mx-auto mt-16 max-w-2xl">
          <LiveStats />
        </div>
      </section>

      {/* Wallet marquee */}
      <section className="border-y bg-muted/20 py-6">
        <p className="mb-4 text-center text-xs uppercase tracking-wider text-muted-foreground">
          Works with every major Stellar wallet
        </p>
        <Marquee pauseOnHover className="[--duration:25s]">
          {WALLETS.map((w) => (
            <div
              key={w}
              className="mx-6 flex items-center gap-2 text-lg font-medium text-muted-foreground"
            >
              <Wallet className="h-4 w-4" /> {w}
            </div>
          ))}
        </Marquee>
      </section>

      {/* Features */}
      <section id="features" className="px-4 py-24 sm:px-6">
        <div className="mx-auto max-w-6xl">
          <SectionHeading
            eyebrow="Features"
            title="Everything a real escrow product needs"
            subtitle="Two cooperating Soroban contracts power milestone payouts, reputation and a live event-driven UI."
          />
          <BentoGrid className="mt-12 md:grid-cols-3">
            {FEATURES.map((f) => (
              <BentoCard
                key={f.name}
                name={f.name}
                className={f.className}
                Icon={f.Icon}
                description={f.description}
                href="/dashboard"
                cta="Open the app"
                background={
                  <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-amber-500/5" />
                }
              />
            ))}
          </BentoGrid>
        </div>
      </section>

      {/* How it works */}
      <section id="how" className="border-t bg-muted/20 px-4 py-24 sm:px-6">
        <div className="mx-auto max-w-6xl">
          <SectionHeading
            eyebrow="How it works"
            title="From locked funds to settled deal"
            subtitle="Four steps, fully on-chain, enforced by smart contracts."
          />
          <div className="mt-12 grid grid-cols-1 gap-6 md:grid-cols-4">
            {[
              { n: "01", t: "Fund", d: "Buyer creates an escrow and locks the full amount against milestones." },
              { n: "02", t: "Deliver", d: "Seller does the work and marks milestones as delivered." },
              { n: "03", t: "Release", d: "Buyer releases funds milestone by milestone, net of the platform fee." },
              { n: "04", t: "Settle", d: "Reputation updates on-chain; disputes go to a neutral arbiter." },
            ].map((s, i) => (
              <BlurFade key={s.n} delay={0.1 * i} inView>
                <div className="relative h-full rounded-xl border bg-card p-6">
                  <span className="text-sm font-mono text-primary">{s.n}</span>
                  <h3 className="mt-2 text-lg font-semibold">{s.t}</h3>
                  <p className="mt-1 text-sm text-muted-foreground">{s.d}</p>
                </div>
              </BlurFade>
            ))}
          </div>
        </div>
      </section>

      {/* Architecture */}
      <section id="architecture" className="px-4 py-24 sm:px-6">
        <div className="mx-auto max-w-5xl">
          <SectionHeading
            eyebrow="Architecture"
            title="Two contracts, one permission boundary"
            subtitle="The Escrow contract owns deal logic; the Registry owns reputation and the treasury. Only the registered escrow can write to the registry."
          />
          <div className="mt-12 grid grid-cols-1 items-center gap-4 md:grid-cols-[1fr_auto_1fr]">
            <ArchBox
              icon={ShieldCheck}
              title="Escrow contract"
              points={["Milestone state machine", "Fund / release / refund", "Dispute escalation"]}
            />
            <div className="flex flex-col items-center text-muted-foreground">
              <ArrowRight className="hidden h-6 w-6 md:block" />
              <span className="text-xs">require_auth()</span>
            </div>
            <ArchBox
              icon={Award}
              title="Registry contract"
              points={["Reputation ledger", "Platform treasury", "Marketplace stats"]}
            />
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="px-4 pb-24 sm:px-6">
        <div className="relative mx-auto max-w-4xl overflow-hidden rounded-3xl border bg-gradient-to-br from-primary/10 via-card to-amber-500/10 px-6 py-16 text-center">
          <Ripple />
          <div className="relative">
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
              Start your first trustless deal
            </h2>
            <p className="mx-auto mt-3 max-w-xl text-muted-foreground">
              Connect a Stellar wallet and create a milestone escrow in under a minute.
            </p>
            <div className="mt-8 flex justify-center">
              <ShimmerButton onClick={() => router.push("/dashboard")}>
                <span className="flex items-center gap-2 text-sm font-medium text-white">
                  Launch Aegis <ArrowRight className="h-4 w-4" />
                </span>
              </ShimmerButton>
            </div>
          </div>
        </div>
      </section>

      <LandingFooter />
    </div>
  );
}

function SectionHeading({
  eyebrow,
  title,
  subtitle,
}: {
  eyebrow: string;
  title: string;
  subtitle: string;
}) {
  return (
    <div className="mx-auto max-w-2xl text-center">
      <p className="text-sm font-semibold uppercase tracking-wider text-primary">{eyebrow}</p>
      <h2 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">{title}</h2>
      <p className="mt-4 text-muted-foreground">{subtitle}</p>
    </div>
  );
}

function ArchBox({
  icon: Icon,
  title,
  points,
}: {
  icon: typeof ShieldCheck;
  title: string;
  points: string[];
}) {
  return (
    <div className="rounded-2xl border bg-card p-6">
      <div className="flex items-center gap-2">
        <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Icon className="h-5 w-5" />
        </span>
        <h3 className="font-semibold">{title}</h3>
      </div>
      <ul className="mt-4 space-y-2 text-sm text-muted-foreground">
        {points.map((p) => (
          <li key={p} className="flex items-center gap-2">
            <CircleDollarSign className="h-3.5 w-3.5 text-primary/60" /> {p}
          </li>
        ))}
      </ul>
    </div>
  );
}
