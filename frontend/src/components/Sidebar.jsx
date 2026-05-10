import { LayoutDashboard, FileWarning, Bell, BarChart3 } from 'lucide-react'

function Sidebar() {
  return (
    <aside className="sidebar">
      <h2 className="sidebar-title">Analyst Dashboard</h2>

      <nav className="sidebar-nav">
        
<a href="#dashboard" className="nav-item active">
  <LayoutDashboard size={18} />
  <span>Dashboard Home</span>
</a>

<a href="#findings" className="nav-item">
  <FileWarning size={18} />
  <span>Findings</span>
</a>

<a href="#alerts" className="nav-item">
  <Bell size={18} />
  <span>Alerts</span>
</a>

<a href="#visualizations" className="nav-item">
  <BarChart3 size={18} />
  <span>Visualizations</span>
</a>
      </nav>
    </aside>
  )
}

export default Sidebar