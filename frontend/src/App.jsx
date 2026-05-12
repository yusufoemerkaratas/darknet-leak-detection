import { useState } from 'react'
import Layout from './components/Layout'
import Login from './components/Login'
import './App.css'

function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(false)

  if (!isLoggedIn) {
    return <Login onLogin={() => setIsLoggedIn(true)} />
  }

  return <Layout onLogout={() => setIsLoggedIn(false)} />
}

export default App