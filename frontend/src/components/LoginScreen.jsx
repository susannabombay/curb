import React, { useState } from "react";
import { login, signup } from "../api";

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

  return (
    <div className="screen login-screen">
      <div className="logo-mark">
        <svg viewBox="0 0 24 24" fill="none" stroke="#1a1206" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 21s-7-6.1-7-11a7 7 0 0 1 14 0c0 4.9-7 11-7 11z" />
          <circle cx="12" cy="10" r="2.5" fill="#1a1206" stroke="none" />
        </svg>
      </div>
      <div className="brand">Curb</div>
      <p className="tagline">Book your parking spot before you leave.</p>

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

      <button
        className="link-btn"
        onClick={() => {
          setMode(mode === "signup" ? "login" : "signup");
          setError(null);
        }}
      >
        {mode === "signup" ? "Already have an account? Log in" : "New here? Create an account"}
      </button>

      <button className="ghost guest-btn" onClick={() => onLogin({ email: null, token: null, guest: true })}>
        Continue as guest
      </button>
    </div>
  );
}
