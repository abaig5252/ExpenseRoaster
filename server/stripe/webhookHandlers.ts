import { getStripeSync } from "./stripeClient";
import { storage } from "../storage";

export class WebhookHandlers {
  static async processWebhook(payload: Buffer, signature: string): Promise<void> {
    if (!Buffer.isBuffer(payload)) {
      throw new Error("Payload must be a Buffer — ensure webhook route is before express.json()");
    }
    const sync = await getStripeSync();
    await sync.processWebhook(payload, signature);
  }
}
