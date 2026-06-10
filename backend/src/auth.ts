import type express from "express";
import { Router } from "express";
import passport from "passport";
import { Strategy as GoogleStrategy, type Profile } from "passport-google-oauth20";
import jwt from "jsonwebtoken";
import { query } from "./db.js";
import { sendWaitlistNotification } from "./mailer.js";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface AuthUser {
  id: string;
  email: string;
  name: string | null;
  avatar_url: string | null;
  status: string;
  isAdmin: boolean;
}


// ─── Config ──────────────────────────────────────────────────────────────────

const ADMIN_EMAILS = (process.env.ADMIN_EMAILS ?? "srinivk2013@gmail.com")
  .split(",")
  .map(e => e.trim())
  .filter(Boolean);

function jwtSecret(): string {
  return process.env.SESSION_SECRET ?? "dev-secret-change-in-production";
}

function frontendUrl(): string {
  const origins = process.env.CLIENT_ORIGIN?.split(",").map(s => s.trim()).filter(Boolean);
  return origins?.[0] ?? "http://localhost:5173";
}

function isAuthConfigured(): boolean {
  return !!(process.env.DATABASE_URL && process.env.GOOGLE_CLIENT_ID);
}

// ─── Passport setup (only when credentials are present) ──────────────────────

if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
  passport.use(
    new GoogleStrategy(
      {
        clientID: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        callbackURL:
          process.env.GOOGLE_CALLBACK_URL ??
          "http://localhost:4000/auth/google/callback",
      },
      (_accessToken, _refreshToken, profile: Profile, done) => {
        done(null, profile);
      }
    )
  );
}

// ─── Middleware ───────────────────────────────────────────────────────────────

export async function requireAuth(
  req: express.Request,
  res: express.Response,
  next: express.NextFunction
): Promise<void> {
  if (!isAuthConfigured()) {
    return next();
  }

  const token = (req.cookies as Record<string, string | undefined>)["auth_token"];
  if (!token) {
    res.status(401).json({ message: "Not authenticated" });
    return;
  }

  try {
    const payload = jwt.verify(token, jwtSecret()) as { userId: string };

    const result = await query<{
      id: string;
      email: string;
      name: string | null;
      avatar_url: string | null;
      status: string;
    }>("SELECT id, email, name, avatar_url, status FROM users WHERE id = $1", [
      payload.userId,
    ]);

    const user = result.rows[0];
    if (!user) {
      res.status(401).json({ message: "User not found" });
      return;
    }
    if (user.status !== "approved") {
      res.status(403).json({ message: "Access pending approval", status: user.status });
      return;
    }

    req.authUser = { ...user, isAdmin: ADMIN_EMAILS.includes(user.email) };
    next();
  } catch {
    res.status(401).json({ message: "Invalid or expired session" });
  }
}

async function requireAdminAuth(
  req: express.Request,
  res: express.Response,
  next: express.NextFunction
): Promise<void> {
  await requireAuth(req, res, () => {
    if (!req.authUser) return;
    if (!req.authUser.isAdmin) {
      res.status(403).json({ message: "Admin access required" });
      return;
    }
    next();
  });
}

// ─── Auth Router ─────────────────────────────────────────────────────────────

export const authRouter = Router();

authRouter.get("/google", (req, res, next) => {
  if (!process.env.GOOGLE_CLIENT_ID) {
    res.status(503).json({ message: "Google OAuth is not configured on this server." });
    return;
  }
  passport.authenticate("google", {
    scope: ["email", "profile"],
    session: false,
  })(req, res, next);
});

