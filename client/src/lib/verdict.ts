export type VerdictSegment =
  | { type: 'text';     text: string }
  | { type: 'bold';     text: string }
  | { type: 'italic';   text: string }
  | { type: 'currency'; text: string }
  | { type: 'count';    text: string }
  | { type: 'category'; text: string; color: string };

export const VERDICT_CATEGORY_COLORS: Record<string, string> = {
  'food & drink':    '#E85D26',
  'groceries':       '#78A856',
  'shopping':        '#C4A832',
  'transport':       '#3BB8A0',
  'travel':          '#3B8EB8',
  'entertainment':   '#E8526A',
  'health & fitness':'#5BA85E',
  'health':          '#5BA85E',
  'subscriptions':   '#7B6FE8',
  'coffee':          '#C4A832',
  'donations':       '#5BA8A8',
  'insurance':       '#5B8EC4',
  'professional fees':'#A07850',
  'membership dues': '#C49A3C',
  'internet':        '#4A7BE8',
  'phone':           '#9B5BE8',
  'other':           '#4A5060',
};

const CATEGORY_NAMES = [
  'Food & Drink', 'Groceries', 'Shopping', 'Transport', 'Travel',
  'Entertainment', 'Health & Fitness', 'Health', 'Subscriptions', 'Coffee',
  'Donations', 'Insurance', 'Professional Fees', 'Membership Dues', 'Internet', 'Phone', 'Other',
];

const CURRENCY_RE = /^(?:S\$|CA\$|A\$|NZ\$|HK\$|MX\$|US\$|AU\$|C\$|[$£€¥₹])\s*[\d,]+(?:\.\d{1,2})?(?:\s*(?:SGD|USD|GBP|EUR|CAD|AUD|JPY|INR|CHF|MXN|HKD|NZD))?$/i;
const COUNT_RE   = /^(?:\d+|one|two|three|four|five|six|seven|eight|nine|ten)\s+(?:receipts?|transactions?|items?)$|^\d+%$/i;
const CAT_RE     = new RegExp(`^(${CATEGORY_NAMES.join('|')})$`, 'i');

function classifyBoldContent(inner: string): VerdictSegment {
  const t = inner.trim();
  if (CURRENCY_RE.test(t)) return { type: 'currency', text: inner };
  if (COUNT_RE.test(t))    return { type: 'count',    text: inner };
  const cat = CAT_RE.exec(t);
  if (cat) {
    return { type: 'category', text: inner, color: VERDICT_CATEGORY_COLORS[cat[1].toLowerCase()] ?? '#4A5060' };
  }
  return { type: 'bold', text: inner };
}

function splitPlainTextByCategories(text: string): VerdictSegment[] {
  const re = new RegExp(`\\b(${CATEGORY_NAMES.join('|')})\\b`, 'gi');
  const segs: VerdictSegment[] = [];
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) segs.push({ type: 'text', text: text.slice(last, m.index) });
    segs.push({ type: 'category', text: m[1], color: VERDICT_CATEGORY_COLORS[m[1].toLowerCase()] ?? '#4A5060' });
    last = m.index + m[0].length;
  }
  if (last < text.length) segs.push({ type: 'text', text: text.slice(last) });
  return segs;
}

export function parseVerdict(raw: string): VerdictSegment[] {
  const text = raw
    .replace(/—/g, ' - ')
    .replace(/\s{2,}/g, ' ')
    .trim();

  const result: VerdictSegment[] = [];
  const parts = text.split(/(\*\*[^*]+?\*\*|\*[^*]+?\*)/);

  for (const part of parts) {
    if (part.startsWith('**') && part.endsWith('**')) {
      result.push(classifyBoldContent(part.slice(2, -2)));
    } else if (part.startsWith('*') && part.endsWith('*')) {
      result.push({ type: 'italic', text: part.slice(1, -1) });
    } else {
      result.push(...splitPlainTextByCategories(part));
    }
  }

  return result;
}
