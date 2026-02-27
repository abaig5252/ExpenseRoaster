import { getUncachableStripeClient } from "../server/stripe/stripeClient";

async function seed() {
  const stripe = await getUncachableStripeClient();

  console.log("Seeding Stripe products...");

  // Check if Premium already exists
  const existing = await stripe.products.search({ query: "name:'RoastMyWallet Premium'" });
  if (existing.data.length > 0) {
    console.log("Products already exist. Listing current products:");
    const prices = await stripe.prices.list({ active: true, limit: 10 });
    for (const price of prices.data) {
      console.log(`Price ID: ${price.id} — ${price.unit_amount}¢ — ${price.recurring?.interval || "one_time"} — metadata:`, price.metadata);
    }
    return;
  }

  // Premium subscription: $9.99/month
  const premium = await stripe.products.create({
    name: "RoastMyWallet Premium",
    description: "Unlimited receipt uploads, CSV imports, historical tracking, roast tone selector, monthly summaries, and AI financial advice.",
    metadata: { plan: "premium" },
  });

  const premiumPrice = await stripe.prices.create({
    product: premium.id,
    unit_amount: 999,
    currency: "usd",
    recurring: { interval: "month" },
    metadata: { plan: "premium" },
  });

  console.log(`✅ Premium product: ${premium.id}`);
  console.log(`✅ Premium price: ${premiumPrice.id} ($9.99/mo)`);

  // Annual Report: $29.99 one-time payment
  const annualProduct = await stripe.products.create({
    name: "Annual Roast Report",
    description: "One-time purchase. Get a brutal AI analysis of your full year of spending: behavioral insights, 5-year projection, and 3 improvement suggestions. Downloadable PDF.",
    metadata: { plan: "annual_report" },
  });

  const annualPrice = await stripe.prices.create({
    product: annualProduct.id,
    unit_amount: 2999,
    currency: "usd",
    metadata: { plan: "annual_report" },
  });

  console.log(`✅ Annual Report product: ${annualProduct.id}`);
  console.log(`✅ Annual Report price: ${annualPrice.id} ($29.99 one-time)`);
  console.log("\nSeeding complete!");
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
