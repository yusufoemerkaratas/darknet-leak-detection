import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Toaster } from 'sonner'
import { ThemeProvider, useTheme } from './context/ThemeContext'
import { Layout } from './components/layout/Layout'
import { Landing } from './pages/Landing'
import { Dashboard } from './pages/Dashboard'
import { Sources } from './pages/Sources'
import { Companies } from './pages/Companies'
import { CrawlJobs } from './pages/CrawlJobs'
import { Alerts } from './pages/Alerts'
import { Findings } from './pages/Findings'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 10_000,
    },
  },
})

function AppContent() {
  const { resolvedTheme } = useTheme()
  return (
    <>
      <Toaster
        position="bottom-right"
        theme={resolvedTheme}
        richColors
        toastOptions={{ className: 'font-sans text-sm' }}
      />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route element={<Layout />}>
            <Route path="/overview" element={<Dashboard />} />
            <Route path="/findings" element={<Findings />} />
            <Route path="/alerts" element={<Alerts />} />
            <Route path="/sources" element={<Sources />} />
            <Route path="/companies" element={<Companies />} />
            <Route path="/crawl-jobs" element={<CrawlJobs />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </>
  )
}

export default function App() {
  return (
    <ThemeProvider>
      <QueryClientProvider client={queryClient}>
        <AppContent />
      </QueryClientProvider>
    </ThemeProvider>
  )
}
