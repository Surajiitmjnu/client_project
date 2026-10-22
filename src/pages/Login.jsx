// src/pages/Login.jsx
import React, { useState } from "react";
import { auth, googleProvider } from "../firebase";
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInWithPopup,
} from "firebase/auth";

export default function Login({ onLoginSuccess }) {
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      if (isSignUp) {
        await createUserWithEmailAndPassword(auth, email, password);
      } else {
        await signInWithEmailAndPassword(auth, email, password);
      }
      if (onLoginSuccess) onLoginSuccess();
    } catch (err) {
      setError(err.message.replace("Firebase: ", ""));
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setError("");
    try {
      await signInWithPopup(auth, googleProvider);
      if (onLoginSuccess) onLoginSuccess();
    } catch (err) {
      setError(err.message.replace("Firebase: ", ""));
    }
  };

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <h2 style={styles.title}>{isSignUp ? "Create Account" : "Sign In"}</h2>
        {error && <p style={styles.error}>{error}</p>}

        <form onSubmit={handleSubmit} style={styles.form}>
          <input
            type="email"
            placeholder="Email Address"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            style={styles.input}
          />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            style={styles.input}
          />
          <button type="submit" disabled={loading} style={styles.button}>
            {loading ? "Please wait..." : isSignUp ? "Sign Up" : "Login"}
          </button>
        </form>

        <button onClick={handleGoogleSignIn} style={styles.googleButton}>
          Continue with Google
        </button>

        <p style={styles.toggleText}>
          {isSignUp ? "Already have an account?" : "Don't have an account?"}{" "}
          <span
            onClick={() => setIsSignUp(!isSignUp)}
            style={styles.toggleLink}
          >
            {isSignUp ? "Login" : "Sign Up"}
          </span>
        </p>
      </div>
    </div>
  );
}

const styles = {
  container: {
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    minHeight: "85vh",
    padding: "20px",
  },
  card: {
    width: "100%",
    maxWidth: "380px",
    padding: "30px",
    borderRadius: "10px",
    boxShadow: "0 4px 16px rgba(0,0,0,0.12)",
    backgroundColor: "#fff",
    color: "#222",
    textAlign: "center",
  },
  title: { marginBottom: "20px", fontSize: "24px" },
  form: { display: "flex", flexDirection: "column", gap: "14px" },
  input: {
    padding: "12px",
    borderRadius: "6px",
    border: "1px solid #ccc",
    fontSize: "15px",
  },
  button: {
    padding: "12px",
    borderRadius: "6px",
    border: "none",
    backgroundColor: "#2563eb",
    color: "#fff",
    fontSize: "16px",
    fontWeight: "600",
    cursor: "pointer",
  },
  googleButton: {
    marginTop: "12px",
    width: "100%",
    padding: "11px",
    borderRadius: "6px",
    border: "1px solid #ccc",
    backgroundColor: "#f9fafb",
    color: "#333",
    fontSize: "15px",
    cursor: "pointer",
  },
  error: {
    color: "#dc2626",
    backgroundColor: "#fef2f2",
    padding: "8px",
    borderRadius: "4px",
    fontSize: "13px",
    marginBottom: "12px",
  },
  toggleText: { marginTop: "18px", fontSize: "14px", color: "#555" },
  toggleLink: { color: "#2563eb", cursor: "pointer", fontWeight: "600" },
};