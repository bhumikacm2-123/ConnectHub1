
import { useState } from "react";
import { Link } from "react-router-dom";

function Signup() {
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();

    setMessage("");
    setError("");

    const form = event.currentTarget;
    const formData = new FormData(form);

    const fullName = String(formData.get("fullName") || "").trim();
    const email = String(formData.get("email") || "").trim();
    const password = String(formData.get("password") || "");
    const confirmPassword = String(
      formData.get("confirmPassword") || ""
    );

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);

    try {
      const response = await fetch(
        "http://127.0.0.1:5000/api/auth/signup",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            fullName,
            email,
            password,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        setError(data.message || "Unable to create your account.");
        return;
      }

      setMessage(data.message || "Account created successfully!");
      form.reset();
    } catch (err) {
      console.error("Signup error:", err);
      setError(
        "Could not connect to the server. Make sure Flask is running."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-page">
      <Link className="brand auth-brand" to="/">
        <span className="brand-icon">C</span>
        <span>ConnectHub</span>
      </Link>

      <main className="auth-card">
        <span className="eyebrow">JOIN THE COMMUNITY</span>

        <h1>Create your account</h1>

        <p className="auth-description">
          Meet people, discover opportunities, and grow together.
        </p>

        <form onSubmit={handleSubmit}>
          <label htmlFor="signup-name">Full name</label>
          <input
            id="signup-name"
            name="fullName"
            type="text"
            placeholder="Enter your full name"
            autoComplete="name"
            required
          />

          <label htmlFor="signup-email">Email address</label>
          <input
            id="signup-email"
            name="email"
            type="email"
            placeholder="you@example.com"
            autoComplete="email"
            required
          />

          <label htmlFor="signup-password">Password</label>
          <input
            id="signup-password"
            name="password"
            type="password"
            placeholder="At least 8 characters"
            autoComplete="new-password"
            minLength={8}
            required
          />

          <label htmlFor="confirm-password">
            Confirm password
          </label>
          <input
            id="confirm-password"
            name="confirmPassword"
            type="password"
            placeholder="Enter your password again"
            autoComplete="new-password"
            minLength={8}
            required
          />

          <button
            className="button auth-submit"
            type="submit"
            disabled={loading}
          >
            {loading ? "Creating account..." : "Create account"}
          </button>
        </form>

        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}

        {message && (
          <p className="form-message" role="status">
            {message}
          </p>
        )}

        <p className="auth-switch">
          Already have an account?{" "}
          <Link to="/login">Log in</Link>
        </p>

        <Link className="back-home" to="/">
          ← Back to home
        </Link>
      </main>
    </div>
  );
}

export default Signup;
