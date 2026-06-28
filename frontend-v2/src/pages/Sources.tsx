import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { sourcesApi } from '../api/client'
import type { Source, SourceCreate } from '../types'
import { Card } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { Badge } from '../components/ui/Badge'
import { MoreMenu } from '../components/ui/MoreMenu'
import { SkeletonTableRows } from '../components/ui/Skeleton'
import { toast } from 'sonner'

function SourceForm({
  initial,
  onSubmit,
  onCancel,
  loading,
}: {
  initial?: Partial<SourceCreate>
  onSubmit: (data: SourceCreate) => void
  onCancel: () => void
  loading: boolean
}) {
  const [name, setName] = useState(initial?.name ?? '')
  const [url, setUrl] = useState(initial?.url ?? '')

  return (
    <form
      onSubmit={(e) => { e.preventDefault(); onSubmit({ name, url }) }}
      className="flex flex-col sm:flex-row gap-2"
    >
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Source name"
        required
        className="flex-1 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--text)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[var(--primary)] transition-colors"
      />
      <input
        value={url}
        onChange={(e) => setUrl(e.target.value)}
        placeholder="https://..."
        required
        type="url"
        className="flex-1 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--text)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[var(--primary)] transition-colors"
      />
      <div className="flex gap-2">
        <Button type="submit" loading={loading}>Save</Button>
        <Button type="button" variant="secondary" onClick={onCancel}>Cancel</Button>
      </div>
    </form>
  )
}

const PlayIcon = () => (
  <svg viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5">
    <path d="M6.3 2.84A1.5 1.5 0 0 0 4 4.11v11.78a1.5 1.5 0 0 0 2.3 1.27l9.344-5.891a1.5 1.5 0 0 0 0-2.538L6.3 2.84Z" />
  </svg>
)
const BeakerIcon = () => (
  <svg viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5">
    <path fillRule="evenodd" d="M8.5 3.528v4.644c0 .414-.168.81-.463 1.11l-5.579 5.699A1.5 1.5 0 0 0 3.544 17H16.456a1.5 1.5 0 0 0 1.086-2.019l-5.579-5.699A1.5 1.5 0 0 1 11.5 8.172V3.528a8.732 8.732 0 0 0 1-.056V2.75a.75.75 0 0 0-.75-.75h-3.5a.75.75 0 0 0-.75.75v.722c.33.038.664.056 1 .056Z" clipRule="evenodd" />
  </svg>
)
const PencilIcon = () => (
  <svg viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5">
    <path d="m5.433 13.917 1.262-3.155A4 4 0 0 1 7.58 9.42l6.92-6.918a2.121 2.121 0 0 1 3 3l-6.92 6.918c-.383.383-.84.685-1.343.886l-3.154 1.262a.5.5 0 0 1-.65-.65Z" />
    <path d="M3.5 5.75c0-.69.56-1.25 1.25-1.25H10A.75.75 0 0 0 10 3H4.75A2.75 2.75 0 0 0 2 5.75v9.5A2.75 2.75 0 0 0 4.75 18h9.5A2.75 2.75 0 0 0 17 15.25V10a.75.75 0 0 0-1.5 0v5.25c0 .69-.56 1.25-1.25 1.25h-9.5c-.69 0-1.25-.56-1.25-1.25v-9.5Z" />
  </svg>
)
const TrashIcon = () => (
  <svg viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5">
    <path fillRule="evenodd" d="M8.75 1A2.75 2.75 0 0 0 6 3.75v.443c-.795.077-1.584.176-2.365.298a.75.75 0 1 0 .23 1.482l.149-.022.841 10.518A2.75 2.75 0 0 0 7.596 19h4.807a2.75 2.75 0 0 0 2.742-2.53l.841-10.52.149.023a.75.75 0 0 0 .23-1.482A41.03 41.03 0 0 0 14 4.193V3.75A2.75 2.75 0 0 0 11.25 1h-2.5ZM10 4c.84 0 1.673.025 2.5.075V3.75c0-.69-.56-1.25-1.25-1.25h-2.5c-.69 0-1.25.56-1.25 1.25v.325C8.327 4.025 9.16 4 10 4ZM8.58 7.72a.75.75 0 0 0-1.5.06l.3 7.5a.75.75 0 1 0 1.5-.06l-.3-7.5Zm4.34.06a.75.75 0 1 0-1.5-.06l-.3 7.5a.75.75 0 1 0 1.5.06l.3-7.5Z" clipRule="evenodd" />
  </svg>
)
const ToggleIcon = () => (
  <svg viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5">
    <path d="M17 4H3a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1V5a1 1 0 0 0-1-1Zm-9 8.5a2.5 2.5 0 1 1 0-5 2.5 2.5 0 0 1 0 5Z" />
  </svg>
)

