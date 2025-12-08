import Image from "next/image";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

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
                width={100}
                height={100}
                className="w-20 h-20 sm:w-28 sm:h-28 md:w-32 md:h-32 rounded-2xl"
              />
            </div>
            <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight px-4">
              The Operating System for AI Agents
            </h1>
            <p className="text-lg sm:text-xl md:text-2xl text-muted-foreground max-w-2xl px-4">
              Build, deploy, and monetize AI agents across multiple platforms.
              Web3-native infrastructure for the agentic economy.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 w-full sm:w-auto px-4">
              <Button size="lg" className="w-full sm:w-auto min-w-[200px]" asChild>
                <Link href="#spark">Launch Your Agent</Link>
              </Button>
              <Button size="lg" variant="outline" className="w-full sm:w-auto min-w-[200px]" asChild>
                <Link href="#stack">Developer Docs</Link>
              </Button>
            </div>
            <div className="flex flex-col sm:flex-row items-center gap-3 sm:gap-8 text-xs sm:text-sm text-muted-foreground px-4">
              <div className="flex items-center gap-2">
                <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
                <span>Live on Testnet</span>
              </div>
              <span className="hidden sm:inline">•</span>
              <span>x402 Payments</span>
              <span className="hidden sm:inline">•</span>
              <span>ERC-8004 Identity</span>
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
            <Card className="relative overflow-hidden border-2 hover:border-orange-500 transition-colors" id="spark">
              <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-orange-500/20 to-transparent rounded-bl-full" />
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
                    <CardDescription className="text-base">Ignite your community</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-muted-foreground">
                  No-code AI agent launcher for communities. Create intelligent agents with personality in minutes.
                </p>
                <ul className="space-y-2">
                  <li className="flex items-start gap-2">
                    <span className="text-orange-500">⚡</span>
                    <span>5-minute setup, no coding required</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-orange-500">🎨</span>
                    <span>Visual character & personality editor</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-orange-500">🔌</span>
                    <span>Discord, Telegram, Twitch, Kick support</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-orange-500">💰</span>
                    <span>Built-in x402 micropayments</span>
                  </li>
                </ul>
                <div className="pt-4 space-y-2">
                  <Button className="w-full bg-orange-500 hover:bg-orange-600" asChild>
                    <Link href="https://github.com/PerkOS-xyz/Spark">View Spark on GitHub</Link>
                  </Button>
                  <p className="text-xs text-center text-muted-foreground">
                    For community managers, creators, Web3 projects
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Stack Card */}
            <Card className="relative overflow-hidden border-2 hover:border-blue-500 transition-colors" id="stack">
              <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-blue-500/20 to-transparent rounded-bl-full" />
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
                    <CardDescription className="text-base">The infrastructure behind the spark</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-muted-foreground">
                  Production-ready middleware for agent-powered applications. APIs, payments, identity—all in one.
                </p>
                <ul className="space-y-2">
                  <li className="flex items-start gap-2">
                    <span className="text-blue-500">🔌</span>
                    <span>Complete REST API for agent management</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-blue-500">💳</span>
                    <span>x402 Facilitator for micropayments</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-blue-500">🔍</span>
                    <span>Discovery service & agent registry</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-blue-500">🆔</span>
                    <span>ERC-8004 reputation system</span>
                  </li>
                </ul>
                <div className="pt-4 space-y-2">
                  <Button className="w-full bg-blue-500 hover:bg-blue-600" asChild>
                    <Link href="https://github.com/PerkOS-xyz/Stack">View Stack on GitHub</Link>
                  </Button>
                  <p className="text-xs text-center text-muted-foreground">
                    For developers, enterprises, blockchain startups
                  </p>
                </div>
              </CardContent>
            </Card>
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
                  Native HTTP 402 protocol support for micropayments. Pay only for what you use.
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
                  On-chain agent identity and reputation. Interoperable across the ecosystem.
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
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <span className="text-2xl">🤖</span>
                  ElizaOS Runtime
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">
                  Powerful agent runtime with multi-platform support and intelligent processing.
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
                  Track engagement, usage metrics, and performance with WebSocket logs.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section className="py-12 sm:py-16 md:py-20" id="pricing">
        <div className="container mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12 sm:mb-16">
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold mb-3 sm:mb-4 px-4">
              Transparent, usage-based pricing
            </h2>
            <p className="text-base sm:text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto px-4">
              Pay only for what you use. No hidden fees.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 sm:gap-8 max-w-4xl mx-auto">
            {/* Spark Pricing */}
            <Card className="border-2 border-orange-500/50">
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
            <Card className="border-2 border-blue-500/50">
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
                <CardDescription>API usage tiers</CardDescription>
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
                      <div className="text-sm text-muted-foreground">Unlimited</div>
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

      {/* CTA Section */}
      <section className="py-12 sm:py-16 md:py-20 bg-gradient-to-t from-muted to-background" id="get-started">
        <div className="container mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="max-w-3xl mx-auto text-center space-y-6 sm:space-y-8">
            <h2 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold px-4">
              Ready to build the future?
            </h2>
            <p className="text-base sm:text-lg md:text-xl text-muted-foreground px-4">
              Join the agentic economy. Launch agents, build infrastructure, and monetize AI.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 justify-center px-4">
              <Button size="lg" className="w-full sm:w-auto bg-orange-500 hover:bg-orange-600 min-w-[180px]" asChild>
                <Link href="https://spark.perkos.xyz">
                  Launch with Spark
                </Link>
              </Button>
              <Button size="lg" className="w-full sm:w-auto bg-blue-500 hover:bg-blue-600 min-w-[180px]" asChild>
                <Link href="https://stack.perkos.xyz">
                  Build with Stack
                </Link>
              </Button>
              <Button size="lg" variant="outline" className="w-full sm:w-auto min-w-[180px]" asChild>
                <Link href="https://github.com/PerkOS-xyz/PerkOS">
                  View on GitHub
                </Link>
              </Button>
            </div>
            <div className="pt-4 sm:pt-8 text-xs sm:text-sm text-muted-foreground px-4">
              <p>Questions? Join our Discord or check the documentation</p>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t py-8 sm:py-12 bg-muted">
        <div className="container mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 sm:gap-8">
            <div>
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
                  <Link href="#spark" className="text-muted-foreground hover:text-foreground">
                    Spark
                  </Link>
                </li>
                <li>
                  <Link href="#stack" className="text-muted-foreground hover:text-foreground">
                    Stack
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
          </div>
          <div className="mt-6 sm:mt-8 pt-6 sm:pt-8 border-t text-center text-xs sm:text-sm text-muted-foreground">
            <p>© 2024 PerkOS. Built for the agentic economy.</p>
            <p className="mt-2">Spark ignites. Stack powers.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