authRouter.get(
  "/google/callback",
  (req, res, next) => {
    passport.authenticate("google", {
      session: false,
      failureRedirect: `${frontendUrl()}?error=oauth_failed`,
    })(req, res, next);
  },
  async (req, res) => {
    const profile = req.user as Profile;
    const email = profile.emails?.[0]?.value;

    if (!email) {
      res.redirect(`${frontendUrl()}?error=no_email`);
      return;
    }

    try {
      const result = await query<{
        id: string;
        status: string;
        name: string | null;
        avatar_url: string | null;
        last_login: string | null;
      }>(
        `INSERT INTO users (email, name, avatar_url, google_id)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (email) DO UPDATE
           SET name = EXCLUDED.name,
               avatar_url = EXCLUDED.avatar_url,
               google_id = EXCLUDED.google_id,
               last_login = NOW()
         RETURNING id, status, name, avatar_url, last_login`,
        [
          email,
          profile.displayName ?? null,
          profile.photos?.[0]?.value ?? null,
          profile.id,
        ]
      );

      const user = result.rows[0];
      if (!user) throw new Error("User upsert failed");

      // last_login is NULL for brand-new users (INSERT) — send waitlist emails
      const isNewUser = user.last_login === null && user.status === "pending";
      if (isNewUser) {
        sendWaitlistNotification({ id: user.id, email, name: user.name })
          .catch(e => console.error("Waitlist email notification failed:", e));
      }

      if (user.status === "blocked") {
        res.redirect(`${frontendUrl()}?error=blocked`);
        return;
      }

      const token = jwt.sign(
        { userId: user.id, email, status: user.status },
        jwtSecret(),
        { expiresIn: "7d" }
      );

      res.cookie("auth_token", token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: 7 * 24 * 60 * 60 * 1000,
        path: "/",
      });

      res.redirect(frontendUrl());
    } catch (e) {
      console.error("OAuth callback error:", e);
      res.redirect(`${frontendUrl()}?error=server_error`);
    }
  }
);

authRouter.get("/me", async (req, res) => {
  if (!isAuthConfigured()) {
    res.json({ authEnabled: false });
    return;
  }

  const token = (req.cookies as Record<string, string | undefined>)["auth_token"];
  if (!token) {
    res.status(401).json({ message: "Not authenticated" });
    return;
  }

  try {
    const payload = jwt.verify(token, jwtSecret()) as { userId: string };

    const result = await query<{
      id: string;
      email: string;
      name: string | null;
      avatar_url: string | null;
      status: string;
    }>(
      "SELECT id, email, name, avatar_url, status FROM users WHERE id = $1",
      [payload.userId]
    );

    const user = result.rows[0];
    if (!user) {
      res.status(401).json({ message: "User not found" });
      return;
    }

    res.json({ ...user, isAdmin: ADMIN_EMAILS.includes(user.email) });
  } catch {
    res.status(401).json({ message: "Invalid or expired session" });
  }
});

authRouter.post("/logout", (req, res) => {
  res.clearCookie("auth_token", { path: "/" });
  res.json({ message: "Logged out" });
});

// ─── Admin Router ─────────────────────────────────────────────────────────────

export const adminRouter = Router();

adminRouter.get("/users", requireAdminAuth, async (_req, res, next) => {
  try {
    const result = await query<{
      id: string;
      email: string;
      name: string | null;
      avatar_url: string | null;
      status: string;
      created_at: string;
      last_login: string | null;
    }>(
      "SELECT id, email, name, avatar_url, status, created_at, last_login FROM users ORDER BY CASE status WHEN 'pending' THEN 0 WHEN 'approved' THEN 1 ELSE 2 END, created_at DESC"
    );
    res.json({ users: result.rows });
  } catch (error) {
    next(error);
  }
});

adminRouter.post("/users/:id/approve", requireAdminAuth, async (req, res, next) => {
  try {
    await query("UPDATE users SET status = 'approved' WHERE id = $1", [req.params["id"]]);
    res.json({ message: "User approved" });
  } catch (error) {
    next(error);
  }
});

adminRouter.post("/users/:id/block", requireAdminAuth, async (req, res, next) => {
  try {
    await query("UPDATE users SET status = 'blocked' WHERE id = $1", [req.params["id"]]);
    res.json({ message: "User blocked" });
  } catch (error) {
    next(error);
  }
});
