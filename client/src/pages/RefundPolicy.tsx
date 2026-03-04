import { Link } from "wouter";
import { ArrowLeft } from "lucide-react";
import { AppLogo } from "@/components/AppLogo";

const sections = [
  {
    number: "1",
    title: "Overview",
    content: (
      <p className="text-muted-foreground leading-relaxed">
        Expense Roaster is a digital subscription service that provides AI-generated financial analysis,
        receipt roasting, bank statement insights, and behavioral spending feedback. Because the service
        provides immediate digital access and on-demand AI processing, refunds are limited and subject
        to the conditions outlined below.
      </p>
    ),
  },
  {
    number: "2",
    title: "Subscription Refunds (Premium Plan)",
    content: (
      <div className="space-y-3 text-muted-foreground leading-relaxed">
        <p>We offer refunds within 24 hours of the initial subscription purchase under the following conditions:</p>
        <ul className="space-y-2 ml-4">
          {[
            "The refund request is submitted within 24 hours of the original payment.",
            "No meaningful usage of Premium features has occurred.",
            "No AI-generated roasts, financial analysis, bank statement uploads, reports, or behavioral insights have been generated under the Premium plan.",
          ].map((item) => (
            <li key={item} className="flex items-start gap-2">
              <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-[hsl(var(--primary))] shrink-0" />
              <span>{item}</span>
            </li>
          ))}
        </ul>
        <p>If Premium features have been used in any capacity, the subscription becomes non-refundable.</p>
        <p>Refunds are not available for subscription renewal charges.</p>
        <p>
          Subscriptions may be canceled at any time. Cancellation prevents future billing but does not
          retroactively refund prior payments.
        </p>
      </div>
    ),
  },
  {
    number: "3",
    title: "One-Time Purchases (Reports or Add-Ons)",
    content: (
      <div className="space-y-3 text-muted-foreground leading-relaxed">
        <p>
          All one-time digital purchases, including but not limited to annual financial reports or deep
          analysis features, are final and non-refundable once the report or analysis has been generated.
        </p>
        <p>
          Due to the immediate digital delivery and AI processing costs, refunds are not provided after
          report generation.
        </p>
      </div>
    ),
  },
  {
    number: "4",
    title: "Abuse & Fraud Prevention",
    content: (
      <div className="space-y-3 text-muted-foreground leading-relaxed">
        <p>Expense Roaster reserves the right to deny refund requests in cases of:</p>
        <ul className="space-y-2 ml-4">
          {[
            "Suspected abuse of the service",
            "Excessive usage prior to refund request",
            "Multiple refund attempts",
            "Fraudulent activity",
          ].map((item) => (
            <li key={item} className="flex items-start gap-2">
              <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-[hsl(var(--primary))] shrink-0" />
              <span>{item}</span>
            </li>
          ))}
        </ul>
      </div>
    ),
  },
  {
    number: "5",
    title: "How to Request a Refund",
    content: (
      <div className="space-y-3 text-muted-foreground leading-relaxed">
        <p>To request a refund within the 24-hour window, please contact us via the <Link href="/contact" className="text-[hsl(var(--primary))] hover:underline">contact page</Link>.</p>
        <p>Include:</p>
        <ul className="space-y-2 ml-4">
          {[
            "The email associated with your account",
            "Date and time of purchase",
            "A brief explanation of your request",
          ].map((item) => (
            <li key={item} className="flex items-start gap-2">
              <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-[hsl(var(--primary))] shrink-0" />
              <span>{item}</span>
            </li>
          ))}
        </ul>
        <p>
          Approved refunds will be processed to the original payment method within 5–10 business days,
          depending on your financial institution.
        </p>
      </div>
    ),
  },
  {
    number: "6",
    title: "Policy Updates",
    content: (
      <p className="text-muted-foreground leading-relaxed">
        Expense Roaster reserves the right to update this Refund Policy at any time. Continued use of
        the service after updates constitutes acceptance of the revised policy.
      </p>
    ),
  },
];

export default function RefundPolicy() {
  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-2xl mx-auto px-4 py-16">

        {/* Header */}
        <div className="mb-12">
          <Link href="/" data-testid="link-back-home">
            <div className="inline-flex items-center gap-2 text-muted-foreground hover:text-white transition-colors mb-8 cursor-pointer">
              <ArrowLeft className="w-4 h-4" />
              <span className="text-sm">Back to home</span>
            </div>
          </Link>

          <div className="mb-6">
            <AppLogo size="xs" />
          </div>

          <h1 className="text-4xl font-bold text-white mb-2">Refund Policy</h1>
          <p className="text-muted-foreground text-sm">Last updated: March 2026</p>
        </div>

        {/* Sections */}
        <div className="space-y-10">
          {sections.map((section) => (
            <div key={section.number} className="glass-panel rounded-2xl p-6 border border-white/[0.06]">
              <div className="flex items-center gap-3 mb-4">
                <span className="w-7 h-7 rounded-lg bg-[hsl(var(--primary))]/15 border border-[hsl(var(--primary))]/25 flex items-center justify-center text-[hsl(var(--primary))] text-xs font-bold shrink-0">
                  {section.number}
                </span>
                <h2 className="text-lg font-bold text-white">{section.title}</h2>
              </div>
              {section.content}
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="mt-12 pt-8 border-t border-white/5 text-center text-muted-foreground text-sm">
          <p>Expense Roaster &copy; 2026</p>
        </div>
      </div>
    </div>
  );
}
