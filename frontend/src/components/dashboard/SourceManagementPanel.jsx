import {
  Activity,
  Database,
  Play,
  Plus,
  RefreshCw,
  Save,
  Search,
  ToggleLeft,
  ToggleRight,
} from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import StatusCard from '../cards/StatusCard'
import {
  createSource,
  getSourceHealth,
  getSourceMetrics,
  getSources,
  testSourceCrawl,
  toggleSource,
  updateSource,
} from '../../api/client'

const emptyForm = {
  name: '',
  url: '',
}

function formatPercent(value) {
  return `${Math.round((value ?? 0) * 100)}%`
}

function SourceManagementPanel() {
  const [sources, setSources] = useState([])
  const [filters, setFilters] = useState({ name: '', isActive: 'all' })
  const [form, setForm] = useState(emptyForm)
  const [editingSourceId, setEditingSourceId] = useState(null)
  const [selectedSourceId, setSelectedSourceId] = useState(null)
  const [healthBySource, setHealthBySource] = useState({})
  const [metricsBySource, setMetricsBySource] = useState({})
  const [statusMessage, setStatusMessage] = useState('')
  const [errorMessage, setErrorMessage] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const selectedSource = useMemo(
    () => sources.find((source) => source.id === selectedSourceId),
    [selectedSourceId, sources]
  )
  const selectedHealth = selectedSourceId ? healthBySource[selectedSourceId] : null
  const selectedMetrics = selectedSourceId ? metricsBySource[selectedSourceId] : null

  async function loadSources(nextFilters = filters) {
    setIsLoading(true)
    setErrorMessage('')

    try {
      const data = await getSources({
        name: nextFilters.name.trim(),
        isActive:
          nextFilters.isActive === 'all' ? undefined : nextFilters.isActive === 'active',
      })
      setSources(data)
      if (!selectedSourceId && data.length > 0) {
        setSelectedSourceId(data[0].id)
      }
    } catch (error) {
      setErrorMessage(error.message || 'Failed to load sources.')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    loadSources()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function loadSourceDiagnostics(sourceId) {
    setErrorMessage('')

    try {
      const [health, metrics] = await Promise.all([
        getSourceHealth(sourceId),
        getSourceMetrics(sourceId),
      ])
      setHealthBySource((current) => ({ ...current, [sourceId]: health }))
      setMetricsBySource((current) => ({ ...current, [sourceId]: metrics }))
    } catch (error) {
      setErrorMessage(error.message || 'Failed to load source diagnostics.')
    }
  }

  async function handleSubmit(event) {
    event.preventDefault()
    if (!form.name.trim() || !form.url.trim()) return

    setIsSubmitting(true)
    setErrorMessage('')
    setStatusMessage('')

    try {
      if (editingSourceId) {
        const updatedSource = await updateSource(editingSourceId, {
          name: form.name.trim(),
          url: form.url.trim(),
        })
        setStatusMessage(`${updatedSource.name} updated.`)
      } else {
        const createdSource = await createSource({
          name: form.name.trim(),
          url: form.url.trim(),
        })
        setSelectedSourceId(createdSource.id)
        setStatusMessage(`${createdSource.name} created.`)
      }

      setForm(emptyForm)
      setEditingSourceId(null)
      await loadSources()
    } catch (error) {
      setErrorMessage(error.message || 'Failed to save source.')
    } finally {
      setIsSubmitting(false)
    }
  }

  function handleEdit(source) {
    setEditingSourceId(source.id)
    setForm({ name: source.name, url: source.url })
    setSelectedSourceId(source.id)
  }

  async function handleToggle(source) {
    setErrorMessage('')
    setStatusMessage('')

    try {
      const updatedSource = await toggleSource(source.id)
      setStatusMessage(`${updatedSource.name} ${updatedSource.is_active ? 'enabled' : 'disabled'}.`)
      await loadSources()
    } catch (error) {
      setErrorMessage(error.message || 'Failed to update source status.')
    }
  }

  async function handleTestCrawl(sourceId) {
    setErrorMessage('')
    setStatusMessage('')

    try {
      const job = await testSourceCrawl(sourceId)
      setStatusMessage(`Test crawl queued as job #${job.job_id}.`)
      await loadSourceDiagnostics(sourceId)
    } catch (error) {
      setErrorMessage(error.message || 'Failed to queue test crawl.')
    }
  }

  async function handleFilterSubmit(event) {
    event.preventDefault()
    await loadSources(filters)
  }

  return (
    <StatusCard
      actions={
        <button
          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-950/60 px-2.5 py-1 text-[10px] text-slate-200 transition hover:border-cyan-400/30 hover:text-white"
          onClick={() => loadSources()}
          type="button"
        >
          <RefreshCw className="h-3 w-3" />
          Refresh
        </button>
      }
      id="sources"
      subtitle="Configure collector sources and inspect crawl health."
      title="Source Management"
    >
      <div className="grid gap-3 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.3fr)]">
        <form className="panel-muted rounded-xl p-3" onSubmit={handleSubmit}>
          <div className="mb-3 flex items-center gap-2 text-[12px] font-medium text-slate-200">
            <Database className="h-4 w-4 text-cyan-300" />
            {editingSourceId ? 'Edit Source' : 'New Source'}
          </div>

          <label className="block text-[10px] uppercase tracking-[0.16em] text-slate-500">
            Name
            <input
              className="mt-1 w-full rounded-lg border border-slate-800 bg-slate-950/70 px-2.5 py-2 text-[12px] normal-case tracking-normal text-slate-100 outline-none transition focus:border-cyan-400/50"
              onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
              value={form.name}
            />
          </label>

          <label className="mt-3 block text-[10px] uppercase tracking-[0.16em] text-slate-500">
            URL
            <input
              className="mt-1 w-full rounded-lg border border-slate-800 bg-slate-950/70 px-2.5 py-2 text-[12px] normal-case tracking-normal text-slate-100 outline-none transition focus:border-cyan-400/50"
              onChange={(event) => setForm((current) => ({ ...current, url: event.target.value }))}
              value={form.url}
            />
          </label>

          <div className="mt-3 flex flex-wrap gap-2">
            <button
              className="inline-flex items-center gap-1.5 rounded-lg border border-cyan-500/25 bg-cyan-500/10 px-2.5 py-1.5 text-[11px] text-cyan-100 transition hover:border-cyan-300/50 disabled:cursor-not-allowed disabled:opacity-50"
              disabled={isSubmitting || !form.name.trim() || !form.url.trim()}
              type="submit"
            >
              {editingSourceId ? <Save className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
              {editingSourceId ? 'Save' : 'Create'}
            </button>
            {editingSourceId ? (
              <button
                className="rounded-lg border border-slate-700 bg-slate-950/60 px-2.5 py-1.5 text-[11px] text-slate-300"
                onClick={() => {
                  setEditingSourceId(null)
                  setForm(emptyForm)
                }}
                type="button"
              >
                Cancel
              </button>
            ) : null}
          </div>
        </form>

        <div className="space-y-3">
          <form className="flex flex-wrap gap-2" onSubmit={handleFilterSubmit}>
            <label className="flex min-w-[180px] flex-1 items-center gap-2 rounded-lg border border-slate-800 bg-slate-950/70 px-2.5 py-2">
              <Search className="h-3.5 w-3.5 text-slate-500" />
              <input
                className="w-full bg-transparent text-[12px] text-slate-100 outline-none placeholder:text-slate-600"
                onChange={(event) =>
                  setFilters((current) => ({ ...current, name: event.target.value }))
                }
                placeholder="Filter by name"
                value={filters.name}
              />
            </label>
            <select
              className="rounded-lg border border-slate-800 bg-slate-950/70 px-2.5 py-2 text-[12px] text-slate-100 outline-none"
              onChange={(event) =>
                setFilters((current) => ({ ...current, isActive: event.target.value }))
              }
              value={filters.isActive}
            >
              <option value="all">All</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
            <button
              className="rounded-lg border border-slate-700 bg-slate-950/70 px-2.5 py-2 text-[11px] text-slate-200"
              type="submit"
            >
              Apply
            </button>
          </form>

          {errorMessage ? (
            <p className="rounded-lg border border-rose-500/25 bg-rose-500/10 px-3 py-2 text-[11px] text-rose-200">
              {errorMessage}
            </p>
          ) : null}
          {statusMessage ? (
            <p className="rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-3 py-2 text-[11px] text-emerald-200">
              {statusMessage}
            </p>
          ) : null}

          <div className="overflow-x-auto rounded-xl border border-slate-800">
            <div className="grid min-w-[680px] grid-cols-[0.9fr_1.3fr_0.6fr_1.2fr] bg-slate-950/70 px-3 py-2 text-[10px] uppercase tracking-[0.14em] text-slate-500">
              <span>Name</span>
              <span>URL</span>
              <span>Status</span>
              <span>Actions</span>
            </div>
            {isLoading ? (
              <p className="px-3 py-3 text-[11px] text-slate-400">Loading sources...</p>
            ) : sources.length === 0 ? (
              <p className="px-3 py-3 text-[11px] text-slate-400">No sources match this view.</p>
            ) : (
              sources.map((source) => (
                <div
                  className={`grid min-w-[680px] grid-cols-[0.9fr_1.3fr_0.6fr_1.2fr] items-center gap-2 border-t border-slate-800 px-3 py-2 text-[11px] ${
                    selectedSourceId === source.id ? 'bg-cyan-500/5' : 'bg-slate-950/35'
                  }`}
                  key={source.id}
                >
                  <button
                    className="truncate text-left text-slate-100 hover:text-cyan-200"
                    onClick={() => {
                      setSelectedSourceId(source.id)
                      loadSourceDiagnostics(source.id)
                    }}
                    type="button"
                  >
                    {source.name}
                  </button>
                  <span className="truncate text-slate-400">{source.url}</span>
                  <span className={source.is_active ? 'text-emerald-300' : 'text-slate-500'}>
                    {source.is_active ? 'Active' : 'Inactive'}
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    <button
                      className="inline-flex items-center gap-1 rounded-md border border-slate-700 px-2 py-1 text-slate-300"
                      onClick={() => handleEdit(source)}
                      type="button"
                    >
                      <Save className="h-3 w-3" />
                      Edit
                    </button>
                    <button
                      className="inline-flex items-center gap-1 rounded-md border border-slate-700 px-2 py-1 text-slate-300"
                      onClick={() => handleToggle(source)}
                      type="button"
                    >
                      {source.is_active ? <ToggleRight className="h-3 w-3" /> : <ToggleLeft className="h-3 w-3" />}
                      Toggle
                    </button>
                    <button
                      className="inline-flex items-center gap-1 rounded-md border border-cyan-500/25 px-2 py-1 text-cyan-200"
                      onClick={() => handleTestCrawl(source.id)}
                      type="button"
                    >
                      <Play className="h-3 w-3" />
                      Test
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {selectedSource ? (
        <div className="mt-3 grid gap-3 lg:grid-cols-3">
          <div className="panel-muted rounded-xl p-3">
            <div className="mb-2 flex items-center gap-2 text-[12px] font-medium text-slate-200">
              <Activity className="h-4 w-4 text-emerald-300" />
              Health
            </div>
            {selectedHealth ? (
              <div className="space-y-1.5 text-[11px] text-slate-400">
                <p>Status: <span className="text-slate-100">{selectedHealth.status}</span></p>
                <p>Success rate: <span className="text-slate-100">{formatPercent(selectedHealth.success_rate)}</span></p>
                <p>Errors: <span className="text-slate-100">{selectedHealth.failed_jobs}</span></p>
                <p>Avg latency: <span className="text-slate-100">{selectedHealth.average_latency_seconds ?? 'n/a'}s</span></p>
              </div>
            ) : (
              <button
                className="rounded-lg border border-slate-700 bg-slate-950/60 px-2.5 py-1.5 text-[11px] text-slate-200"
                onClick={() => loadSourceDiagnostics(selectedSource.id)}
                type="button"
              >
                Load health
              </button>
            )}
          </div>

          <div className="panel-muted rounded-xl p-3 lg:col-span-2">
            <div className="mb-2 text-[12px] font-medium text-slate-200">Recent Metrics</div>
            {selectedMetrics ? (
              <div className="grid grid-cols-3 gap-2 text-[11px] text-slate-400">
                <span>Total records <strong className="block text-slate-100">{selectedMetrics.total_records}</strong></span>
                <span>Inserted <strong className="block text-slate-100">{selectedMetrics.inserted_records}</strong></span>
                <span>Duplicates <strong className="block text-slate-100">{selectedMetrics.duplicate_records}</strong></span>
              </div>
            ) : (
              <p className="text-[11px] text-slate-400">Select a source to load metrics.</p>
            )}
          </div>
        </div>
      ) : null}
    </StatusCard>
  )
}

export default SourceManagementPanel
