import {
  LayoutDashboard,
  FileWarning,
  Bell,
  BarChart3,
} from 'lucide-react'

function Sidebar({ onLogout }) {
  return (
    <aside className="sidebar">
      <div className="sidebar-top">
        <h2 className="sidebar-logo">LeakGuard</h2>

        <nav className="sidebar-nav">
          <a href="#dashboard" className="nav-item active">
            <LayoutDashboard size={18} />
            <span>Dashboard</span>
          </a>

          <a href="#alerts" className="nav-item">
            <Bell size={18} />
            <span>Alerts</span>
          </a>

          <a href="#findings" className="nav-item">
            <FileWarning size={18} />
            <span>Findings</span>
          </a>

          <a href="#visualizations" className="nav-item">
            <BarChart3 size={18} />
            <span>Visualizations</span>
          </a>
        </nav>
      </div>

      <div className="sidebar-user">
        <div className="user-avatar">EY</div>

        <div className="user-info">
          <strong>Eylül Y.</strong>
          <span>Standard</span>
        </div>

        <button className="logout-small" onClick={onLogout}>
          Logout
        </button>
      </div>
    </aside>
  )
}

export default Sidebar