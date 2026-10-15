
import { useState } from "react";
import { Link } from "react-router-dom";

function Login() {
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();

    setMessage("");
    setError("");
    setLoading(true);

    const form = event.currentTarget;
    const formData = new FormData(form);

    const email = String(formData.get("email") || "").trim();
    const password = String(formData.get("password") || "");

    try {
      const response = await fetch(
        "http://127.0.0.1:5000/api/auth/login",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ email, password }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        setError(data.message || "Login failed. Please try again.");
        return;
      }

      // Keep this demo session for the current browser tab.
      sessionStorage.setItem("connecthub_token", data.token);
      sessionStorage.setItem(
        "connecthub_user",
        JSON.stringify(data.user)
      );

      setMessage(`Welcome back, ${data.user.fullName}!`);
      form.reset();
    } catch (err) {
      console.error("Login error:", err);
      setError(
        "Cannot connect to the server. Check that Flask is running."
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
        <span className="eyebrow">WELCOME BACK</span>

        <h1>Log in to ConnectHub</h1>

        <p className="auth-description">
          Continue learning, connecting, and growing with your community.
        </p>

        <form onSubmit={handleSubmit}>
          <label htmlFor="login-email">Email address</label>

          <input
            id="login-email"
            name="email"
            type="email"
            placeholder="you@example.com"
            autoComplete="email"
            required
          />

          <label htmlFor="login-password">Password</label>

          <input
            id="login-password"
            name="password"
            type="password"
            placeholder="Enter your password"
            autoComplete="current-password"
            required
          />

          <button
            className="button auth-submit"
            type="submit"
            disabled={loading}
          >
            {loading ? "Logging in..." : "Log in"}
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
          New to ConnectHub? <Link to="/signup">Create an account</Link>
        </p>

        <Link className="back-home" to="/">
          ← Back to home
        </Link>
      </main>
    </div>
  );
}

export default Login;
