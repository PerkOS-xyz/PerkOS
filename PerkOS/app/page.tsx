import Image from "next/image";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ContactForm } from "@/components/contact-form";
import { CHAIN_DATA } from "@/components/chain-icons";

export default function Home() {
  return (
    <div className="flex flex-col min-h-screen">
      {/* Header */}
      <header className="border-b sticky top-0 z-50 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto max-w-7xl flex h-16 items-center justify-between px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-2">
            <Image
              src="/images/PerkOS-icon.png"
              alt="PerkOS"
              width={40}
              height={40}
              className="rounded-lg"
            />
            <span className="text-lg sm:text-xl font-bold">PerkOS</span>
          </div>
          <nav className="hidden md:flex gap-4 lg:gap-6">
            <Link href="#spark" className="text-sm font-medium hover:underline transition-colors">
              Spark
            </Link>
            <Link href="#stack" className="text-sm font-medium hover:underline transition-colors">
              Stack
            </Link>
            <Link href="#features" className="text-sm font-medium hover:underline transition-colors">
              Features
            </Link>
            <Link href="#pricing" className="text-sm font-medium hover:underline transition-colors">
              Pricing
            </Link>
            <Link href="#contact" className="text-sm font-medium hover:underline transition-colors">
              Contact
            </Link>
          </nav>
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" className="hidden sm:inline-flex" asChild>
              <Link href="https://github.com/PerkOS-xyz/PerkOS">GitHub</Link>
            </Button>
            <Button size="sm" asChild>
              <Link href="#get-started">Get Started</Link>
            </Button>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="py-12 sm:py-20 md:py-32 bg-gradient-to-b from-background to-muted">
        <div className="container mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col items-center text-center gap-6 sm:gap-8 max-w-4xl mx-auto">
            <div className="flex items-center gap-4">
              <Image
                src="/images/PerkOS.png"
                alt="PerkOS Logo"
                width={300}
                height={100}
                className="w-60 h-20 sm:w-28 sm:h-28 md:w-96 md:h-32 rounded-2xl"
              />
            </div>
            <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight px-4">
              The Operating System for AI Agents
            </h1>
            <p className="text-lg sm:text-xl md:text-2xl text-muted-foreground max-w-3xl px-4">
              Build, deploy, and monetize AI agents across multiple platforms.
              Web3-native infrastructure for the agentic economy with instant micropayments.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 w-full sm:w-auto px-4">
              <Button size="lg" className="w-full sm:w-auto min-w-[200px] bg-perkos-gradient hover:opacity-90 glow-pink" asChild>
                <Link href="https://spark.perkos.xyz">Launch Your Agent</Link>
              </Button>
              <Button size="lg" variant="outline" className="w-full sm:w-auto min-w-[200px] border-perkos-pink text-perkos-pink hover:bg-perkos-pink hover:text-white" asChild>
                <Link href="https://github.com/PerkOS-xyz/PerkOS">Developer Docs</Link>
              </Button>
            </div>
            <div className="flex flex-col sm:flex-row items-center gap-3 sm:gap-8 text-xs sm:text-sm text-muted-foreground px-4">
              <div className="flex items-center gap-2">
                <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
                <span>Live on Mainnet</span>
              </div>
              <span className="hidden sm:inline">•</span>
              <span>x402 Protocol</span>
              <span className="hidden sm:inline">•</span>
              <span>ERC-8004 Identity</span>
              <span className="hidden sm:inline">•</span>
              <span>7 Networks</span>
            </div>
          </div>
        </div>
      </section>

      {/* Supported Networks Carousel */}
      <section className="py-12 sm:py-16 border-t overflow-hidden">
        <div className="text-center mb-8 px-4">
          <h2 className="text-xl sm:text-2xl font-bold mb-2">Supported Networks</h2>
          <p className="text-sm text-muted-foreground">Multi-chain by default</p>
        </div>
        <div className="relative marquee-fade">
          <div className="flex animate-marquee">
            {/* First set of chains */}
            {CHAIN_DATA.map((chain, idx) => (
              <div
                key={`first-${idx}`}
                className="flex items-center gap-3 px-8 py-4 mx-4 bg-gradient-to-r rounded-xl border border-white/5 hover:border-perkos-pink/30 transition-colors shrink-0"
                style={{ background: `linear-gradient(135deg, rgba(27, 24, 51, 0.8), rgba(14, 7, 22, 0.8))` }}
              >
                <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center p-1.5">
                  <chain.Icon className="w-full h-full" />
                </div>
                <span className="font-medium text-white/90">{chain.name}</span>
              </div>
            ))}
            {/* Duplicate set for seamless loop */}
            {CHAIN_DATA.map((chain, idx) => (
              <div
                key={`second-${idx}`}
                className="flex items-center gap-3 px-8 py-4 mx-4 bg-gradient-to-r rounded-xl border border-white/5 hover:border-perkos-pink/30 transition-colors shrink-0"
                style={{ background: `linear-gradient(135deg, rgba(27, 24, 51, 0.8), rgba(14, 7, 22, 0.8))` }}
              >
                <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center p-1.5">
                  <chain.Icon className="w-full h-full" />
                </div>
                <span className="font-medium text-white/90">{chain.name}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Value Props Section */}
      <section className="py-12 sm:py-16 border-t bg-muted/50">
        <div className="container mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 sm:gap-8 max-w-5xl mx-auto text-center">
            <div className="space-y-2">
              <div className="text-3xl sm:text-4xl font-bold text-perkos-orange">$0.0001</div>
              <div className="text-sm text-muted-foreground">Minimum transaction size</div>
            </div>
            <div className="space-y-2">
              <div className="text-3xl sm:text-4xl font-bold text-perkos-pink">&lt;2s</div>
              <div className="text-sm text-muted-foreground">Settlement time</div>
            </div>
            <div className="space-y-2">
              <div className="text-3xl sm:text-4xl font-bold text-perkos-coral">7+</div>
              <div className="text-sm text-muted-foreground">Production networks</div>
            </div>
          </div>
        </div>
      </section>

      {/* Two Product Showcase */}
      <section className="py-12 sm:py-16 md:py-20 border-t">
        <div className="container mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12 sm:mb-16">
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold mb-3 sm:mb-4 px-4">
              Spark ignites. Stack powers.
            </h2>
            <p className="text-base sm:text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto px-4">
              Two products working together to power the agentic economy
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 sm:gap-8 max-w-6xl mx-auto">
            {/* Spark Card */}
            <Card className="relative overflow-hidden border-2 hover:border-perkos-pink transition-colors card-hover" id="spark">
              <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-perkos-pink/20 to-transparent rounded-bl-full" />
              <CardHeader>
                <div className="flex items-center gap-3 mb-4">
                  <Image
                    src="/images/Spark-icon.png"
                    alt="Spark"
                    width={60}
                    height={60}
                    className="rounded-lg"
                  />
                  <div>
                    <CardTitle className="text-2xl">Spark</CardTitle>
                    <CardDescription className="text-base">No-code AI agent launcher</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-muted-foreground">
                  Launch intelligent AI agents with personality in minutes. No coding required.
                  Perfect for community managers, creators, and Web3 projects.
                </p>
                <ul className="space-y-2">
                  <li className="flex items-start gap-2">
                    <span className="text-perkos-orange">⚡</span>
                    <span>5-minute setup, deploy across platforms instantly</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-perkos-orange">🎨</span>
                    <span>Visual character & personality editor</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-perkos-orange">🔌</span>
                    <span>Discord, Telegram, Twitch, Kick support</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-perkos-orange">💰</span>
                    <span>Built-in x402 micropayments — pay only for what you use</span>
                  </li>
                </ul>
                <div className="pt-4 space-y-2">
                  <Button className="w-full bg-perkos-gradient hover:opacity-90" asChild>
                    <Link href="https://spark.perkos.xyz">Launch Spark App</Link>
                  </Button>
                  <Button variant="outline" className="w-full border-perkos-pink text-perkos-pink hover:bg-perkos-pink hover:text-white" asChild>
                    <Link href="https://github.com/PerkOS-xyz/Spark">View on GitHub</Link>
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Stack Card */}
            <Card className="relative overflow-hidden border-2 hover:border-perkos-purple transition-colors card-hover" id="stack">
              <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-perkos-purple/20 to-transparent rounded-bl-full" />
              <CardHeader>
                <div className="flex items-center gap-3 mb-4">
                  <Image
                    src="/images/Stack-icon.png"
                    alt="Stack"
                    width={60}
                    height={60}
                    className="rounded-lg"
                  />
                  <div>
                    <CardTitle className="text-2xl">Stack</CardTitle>
                    <CardDescription className="text-base">Production middleware for developers</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-muted-foreground">
                  Complete infrastructure for agent-powered applications. 10 npm packages,
                  7 networks, production-ready APIs.
                </p>
                <ul className="space-y-2">
                  <li className="flex items-start gap-2">
                    <span className="text-perkos-purple">🔌</span>
                    <span>Complete REST API for agent management</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-perkos-purple">💳</span>
                    <span>x402 Facilitator for instant micropayments</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-perkos-purple">🔍</span>
                    <span>Discovery service & agent registry</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-perkos-purple">🆔</span>
                    <span>ERC-8004 on-chain identity & reputation</span>
                  </li>
                </ul>
                <div className="pt-4 space-y-2">
                  <Button className="w-full bg-perkos-purple hover:bg-perkos-magenta" asChild>
                    <Link href="https://stack.perkos.xyz">Launch Stack App</Link>
                  </Button>
                  <Button variant="outline" className="w-full border-perkos-purple text-perkos-purple hover:bg-perkos-purple hover:text-white" asChild>
                    <Link href="https://github.com/PerkOS-xyz/Stack">View on GitHub</Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section className="py-12 sm:py-16 md:py-20 border-t bg-muted/50">
        <div className="container mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12 sm:mb-16">
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold mb-3 sm:mb-4 px-4">
              The x402 Protocol
            </h2>
            <p className="text-base sm:text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto px-4">
              HTTP 402 &quot;Payment Required&quot; has existed since 1999 — reserved for future use.
              PerkOS activates it.
            </p>
          </div>

          <div className="max-w-4xl mx-auto">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 sm:gap-6">
              <div className="text-center space-y-3 p-4">
                <div className="w-12 h-12 rounded-full bg-perkos-orange/10 flex items-center justify-center mx-auto">
                  <span className="text-2xl text-perkos-orange">1</span>
                </div>
                <h3 className="font-semibold">Request</h3>
                <p className="text-sm text-muted-foreground">Client requests a paid resource</p>
              </div>
              <div className="text-center space-y-3 p-4">
                <div className="w-12 h-12 rounded-full bg-perkos-coral/10 flex items-center justify-center mx-auto">
                  <span className="text-2xl text-perkos-coral">2</span>
                </div>
                <h3 className="font-semibold">402 Response</h3>
                <p className="text-sm text-muted-foreground">Server returns payment requirements</p>
              </div>
              <div className="text-center space-y-3 p-4">
                <div className="w-12 h-12 rounded-full bg-perkos-pink/10 flex items-center justify-center mx-auto">
                  <span className="text-2xl text-perkos-pink">3</span>
                </div>
                <h3 className="font-semibold">Sign & Pay</h3>
                <p className="text-sm text-muted-foreground">Client signs payment with wallet</p>
              </div>
              <div className="text-center space-y-3 p-4">
                <div className="w-12 h-12 rounded-full bg-perkos-purple/10 flex items-center justify-center mx-auto">
                  <span className="text-2xl text-perkos-purple">4</span>
                </div>
                <h3 className="font-semibold">Access</h3>
                <p className="text-sm text-muted-foreground">Resource delivered, instant settlement</p>
              </div>
            </div>

            <div className="mt-8 p-6 bg-background rounded-lg border text-center">
              <p className="text-muted-foreground">
                Built on the x402 standard championed by <strong>Coinbase</strong> and the{" "}
                <strong>x402 Foundation</strong>. Production-ready infrastructure for the programmable web.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section className="py-12 sm:py-16 md:py-20 bg-muted" id="features">
        <div className="container mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12 sm:mb-16">
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold mb-3 sm:mb-4 px-4">
              Everything you need to build agents
            </h2>
            <p className="text-base sm:text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto px-4">
              Web3-native infrastructure purpose-built for the agentic economy
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8 max-w-6xl mx-auto">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <span className="text-2xl">⚡</span>
                  x402 Payments
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">
                  Native HTTP 402 protocol support. Sub-cent transactions, instant settlement,
                  zero chargebacks. Pay only for what you use.
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <span className="text-2xl">🆔</span>
                  ERC-8004 Identity
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">
                  On-chain agent identity and reputation. Interoperable across the ecosystem
                  with CAIP-2 chain-agnostic identifiers.
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <span className="text-2xl">🔍</span>
                  Discovery Service
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">
                  Public agent registry with search and filtering. Let users find your agents.
                  Build reputation over time.
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <span className="text-2xl">🌐</span>
                  Multi-Chain Native
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">
                  Deploy once, earn from 7+ blockchain networks. Base, Optimism, Arbitrum,
                  Polygon, Celo, Ethereum supported.
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <span className="text-2xl">🔌</span>
                  Multi-Platform
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">
                  Deploy to Discord, Telegram, Twitch, and Kick from a single interface.
                  Your AI never sleeps.
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <span className="text-2xl">📊</span>
                  Real-Time Analytics
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">
                  Track engagement, usage metrics, and revenue with comprehensive dashboards
                  and WebSocket logs.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Who Is It For Section */}
      <section className="py-12 sm:py-16 md:py-20 border-t">
        <div className="container mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12 sm:mb-16">
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold mb-3 sm:mb-4 px-4">
              Built for everyone in the ecosystem
            </h2>
            <p className="text-base sm:text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto px-4">
              Whether you&apos;re a creator, developer, or enterprise — PerkOS has you covered
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 sm:gap-8 max-w-5xl mx-auto">
            <Card className="border-perkos-orange/30 card-hover">
              <CardHeader>
                <CardTitle className="text-xl">For Customers</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  Stop paying for subscriptions you don&apos;t use. Pay exactly what you consume.
                </p>
                <ul className="text-sm space-y-1 text-muted-foreground">
                  <li>• Sub-cent transactions ($0.0001 minimum)</li>
                  <li>• Wallet-based identity, one signature</li>
                  <li>• Transparent pricing, on-chain audit trail</li>
                </ul>
              </CardContent>
            </Card>

            <Card className="border-perkos-pink/30 card-hover">
              <CardHeader>
                <CardTitle className="text-xl">For Vendors</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  Turn any endpoint into a revenue stream. One line of code. Instant payments.
                </p>
                <ul className="text-sm space-y-1 text-muted-foreground">
                  <li>• Near-zero fees on L2 networks</li>
                  <li>• Settlement in seconds, not weeks</li>
                  <li>• Zero fraud risk, USDC settlement</li>
                </ul>
              </CardContent>
            </Card>

            <Card className="border-perkos-purple/30 card-hover">
              <CardHeader>
                <CardTitle className="text-xl">For Developers</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  Focus on building features, not payment infrastructure.
                </p>
                <ul className="text-sm space-y-1 text-muted-foreground">
                  <li>• 10 npm packages, full TypeScript</li>
                  <li>• Ship in hours, not months</li>
                  <li>• Standards compliant (x402, ERC-8004)</li>
                </ul>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section className="py-12 sm:py-16 md:py-20 bg-muted" id="pricing">
        <div className="container mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12 sm:mb-16">
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold mb-3 sm:mb-4 px-4">
              Transparent, usage-based pricing
            </h2>
            <p className="text-base sm:text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto px-4">
              Pay only for what you use. No hidden fees. No subscriptions required.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 sm:gap-8 max-w-4xl mx-auto">
            {/* Spark Pricing */}
            <Card className="border-2 border-perkos-pink/50 card-hover">
              <CardHeader>
                <div className="flex items-center gap-2 mb-2">
                  <Image
                    src="/images/Spark-icon.png"
                    alt="Spark"
                    width={40}
                    height={40}
                    className="rounded-lg"
                  />
                  <CardTitle className="text-2xl">Spark Pricing</CardTitle>
                </div>
                <CardDescription>Pay-per-use micropayments via x402</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span>Sentiment Analysis</span>
                    <span className="font-mono">$0.001/call</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Content Moderation</span>
                    <span className="font-mono">$0.002/call</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Image Generation</span>
                    <span className="font-mono">$0.02/image</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Analytics Report</span>
                    <span className="font-mono">$0.10/report</span>
                  </div>
                </div>
                <p className="text-sm text-muted-foreground pt-2">
                  Fund your wallet with USDC. Set budgets. Stay in control.
                </p>
              </CardContent>
            </Card>

            {/* Stack Pricing */}
            <Card className="border-2 border-perkos-purple/50 card-hover">
              <CardHeader>
                <div className="flex items-center gap-2 mb-2">
                  <Image
                    src="/images/Stack-icon.png"
                    alt="Stack"
                    width={40}
                    height={40}
                    className="rounded-lg"
                  />
                  <CardTitle className="text-2xl">Stack Pricing</CardTitle>
                </div>
                <CardDescription>API usage tiers for developers</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <div>
                      <div className="font-semibold">Free</div>
                      <div className="text-sm text-muted-foreground">10,000 calls/month</div>
                    </div>
                    <span className="font-mono font-bold">$0</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <div>
                      <div className="font-semibold">Pro</div>
                      <div className="text-sm text-muted-foreground">100,000 calls/month</div>
                    </div>
                    <span className="font-mono font-bold">$49</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <div>
                      <div className="font-semibold">Scale</div>
                      <div className="text-sm text-muted-foreground">1M calls/month</div>
                    </div>
                    <span className="font-mono font-bold">$299</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <div>
                      <div className="font-semibold">Enterprise</div>
                      <div className="text-sm text-muted-foreground">Unlimited + SLA</div>
                    </div>
                    <span className="font-mono font-bold">Custom</span>
                  </div>
                </div>
                <p className="text-sm text-muted-foreground pt-2">
                  x402 services billed separately at published rates
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Contact Section */}
      <section className="py-12 sm:py-16 md:py-20 bg-muted" id="contact">
        <div className="container mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 sm:gap-12 max-w-6xl mx-auto">
            <div className="space-y-6">
              <div>
                <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold mb-3 sm:mb-4">
                  Let&apos;s Build Together
                </h2>
                <p className="text-base sm:text-lg text-muted-foreground">
                  Have questions about PerkOS? Want to explore partnerships? Looking to integrate
                  x402 payments? We&apos;d love to hear from you.
                </p>
              </div>

              <div className="space-y-4">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-lg bg-perkos-orange/10 flex items-center justify-center shrink-0">
                    <span>📧</span>
                  </div>
                  <div>
                    <h3 className="font-semibold">General Inquiries</h3>
                    <p className="text-sm text-muted-foreground">contact@perkos.xyz</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-lg bg-perkos-pink/10 flex items-center justify-center shrink-0">
                    <span>🤝</span>
                  </div>
                  <div>
                    <h3 className="font-semibold">Partnerships</h3>
                    <p className="text-sm text-muted-foreground">partner@perkos.xyz</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-lg bg-perkos-purple/10 flex items-center justify-center shrink-0">
                    <span>💼</span>
                  </div>
                  <div>
                    <h3 className="font-semibold">Investors</h3>
                    <p className="text-sm text-muted-foreground">invest@perkos.xyz</p>
                  </div>
                </div>
              </div>

              <div className="flex gap-4 pt-4">
                <Button variant="outline" size="sm" asChild>
                  <Link href="https://twitter.com/PerkOS_xyz">Twitter</Link>
                </Button>
                <Button variant="outline" size="sm" asChild>
                  <Link href="https://github.com/PerkOS-xyz">GitHub</Link>
                </Button>
                <Button variant="outline" size="sm" asChild>
                  <Link href="#">Discord</Link>
                </Button>
              </div>
            </div>

            <div>
              <ContactForm />
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-12 sm:py-16 md:py-20 bg-gradient-to-t from-muted to-background" id="get-started">
        <div className="container mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="max-w-3xl mx-auto text-center space-y-6 sm:space-y-8">
            <h2 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold px-4">
              Ready to build the future?
            </h2>
            <p className="text-base sm:text-lg md:text-xl text-muted-foreground px-4">
              Join the agentic economy. Launch agents, build infrastructure, and monetize AI
              with instant micropayments.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 justify-center px-4">
              <Button size="lg" className="w-full sm:w-auto bg-perkos-gradient hover:opacity-90 glow-pink min-w-[180px]" asChild>
                <Link href="https://spark.perkos.xyz">
                  Launch with Spark
                </Link>
              </Button>
              <Button size="lg" className="w-full sm:w-auto bg-perkos-purple hover:bg-perkos-magenta min-w-[180px]" asChild>
                <Link href="https://stack.perkos.xyz">
                  Build with Stack
                </Link>
              </Button>
              <Button size="lg" variant="outline" className="w-full sm:w-auto min-w-[180px] border-perkos-pink/50 hover:border-perkos-pink hover:bg-perkos-pink/10" asChild>
                <Link href="https://github.com/PerkOS-xyz/PerkOS">
                  View on GitHub
                </Link>
              </Button>
            </div>
            <div className="pt-4 sm:pt-8">
              <code className="text-sm bg-muted px-4 py-2 rounded-lg">
                npm install @perkos/service-x402
              </code>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t py-8 sm:py-12 bg-muted">
        <div className="container mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-6 sm:gap-8">
            <div className="col-span-2 md:col-span-1">
              <div className="flex items-center gap-2 mb-4">
                <Image
                  src="/images/PerkOS-icon.png"
                  alt="PerkOS"
                  width={32}
                  height={32}
                  className="rounded-lg"
                />
                <span className="font-bold">PerkOS</span>
              </div>
              <p className="text-sm text-muted-foreground">
                The Operating System for AI Agents
              </p>
            </div>
            <div>
              <h3 className="font-semibold mb-4">Products</h3>
              <ul className="space-y-2 text-sm">
                <li>
                  <Link href="https://spark.perkos.xyz" className="text-muted-foreground hover:text-foreground">
                    Spark
                  </Link>
                </li>
                <li>
                  <Link href="https://stack.perkos.xyz" className="text-muted-foreground hover:text-foreground">
                    Stack
                  </Link>
                </li>
                <li>
                  <Link href="https://www.npmjs.com/org/perkos" className="text-muted-foreground hover:text-foreground">
                    npm Packages
                  </Link>
                </li>
              </ul>
            </div>
            <div>
              <h3 className="font-semibold mb-4">Resources</h3>
              <ul className="space-y-2 text-sm">
                <li>
                  <Link href="https://github.com/PerkOS-xyz/PerkOS" className="text-muted-foreground hover:text-foreground">
                    Documentation
                  </Link>
                </li>
                <li>
                  <Link href="https://github.com/PerkOS-xyz" className="text-muted-foreground hover:text-foreground">
                    GitHub
                  </Link>
                </li>
                <li>
                  <Link href="https://www.x402.org/" className="text-muted-foreground hover:text-foreground">
                    x402 Protocol
                  </Link>
                </li>
              </ul>
            </div>
            <div>
              <h3 className="font-semibold mb-4">Community</h3>
              <ul className="space-y-2 text-sm">
                <li>
                  <Link href="#" className="text-muted-foreground hover:text-foreground">
                    Discord
                  </Link>
                </li>
                <li>
                  <Link href="https://twitter.com/PerkOS_xyz" className="text-muted-foreground hover:text-foreground">
                    Twitter
                  </Link>
                </li>
              </ul>
            </div>
            <div>
              <h3 className="font-semibold mb-4">Contact</h3>
              <ul className="space-y-2 text-sm">
                <li>
                  <Link href="#contact" className="text-muted-foreground hover:text-foreground">
                    Contact Form
                  </Link>
                </li>
                <li>
                  <Link href="mailto:contact@perkos.xyz" className="text-muted-foreground hover:text-foreground">
                    contact@perkos.xyz
                  </Link>
                </li>
                <li>
                  <Link href="mailto:partner@perkos.xyz" className="text-muted-foreground hover:text-foreground">
                    partner@perkos.xyz
                  </Link>
                </li>
              </ul>
            </div>
          </div>
          <div className="mt-6 sm:mt-8 pt-6 sm:pt-8 border-t text-center text-xs sm:text-sm text-muted-foreground">
            <p>© 2025 PerkOS. Built for the agentic economy.</p>
            <p className="mt-2">Spark ignites. Stack powers.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
