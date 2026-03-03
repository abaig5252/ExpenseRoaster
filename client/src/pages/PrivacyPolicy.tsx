import { Link } from "wouter";
import { Flame, ArrowLeft } from "lucide-react";

export default function PrivacyPolicy() {
  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-2xl mx-auto px-4 py-16">

        <div className="mb-12">
          <Link href="/" data-testid="link-back-home-privacy">
            <div className="inline-flex items-center gap-2 text-muted-foreground hover:text-white transition-colors mb-8 cursor-pointer">
              <ArrowLeft className="w-4 h-4" />
              <span className="text-sm">Back to home</span>
            </div>
          </Link>
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[hsl(var(--primary))] to-[hsl(var(--secondary))] flex items-center justify-center">
              <Flame className="w-5 h-5 text-white" />
            </div>
            <span className="font-display font-black text-white text-xl">Expense Roaster</span>
          </div>
          <h1 className="text-4xl font-bold text-white mb-2">Privacy Policy</h1>
          <p className="text-muted-foreground text-sm">Last updated: March 3, 2026</p>
        </div>

        <div className="space-y-10">

          <Section number="1" title="Introduction">
            <p>
              Expense Roaster ("we," "our," or "us") respects your privacy and is committed to protecting
              your personal information. This Privacy Policy explains how we collect, use, store, and
              protect information when you use our website and services (the "Service"). By using Expense
              Roaster, you agree to the practices described in this policy.
            </p>
          </Section>

          <Section number="2" title="Information We Collect">
            <div className="space-y-5">
              <div>
                <p className="text-white font-semibold mb-2">A. Account Information</p>
                <BulletList items={[
                  "Name (if provided)",
                  "Email address",
                  "Subscription status",
                  "Billing-related metadata (processed securely via Stripe)",
                ]} />
                <p className="mt-2">We do not store full credit card details.</p>
              </div>
              <div>
                <p className="text-white font-semibold mb-2">B. Financial Data You Upload</p>
                <p className="mb-2">When you use Expense Roaster, you may upload:</p>
                <BulletList items={[
                  "Receipt images",
                  "Bank statement CSV files",
                  "Transaction data",
                  "Spending records",
                ]} />
                <p className="mt-2">This data is used solely to generate AI-based financial insights and behavioral analysis.</p>
              </div>
              <div>
                <p className="text-white font-semibold mb-2">C. Usage Data</p>
                <p className="mb-2">We may collect:</p>
                <BulletList items={[
                  "Log data",
                  "IP address",
                  "Device type",
                  "Browser type",
                  "Pages visited",
                  "Feature usage",
                ]} />
                <p className="mt-2">This helps improve performance and security.</p>
              </div>
              <div>
                <p className="text-white font-semibold mb-2">D. Cookies</p>
                <p className="mb-2">We may use cookies or similar technologies for:</p>
                <BulletList items={[
                  "Authentication",
                  "Session management",
                  "Analytics",
                ]} />
                <p className="mt-2">You may disable cookies via your browser settings.</p>
              </div>
            </div>
          </Section>

          <Section number="3" title="How We Use Your Information">
            <div className="space-y-3">
              <p>We use collected data to:</p>
              <BulletList items={[
                "Provide financial analysis and AI-generated insights",
                "Process subscriptions and payments",
                "Improve our services",
                "Monitor usage and prevent abuse",
                "Communicate with you about your account",
              ]} />
              <p>We do not sell your personal or financial data.</p>
            </div>
          </Section>

          <Section number="4" title="AI Processing">
            <div className="space-y-3">
              <p>
                Uploaded financial data may be processed through third-party AI service providers to
                generate insights and analysis.
              </p>
              <p>We do not use your financial data to train public AI models.</p>
            </div>
          </Section>

          <Section number="5" title="Data Storage & Security">
            <div className="space-y-3">
              <p>We implement reasonable technical and organizational measures to protect your information, including:</p>
              <BulletList items={[
                "Encrypted data transmission (HTTPS)",
                "Secure authentication systems",
                "Restricted internal access",
                "Cloud-based storage security measures",
              ]} />
              <p>However, no system is 100% secure, and we cannot guarantee absolute security.</p>
            </div>
          </Section>

          <Section number="6" title="Data Retention">
            <div className="space-y-3">
              <p>We retain your data:</p>
              <BulletList items={[
                "While your account is active",
                "As needed to provide services",
                "As required for legal or compliance purposes",
              ]} />
              <p>
                You may request deletion of your data at any time (see{" "}
                <Link href="/data-deletion" className="text-[hsl(var(--primary))] hover:underline">
                  Data Deletion Policy
                </Link>
                ).
              </p>
            </div>
          </Section>

          <Section number="7" title="Third-Party Services">
            <div className="space-y-3">
              <p>We use trusted third-party providers, including but not limited to:</p>
              <BulletList items={[
                "Stripe (payment processing)",
                "Cloud hosting providers",
                "AI service providers",
                "Analytics platforms",
              ]} />
              <p>These providers may process data necessary to perform their services.</p>
            </div>
          </Section>

          <Section number="8" title="Your Rights">
            <div className="space-y-3">
              <p>Depending on your jurisdiction, you may have the right to:</p>
              <BulletList items={[
                "Access your personal data",
                "Request correction",
                "Request deletion",
                "Withdraw consent",
                "Request data portability",
              ]} />
              <p>
                To exercise these rights,{" "}
                <Link href="/contact" className="text-[hsl(var(--primary))] hover:underline">contact us</Link>.
              </p>
            </div>
          </Section>

          <Section number="9" title="Children's Privacy">
            <p>Expense Roaster is not intended for individuals under the age of 18.</p>
          </Section>

          <Section number="10" title="Changes to This Policy">
            <p>
              We may update this Privacy Policy from time to time. Continued use of the Service after
              changes constitutes acceptance.
            </p>
          </Section>

        </div>

        <div className="mt-12 pt-8 border-t border-white/5 text-center text-muted-foreground text-sm">
          <p>Expense Roaster &copy; 2026</p>
        </div>
      </div>
    </div>
  );
}

function Section({ number, title, children }: { number: string; title: string; children: React.ReactNode }) {
  return (
    <div className="glass-panel rounded-2xl p-6 border border-white/[0.06]">
      <div className="flex items-center gap-3 mb-4">
        <span className="w-7 h-7 rounded-lg bg-[hsl(var(--primary))]/15 border border-[hsl(var(--primary))]/25 flex items-center justify-center text-[hsl(var(--primary))] text-xs font-bold shrink-0">
          {number}
        </span>
        <h2 className="text-lg font-bold text-white">{title}</h2>
      </div>
      <div className="text-muted-foreground leading-relaxed">{children}</div>
    </div>
  );
}

function BulletList({ items }: { items: string[] }) {
  return (
    <ul className="space-y-2 ml-4">
      {items.map((item) => (
        <li key={item} className="flex items-start gap-2">
          <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-[hsl(var(--primary))] shrink-0" />
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}
