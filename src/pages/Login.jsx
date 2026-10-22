
import { useState } from "react";
import "./Login.css";

export default function Login() {
  const [role, setRole] = useState("retail");
  const [showPassword, setShowPassword] = useState(false);
  const [remember, setRemember] = useState(true);

  const handleSubmit = (e) => {
    e.preventDefault();
    alert("Demo login form submitted!");
  };

  return (
    <main className="login-page">
      <div className="login-layout">
        {/* LEFT: BEAUTY BRAND SECTION */}
        <section className="beauty-panel">
          <div className="beauty-visual">
            <div className="decor-circle circle-one"></div>
            <div className="decor-circle circle-two"></div>
            <div className="decor-circle circle-three"></div>

            <div className="beauty-art">
              <div className="art-bottle bottle-one">
                <div className="bottle-cap"></div>
                <div className="bottle-label">M</div>
              </div>

              <div className="art-bottle bottle-two">
                <div className="bottle-cap"></div>
                <div className="bottle-label">CARE</div>
              </div>

              <div className="art-jar">
                <div className="jar-lid"></div>
                <div className="jar-label">GLOW</div>
              </div>

              <span className="art-sparkle sparkle-one">✦</span>
              <span className="art-sparkle sparkle-two">✧</span>
              <span className="art-flower">✿</span>
            </div>

            <div className="visual-caption">
              <span>YOUR DAILY BEAUTY RITUAL</span>
              <h2>Glow Naturally.</h2>
              <p>Feel Beautiful. Be Confident.</p>
            </div>
          </div>

          <div className="beauty-content">
            <span className="eyebrow">WELCOME TO MAYOOR</span>

            <h1>
              Your Beauty
              <br />
              Partner for
              <br />
              <span>a Healthier You</span>
            </h1>

            <p className="intro-text">
              Discover products that make your everyday
              skincare routine special.
            </p>

            <div className="benefits">
              <div className="benefit">
                <div className="benefit-icon">✦</div>
                <div>
                  <h3>100% Authentic Products</h3>
                  <p>Beauty and personal care essentials</p>
                </div>
              </div>

              <div className="benefit">
                <div className="benefit-icon">◇</div>
                <div>
                  <h3>Great Prices</h3>
                  <p>Retail offers and wholesale rates</p>
                </div>
              </div>

              <div className="benefit">
                <div className="benefit-icon">➜</div>
                <div>
                  <h3>Fast & Reliable Delivery</h3>
                  <p>Convenient shopping across India</p>
                </div>
              </div>

              <div className="benefit">
                <div className="benefit-icon">✓</div>
                <div>
                  <h3>Secure Shopping</h3>
                  <p>Your shopping experience matters</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* RIGHT: LOGIN FORM */}
        <section className="login-card">
          <div className="login-brand">
            <div className="brand-logo">M</div>
            <div>
              <h2>Mayoor Store</h2>
              <p>Beauty & Personal Care</p>
            </div>
          </div>

          <h1 className="welcome-title">Welcome Back!</h1>

          <p className="welcome-subtitle">
            Sign in to continue shopping with us.
          </p>

          <div className="role-tabs">
            <button
              type="button"
              className={role === "retail" ? "selected" : ""}
              onClick={() => setRole("retail")}
            >
              Retail Customer
            </button>

            <button
              type="button"
              className={role === "b2b" ? "selected" : ""}
              onClick={() => setRole("b2b")}
            >
              B2B Buyer
            </button>
          </div>

          {role === "b2b" && (
            <div className="b2b-message">
              Access wholesale pricing and bulk discounts
              with your verified business account.
            </div>
          )}

          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label htmlFor="email">Email Address</label>

              <div className="input-box">
                <span className="field-icon">✉</span>
                <input
                  id="email"
                  type="email"
                  placeholder="Enter your email"
                  autoComplete="email"
                  required
                />
              </div>
            </div>

            <div className="form-group">
              <label htmlFor="password">Password</label>

              <div className="input-box">
                <span className="field-icon">♙</span>
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="Enter your password"
                  autoComplete="current-password"
                  required
                />

                <button
                  type="button"
                  className="password-toggle"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? "Hide" : "Show"}
                </button>
              </div>
            </div>

            <div className="login-options">
              <label className="remember-option">
                <input
                  type="checkbox"
                  checked={remember}
                  onChange={(e) => setRemember(e.target.checked)}
                />
                <span>Remember me</span>
              </label>

              <a href="/forgot-password">Forgot password?</a>
            </div>

            <button type="submit" className="sign-in-button">
              Sign In
            </button>
          </form>

          <div className="divider">
            <span></span>
            <p>OR</p>
            <span></span>
          </div>

          <button
            type="button"
            className="social-button"
            onClick={() =>
              alert("Google login needs OAuth integration.")
            }
          >
            <span className="google-icon">G</span>
            Continue with Google
          </button>

          <button
            type="button"
            className="social-button"
            onClick={() =>
              alert("Facebook login needs OAuth integration.")
            }
          >
            <span className="facebook-icon">f</span>
            Continue with Facebook
          </button>

          <p className="signup-text">
            Don't have an account?{" "}
            <a href="/register">Create Account</a>
          </p>

          <p className="secure-note">
            ♡ Made for your everyday beauty
          </p>
        </section>
      </div>
    </main>
  );
}
