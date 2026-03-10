import jwt from "jsonwebtoken";
import type { Express } from "express";

export function registerJwtMiddleware(app: Express) {
  const JWT_SECRET = process.env.SESSION_SECRET || "fallback-dev-secret";

  app.use((req: any, _res: any, next: Function) => {
    const mobileToken = (req.headers["x-app-token"] as string) || null;
    const cookieHeader = req.headers.cookie || "";
    const cookiePair = cookieHeader
      .split(";")
      .map((c: string) => c.trim())
      .find((c: string) => c.startsWith("er_local_token="));
    const cookieToken = cookiePair ? decodeURIComponent(cookiePair.split("=").slice(1).join("=")) : null;
    const token = mobileToken || cookieToken;

    if (token) {
      try {
        const payload = jwt.verify(token, JWT_SECRET) as {
          sub?: string;
          userId?: string;
          exp?: number;
        };
        const resolvedId = payload.sub || payload.userId;
        if (resolvedId) {
          req.user = {
            claims: { sub: resolvedId },
            expires_at: payload.exp ?? Math.floor(Date.now() / 1000) + 365 * 24 * 3600,
          };
          req.isAuthenticated = () => true;
        }
      } catch {
        // invalid or expired token — fall through unauthenticated
      }
    }
    next();
  });
}