export function Sources() {
  const qc = useQueryClient()
  const [adding, setAdding] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)

  const { data: sources, isLoading } = useQuery<Source[]>({
    queryKey: ['sources'],
    queryFn: () => sourcesApi.list(),
  })

  const createMutation = useMutation({
    mutationFn: (data: SourceCreate) => sourcesApi.create(data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['sources'] }); setAdding(false); toast.success('Source added') },
    onError: () => toast.error('Failed to add source'),
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: SourceCreate }) => sourcesApi.update(id, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['sources'] }); setEditingId(null); toast.success('Source updated') },
    onError: () => toast.error('Failed to update source'),
  })

  const toggleMutation = useMutation({
    mutationFn: (id: number) => sourcesApi.toggle(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['sources'] }); toast.success('Source status updated') },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: number) => sourcesApi.delete(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['sources'] }); toast.success('Source deleted') },
    onError: () => toast.error('Failed to delete source'),
  })

  const crawlMutation = useMutation({
    mutationFn: (id: number) => sourcesApi.startCrawl(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['crawl-jobs'] }); toast.success('Crawl job started') },
    onError: () => toast.error('Failed to start crawl'),
  })

  const testCrawlMutation = useMutation({
    mutationFn: (id: number) => sourcesApi.testCrawl(id),
    onSuccess: () => toast.success('Test crawl complete'),
    onError: () => toast.error('Test crawl failed'),
  })

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold text-[var(--text)]">Data Sources</h2>
          <p className="text-xs text-[var(--text-muted)] mt-0.5">
            {sources?.length ?? 0} configured sources · {sources?.filter(s => s.is_active).length ?? 0} active
          </p>
        </div>
        {!adding && (
          <Button onClick={() => setAdding(true)} size="sm">
            <svg viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5">
              <path d="M10.75 4.75a.75.75 0 0 0-1.5 0v4.5h-4.5a.75.75 0 0 0 0 1.5h4.5v4.5a.75.75 0 0 0 1.5 0v-4.5h4.5a.75.75 0 0 0 0-1.5h-4.5v-4.5Z" />
            </svg>
            Add Source
          </Button>
        )}
      </div>

      {adding && (
        <Card className="p-4">
          <p className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wide mb-3">New Source</p>
          <SourceForm
            onSubmit={(data) => createMutation.mutate(data)}
            onCancel={() => setAdding(false)}
            loading={createMutation.isPending}
          />
        </Card>
      )}

      <Card>
        {!isLoading && (!sources || sources.length === 0) ? (
          <div className="flex flex-col items-center py-16 text-[var(--text-muted)]">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className="w-10 h-10 mb-3 opacity-30">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 7.5l-9-5.25L3 7.5m18 0l-9 5.25m9-5.25v9l-9 5.25M3 7.5l9 5.25M3 7.5v9l9 5.25m0-9v9" />
            </svg>
            <p className="text-sm font-medium">No sources configured</p>
            <p className="text-xs mt-1 text-[var(--text-muted)]">Add a data source to start monitoring darknet activity.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--border)]">
                  <th className="text-left px-5 py-3 text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wide">Name</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wide">URL</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wide">Status</th>
                  <th className="w-10" />
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <SkeletonTableRows rows={5} widths={['w-32', 'w-2/5', 'w-16', 'w-6']} />
                ) : (sources ?? []).map((source) => (
                  <tr key={source.id} className="border-b border-[var(--border)] last:border-0 hover:bg-[var(--surface)] transition-colors">
                    {editingId === source.id ? (
                      <td colSpan={4} className="px-5 py-3">
                        <SourceForm
                          initial={{ name: source.name, url: source.url }}
                          onSubmit={(data) => updateMutation.mutate({ id: source.id, data })}
                          onCancel={() => setEditingId(null)}
                          loading={updateMutation.isPending}
                        />
                      </td>
                    ) : (
                      <>
                        <td className="px-5 py-3 font-medium text-[var(--text)]">{source.name}</td>
                        <td className="px-5 py-3 text-[var(--text-muted)] max-w-xs truncate">
                          <a href={source.url} target="_blank" rel="noreferrer" className="hover:text-[var(--primary)] transition-colors">
                            {source.url}
                          </a>
                        </td>
                        <td className="px-5 py-3">
                          <Badge variant={source.is_active ? 'success' : 'default'}>
                            {source.is_active ? 'Active' : 'Inactive'}
                          </Badge>
                        </td>
                        <td className="px-5 py-3 text-right">
                          <MoreMenu
                            actions={[
                              {
                                label: 'Start Crawl',
                                icon: <PlayIcon />,
                                onClick: () => crawlMutation.mutate(source.id),
                                disabled: crawlMutation.isPending,
                              },
                              {
                                label: 'Test Crawl',
                                icon: <BeakerIcon />,
                                onClick: () => testCrawlMutation.mutate(source.id),
                                disabled: testCrawlMutation.isPending,
                              },
                              {
                                label: source.is_active ? 'Deactivate' : 'Activate',
                                icon: <ToggleIcon />,
                                onClick: () => toggleMutation.mutate(source.id),
                              },
                              {
                                label: 'Edit',
                                icon: <PencilIcon />,
                                onClick: () => setEditingId(source.id),
                              },
                              {
                                label: 'Delete',
                                icon: <TrashIcon />,
                                onClick: () => { if (confirm(`Delete "${source.name}"?`)) deleteMutation.mutate(source.id) },
                                danger: true,
                              },
                            ]}
                          />
                        </td>
                      </>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  )
}
