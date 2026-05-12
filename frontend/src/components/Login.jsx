import { ShieldCheck, Mail, Lock, Eye } from 'lucide-react'

function Login({ onLogin }) {
  return (
    <div className="login-page">
      <div className="login-card">
        <div className="login-left">
          <div className="brand">
            <div className="logo-box">
              <ShieldCheck size={38} strokeWidth={2.2} />
            </div>

            <div>
              <h1>
                Leak<span>Guard</span>
              </h1>
              <p>Detect. Analyze. Protect.</p>
            </div>
          </div>

          <div className="logo-hero">
            <ShieldCheck size={110} strokeWidth={1.8} />
          </div>

          <p className="left-description">
            Monitor your data, detect potential leaks, and keep your organization secure.
          </p>
        </div>

        <div className="login-right">
          <h2>Welcome</h2>
          <p className="subtitle">Sign in to continue to your dashboard</p>

          <label>Email</label>
          <div className="input-box">
            <Mail size={16} />
            
          </div>

          <label>Password</label>
          <div className="input-box">
            <Lock size={16} />
          
            <Eye size={16} />
          </div>

          <div className="login-options">
            <label className="remember">
              <input type="checkbox" defaultChecked />
              Remember me
            </label>
            <a href="#">Forgot password?</a>
          </div>

          <button className="signin-btn" onClick={onLogin}>
            Sign In
          </button>

          <div className="divider">
            <span></span>
            <p>or</p>
            <span></span>
          </div>

          <button className="google-btn">
            <span className="google-g">G</span>
            Sign in with Google
          </button>
        </div>

        <div className="signup-footer">
          Don’t have an account? <a href="#">Sign up</a>
        </div>
      </div>
    </div>
  )
}

export default Login