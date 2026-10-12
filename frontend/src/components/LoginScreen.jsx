import React, { useState } from "react";
import { login, signup } from "../api";
import { LogoGlyph } from "./icons.jsx";

// Real auth against the backend (see ../backend/main.py) -- an account's
// password is hashed server-side (bcrypt) and never stored or compared in
// the browser. Successful login/signup hands { email, token } up to App,
// which persists the token so the account (and its bookings) survive a
// reload -- e.g. coming back after "Navigate there" hands off to the Maps
// app. Guest mode skips all of this; there's no account to remember.
export default function LoginScreen({ onLogin }) {
  const [mode, setMode] = useState("login"); // "login" | "signup"
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const call = mode === "signup" ? signup : login;
      const result = await call(email.trim(), password);
      onLogin({ email: result.email, token: result.token, guest: false });
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  function switchMode(next) {
    setMode(next);
    setError(null);
  }

  return (
    <div className="screen login-screen">
      <div className="login-hero">
        <div className="logo-mark">
          <LogoGlyph size={30} />
        </div>
        <div className="brand">Curb</div>
        <p className="tagline">Book your parking spot before you leave.</p>
      </div>

      <div className="card login-card">
        <div className="segmented">
          <button type="button" className={mode === "login" ? "active" : ""} onClick={() => switchMode("login")}>
            Log in
          </button>
          <button type="button" className={mode === "signup" ? "active" : ""} onClick={() => switchMode("signup")}>
            Sign up
          </button>
        </div>

        <form className="login-form" onSubmit={handleSubmit}>
          <label className="field-label">Email</label>
          <input
            type="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <label className="field-label">Password</label>
          <input
            type="password"
            placeholder={mode === "signup" ? "At least 8 characters" : "********"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            minLength={mode === "signup" ? 8 : undefined}
            required
          />

          {error && <div className="form-error">{error}</div>}

          <button type="submit" className="primary login-btn" disabled={busy}>
            {busy ? "Please wait..." : mode === "signup" ? "Create account" : "Log in"}
          </button>
        </form>
      </div>

      <div className="divider">or</div>

      <button className="secondary guest-btn" onClick={() => onLogin({ email: null, token: null, guest: true })}>
        Continue as guest
      </button>
    </div>
  );
}
