import React from "react";

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, errorMessage: "" };
  }

  static getDerivedStateFromError(error) {
    return {
      hasError: true,
      errorMessage: error?.message || "An unexpected error occurred.",
    };
  }

  componentDidCatch(error, errorInfo) {
    console.error("Page render error caught by ErrorBoundary:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <main style={{ maxWidth: 620, margin: "4rem auto", padding: "2rem", textAlign: "center", fontFamily: "inherit" }}>
          <h1 style={{ marginBottom: "0.75rem" }}>Something went wrong</h1>
          <p style={{ color: "#5f6b88", marginBottom: "1.5rem" }}>
            {this.state.errorMessage}
          </p>
          <div style={{ display: "flex", gap: "0.75rem", justifyContent: "center", flexWrap: "wrap" }}>
            <button
              type="button"
              onClick={() => window.location.reload()}
              style={{ padding: "0.65rem 1.25rem", borderRadius: 8, border: 0, background: "#173f35", color: "#fff", fontWeight: 600, cursor: "pointer" }}
            >
              Reload page
            </button>
            <button
              type="button"
              onClick={() => {
                this.setState({ hasError: false, errorMessage: "" });
                window.location.assign("/");
              }}
              style={{ padding: "0.65rem 1.25rem", borderRadius: 8, border: "1px solid #dfe2ef", background: "#fff", color: "#19172b", fontWeight: 600, cursor: "pointer" }}
            >
              Return Home
            </button>
          </div>
        </main>
      );
    }

    return this.props.children;
  }
}
