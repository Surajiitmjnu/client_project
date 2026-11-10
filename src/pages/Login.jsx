// src/pages/Login.jsx
import React, { useState } from "react";
import { auth, googleProvider } from "../firebase";
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInWithPopup,
} from "firebase/auth";
import "./Login.css";

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
    <div className="login-page">
      <div className="login-orbit orbit-one">Face Wash</div>
      <div className="login-orbit orbit-two">Body Lotion</div>
      <div className="login-orbit orbit-three">Shampoo</div>
      <div className="login-layout">
        <section className="beauty-panel">
          <div className="beauty-content">
            <span className="eyebrow">WELCOME TO MAYOOR STORE</span>
            <h1>Everything your store needs, <span>in one place.</span></h1>
            <p className="intro-text">Shop trusted beauty and personal care essentials for your home, salon, or business.</p>
            <div className="benefits">
              <div className="benefit"><span className="benefit-icon">✦</span><div><h3>Curated products</h3><p>Quality essentials from trusted brands.</p></div></div>
              <div className="benefit"><span className="benefit-icon">✓</span><div><h3>Wholesale value</h3><p>Better prices for every quantity.</p></div></div>
            </div>
          </div>
          <div className="beauty-visual">
            <span className="decor-circle circle-one" />
            <span className="decor-circle circle-two" />
            <span className="art-sparkle sparkle-one">✦</span>
            <span className="art-sparkle sparkle-two">✧</span>
            <div className="beauty-art">
              <div className="art-bottle bottle-one"><span className="bottle-cap" /><span className="bottle-label">MAYOOR</span></div>
              <div className="art-jar"><span className="jar-lid" /><p className="jar-label">CARE</p></div>
              <div className="art-bottle bottle-two"><span className="bottle-cap" /><span className="bottle-label">GLOW</span></div>
            </div>
            <div className="visual-caption"><span>WHOLESALE &amp; RETAIL</span><h2>Beauty made simple.</h2><p>Discover products your customers will love.</p></div>
          </div>
        </section>

        <section className="login-card">
          <div className="login-brand"><span className="brand-logo">M</span><div><h2>Mayoor Store</h2><p>Beauty &amp; personal care</p></div></div>
          <h1 className="welcome-title">{isSignUp ? "Create your account" : "Welcome back"}</h1>
          <p className="welcome-subtitle">{isSignUp ? "Join us and start shopping with confidence." : "Sign in to continue to your store."}</p>
          {error && <p className="login-error" role="alert">{error}</p>}

          <form onSubmit={handleSubmit}>
            <div className="form-group"><label htmlFor="login-email">Email address</label><div className="input-box"><span className="field-icon">✉</span><input id="login-email" type="email" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} required /></div></div>
            <div className="form-group"><label htmlFor="login-password">Password</label><div className="input-box"><span className="field-icon">◆</span><input id="login-password" type="password" placeholder="Enter your password" value={password} onChange={(e) => setPassword(e.target.value)} required /></div></div>
            <button className="sign-in-button" type="submit" disabled={loading}>{loading ? "Please wait..." : isSignUp ? "Create account" : "Sign in"}</button>
          </form>
          <div className="divider"><span /><p>or continue with</p><span /></div>
          <button className="social-button" type="button" onClick={handleGoogleSignIn}><span className="google-icon">G</span> Continue with Google</button>
          <p className="signup-text">{isSignUp ? "Already have an account?" : "Don't have an account?"}{" "}<button type="button" onClick={() => setIsSignUp(!isSignUp)}>{isSignUp ? "Sign in" : "Create one"}</button></p>
          <p className="secure-note">Secure sign in · Your information is protected</p>
        </section>
      </div>
    </div>
  );
}