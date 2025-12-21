import React, { useState } from "react";
import { supabaseClient } from "../lib/supabaseClient";

export default function Auth() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);

  async function signIn() {
    setLoading(true);
    const { error } = await supabaseClient.auth.signInWithOtp({ email });
    setLoading(false);
    if (error) alert("Sign-in failed: " + error.message);
    else alert("Magic link sent — check your email.");
  }

  async function signOut() {
    await supabaseClient.auth.signOut();
    window.location.reload();
  }

  return (
    <div style={{ marginBottom: 16 }}>
      <h3>Account</h3>
      <div>
        <input
          placeholder="you@family.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          style={{ marginRight: 8 }}
        />
        <button onClick={signIn} disabled={!email || loading}>
          {loading ? "Sending..." : "Send magic link"}
        </button>
      </div>
      <div style={{ marginTop: 8 }}>
        <button onClick={signOut}>Sign out</button>
      </div>
    </div>
  );
}
