import * as client from "openid-client";
import { Strategy, type VerifyFunction } from "openid-client/passport";

import passport from "passport";
import session from "express-session";
import type { Express, RequestHandler } from "express";
import memoize from "memoizee";
import connectPg from "connect-pg-simple";
import { authStorage } from "./storage";
import jwt from "jsonwebtoken";

const getOidcConfig = memoize(
  async () => {
    return await client.discovery(
      new URL(process.env.ISSUER_URL ?? "https://replit.com/oidc"),
      process.env.REPL_ID!
    );
  },
  { maxAge: 3600 * 1000 }
);

export function getSession() {
  const sessionTtl = 7 * 24 * 60 * 60 * 1000; // 1 week
  const pgStore = connectPg(session);
  const sessionStore = new pgStore({
    conString: process.env.DATABASE_URL,
    createTableIfMissing: false,
    ttl: sessionTtl,
    tableName: "sessions",
  });
  return session({
    secret: process.env.SESSION_SECRET!,
    store: sessionStore,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: true,
      maxAge: sessionTtl,
    },
  });
}

function updateUserSession(
  user: any,
  tokens: client.TokenEndpointResponse & client.TokenEndpointResponseHelpers
) {
  user.claims = tokens.claims();
  user.access_token = tokens.access_token;
  user.refresh_token = tokens.refresh_token;
  user.expires_at = user.claims?.exp;
}

async function upsertUser(claims: any) {
  await authStorage.upsertUser({
    id: claims["sub"],
    email: claims["email"],
    firstName: claims["first_name"],
    lastName: claims["last_name"],
    profileImageUrl: claims["profile_image_url"],
    // New users get emailVerified: false; conflict update in auth storage leaves this untouched
    emailVerified: false,
    // New users need onboarding; conflict update leaves this untouched
    onboardingComplete: false,
  });
}

export async function setupAuth(app: Express) {
  app.set("trust proxy", 1);
  app.use(getSession());
  app.use(passport.initialize());
  app.use(passport.session());

  const config = await getOidcConfig();

  const verify: VerifyFunction = async (
    tokens: client.TokenEndpointResponse & client.TokenEndpointResponseHelpers,
    verified: passport.AuthenticateCallback
  ) => {
    const user = {};
    updateUserSession(user, tokens);
    await upsertUser(tokens.claims());
    verified(null, user);
  };

  // Track registered strategies by name
  const registeredStrategies = new Set<string>();

  // Register a web strategy for a given domain (callback: /api/callback)
  const ensureWebStrategy = (domain: string) => {
    const name = `replitauth:${domain}`;
    if (!registeredStrategies.has(name)) {
      passport.use(new Strategy(
        { name, config, scope: "openid email profile offline_access",
          callbackURL: `https://${domain}/api/callback` },
        verify
      ));
      registeredStrategies.add(name);
    }
  };

  // Register a mobile strategy for a given domain (callback: /api/mobile/callback)
  const ensureMobileStrategy = (domain: string) => {
    const name = `replitauth-mobile:${domain}`;
    if (!registeredStrategies.has(name)) {
      passport.use(new Strategy(
        { name, config, scope: "openid email profile offline_access",
          callbackURL: `https://${domain}/api/mobile/callback` },
        verify
      ));
      registeredStrategies.add(name);
    }
  };

  passport.serializeUser((user: Express.User, cb) => cb(null, user));
  passport.deserializeUser((user: Express.User, cb) => cb(null, user));

  // ── Web login ──────────────────────────────────────────────────────
  app.get("/api/login", (req, res, next) => {
    ensureWebStrategy(req.hostname);
    passport.authenticate(`replitauth:${req.hostname}`, {
      prompt: "login consent",
      scope: ["openid", "email", "profile", "offline_access"],
    })(req, res, next);
  });

  app.get("/api/callback", (req, res, next) => {
    ensureWebStrategy(req.hostname);
    passport.authenticate(`replitauth:${req.hostname}`, {
      successReturnToOrRedirect: "/",
      failureRedirect: "/api/login",
    })(req, res, next);
  });

  // ── Mobile login — uses a separate callback URL so no session flags needed ──
  app.get("/api/mobile/login", (req, res, next) => {
    ensureMobileStrategy(req.hostname);
    passport.authenticate(`replitauth-mobile:${req.hostname}`, {
      prompt: "login consent",
      scope: ["openid", "email", "profile", "offline_access"],
    })(req, res, next);
  });

  app.get("/api/mobile/callback", (req, res, next) => {
    ensureMobileStrategy(req.hostname);
    passport.authenticate(`replitauth-mobile:${req.hostname}`, {
      failureRedirect: "expenseroaster://auth/callback?error=auth_failed",
    })(req, res, (err?: any) => {
      if (err) {
        console.error("[mobile/callback] auth error:", err);
        return res.redirect("expenseroaster://auth/callback?error=auth_error");
      }
      const user = req.user as any;
      const userId = user?.claims?.sub;
      if (!userId) {
        return res.redirect("expenseroaster://auth/callback?error=no_user");
      }
      const JWT_SECRET = process.env.SESSION_SECRET || "fallback-dev-secret";
      const token = jwt.sign({ sub: userId }, JWT_SECRET, { expiresIn: "30d" });
      console.log("[mobile/callback] issuing JWT for user", userId);
      return res.redirect(`expenseroaster://auth/callback?token=${encodeURIComponent(token)}`);
    });
  });

  // ── Logout ─────────────────────────────────────────────────────────
  app.get("/api/logout", (req, res) => {
    req.logout(() => {
      res.redirect(
        client.buildEndSessionUrl(config, {
          client_id: process.env.REPL_ID!,
          post_logout_redirect_uri: `${req.protocol}://${req.hostname}`,
        }).href
      );
    });
  });
}

export const isAuthenticated: RequestHandler = async (req, res, next) => {
  const user = req.user as any;

  if (!req.isAuthenticated() || !user.expires_at) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  const now = Math.floor(Date.now() / 1000);
  if (now <= user.expires_at) {
    return next();
  }

  const refreshToken = user.refresh_token;
  if (!refreshToken) {
    res.status(401).json({ message: "Unauthorized" });
    return;
  }

  try {
    const config = await getOidcConfig();
    const tokenResponse = await client.refreshTokenGrant(config, refreshToken);
    updateUserSession(user, tokenResponse);
    return next();
  } catch (error) {
    res.status(401).json({ message: "Unauthorized" });
    return;
  }
};
