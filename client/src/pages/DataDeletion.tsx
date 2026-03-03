import { Link } from "wouter";
import { Flame, ArrowLeft } from "lucide-react";

export default function DataDeletion() {
  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-2xl mx-auto px-4 py-16">

        <div className="mb-12">
          <Link href="/" data-testid="link-back-home-data-deletion">
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
          <h1 className="text-4xl font-bold text-white mb-2">Data Deletion Policy</h1>
          <p className="text-muted-foreground text-sm">Last updated: March 3, 2026</p>
        </div>

        <p className="text-muted-foreground mb-10 leading-relaxed">
          Expense Roaster respects your right to control your data.
        </p>

        <div className="space-y-10">

          <Section number="1" title="Account Deletion">
            <div className="space-y-3">
              <p>You may request deletion of your account at any time by:</p>
              <BulletList items={[
                "Using the in-app delete feature (if available), or",
                "Contacting us via the contact page",
              ]} note={
                <Link href="/contact" className="text-[hsl(var(--primary))] hover:underline">Contact us here</Link>
              } />
              <p>Upon verified request, we will:</p>
              <BulletList items={[
                "Delete your account",
                "Remove associated financial data",
                "Remove stored receipts and transaction records",
              ]} />
              <p>All deletion requests are processed within 30 days.</p>
            </div>
          </Section>

          <Section number="2" title="Immediate Effects">
            <div className="space-y-3">
              <p>After deletion:</p>
              <BulletList items={[
                "You will lose access to your account",
                "All saved financial analysis will be permanently removed",
                "Subscriptions must be canceled prior to deletion",
              ]} />
              <p className="text-white/80 font-medium">Deletion cannot be undone.</p>
            </div>
          </Section>

          <Section number="3" title="Backup Retention">
            <div className="space-y-3">
              <p>We may retain limited data in encrypted backups for a short period for:</p>
              <BulletList items={[
                "Security",
                "Legal compliance",
                "Fraud prevention",
              ]} />
              <p>Such data will not be used for active processing.</p>
            </div>
          </Section>

          <Section number="4" title="Legal Retention">
            <p>
              We may retain certain billing or transactional records as required by law.
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

function BulletList({ items, note }: { items: string[]; note?: React.ReactNode }) {
  return (
    <ul className="space-y-2 ml-4">
      {items.map((item) => (
        <li key={item} className="flex items-start gap-2">
          <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-[hsl(var(--primary))] shrink-0" />
          <span>{item}</span>
        </li>
      ))}
      {note && (
        <li className="flex items-start gap-2 ml-0 mt-1">
          <span className="text-sm">{note}</span>
        </li>
      )}
    </ul>
  );
}
