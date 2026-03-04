import { Link } from "wouter";
import { ArrowLeft } from "lucide-react";
import { AppLogo } from "@/components/AppLogo";

export default function TermsOfService() {
  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-2xl mx-auto px-4 py-16">

        <div className="mb-12">
          <Link href="/" data-testid="link-back-home-tos">
            <div className="inline-flex items-center gap-2 text-muted-foreground hover:text-white transition-colors mb-8 cursor-pointer">
              <ArrowLeft className="w-4 h-4" />
              <span className="text-sm">Back to home</span>
            </div>
          </Link>
          <div className="mb-6">
            <AppLogo size="xs" />
          </div>
          <h1 className="text-4xl font-bold text-white mb-2">Terms of Service</h1>
          <p className="text-muted-foreground text-sm">Last updated: March 3, 2026</p>
        </div>

        <div className="space-y-10">

          <Section number="1" title="Acceptance of Terms">
            <p>
              By accessing or using Expense Roaster, you agree to these Terms of Service. If you do not
              agree, do not use the Service.
            </p>
          </Section>

          <Section number="2" title="Description of Service">
            <div className="space-y-3">
              <p>
                Expense Roaster provides AI-powered financial behavior insights, receipt analysis,
                spending tracking, and subscription-based features.
              </p>
              <p>The Service is provided for informational and educational purposes only.</p>
            </div>
          </Section>

          <Section number="3" title="Not Financial Advice">
            <div className="space-y-3">
              <p>
                Expense Roaster does not provide financial, legal, tax, or investment advice. All
                insights and analysis are informational only and should not be relied upon as professional
                advice.
              </p>
              <p>You are responsible for your financial decisions.</p>
            </div>
          </Section>

          <Section number="4" title="User Responsibilities">
            <div className="space-y-3">
              <p>You agree to:</p>
              <BulletList items={[
                "Provide accurate information",
                "Use the service lawfully",
                "Not attempt to exploit, reverse-engineer, or abuse the system",
                "Not upload malicious or illegal content",
              ]} />
            </div>
          </Section>

          <Section number="5" title="Subscriptions & Billing">
            <div className="space-y-3">
              <p>Premium features require a paid subscription. By subscribing, you authorize recurring charges to your payment method.</p>
              <p>Subscriptions:</p>
              <BulletList items={[
                "Renew automatically unless canceled",
                "May be canceled at any time before renewal",
                "Do not provide refunds beyond the stated Refund Policy",
              ]} />
            </div>
          </Section>

          <Section number="6" title="Refund Policy">
            <p>
              Refunds are governed by our{" "}
              <Link href="/refund-policy" className="text-[hsl(var(--primary))] hover:underline">
                Refund Policy
              </Link>
              . By subscribing, you acknowledge and agree to that policy.
            </p>
          </Section>

          <Section number="7" title="Account Termination">
            <div className="space-y-3">
              <p>We reserve the right to suspend or terminate accounts that:</p>
              <BulletList items={[
                "Violate these Terms",
                "Engage in fraudulent activity",
                "Abuse refund policies",
                "Attempt to exploit system limits",
              ]} />
            </div>
          </Section>

          <Section number="8" title="Intellectual Property">
            <p>
              All branding, software, design, and AI outputs are property of Expense Roaster. You may
              not copy, reproduce, or distribute our materials without permission.
            </p>
          </Section>

          <Section number="9" title="Limitation of Liability">
            <div className="space-y-3">
              <p>Expense Roaster is provided "as is." We are not liable for:</p>
              <BulletList items={[
                "Financial losses",
                "Inaccurate analysis",
                "Service interruptions",
                "Data loss",
                "Third-party service failures",
              ]} />
              <p>
                To the fullest extent permitted by law, our liability is limited to the amount paid for
                the service in the preceding 30 days.
              </p>
            </div>
          </Section>

          <Section number="10" title="Governing Law">
            <p>
              These Terms shall be governed by the laws of the applicable jurisdiction in which Expense
              Roaster operates.
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
