import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { companiesApi } from '../api/client'
import type { Company, CompanyCreate } from '../types'
import { Card } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { MoreMenu } from '../components/ui/MoreMenu'
import { SkeletonTableRows } from '../components/ui/Skeleton'
import { toast } from 'sonner'

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

const PAGE_SIZE = 10

export function Companies() {
  const qc = useQueryClient()
  const [adding, setAdding] = useState(false)
  const [newName, setNewName] = useState('')
  const [editingId, setEditingId] = useState<number | null>(null)
  const [editName, setEditName] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const [search, setSearch] = useState('')
  const [sortKey, setSortKey] = useState<'id' | 'name'>('id')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')

  const handleSort = (col: 'id' | 'name') => {
    if (col === sortKey) setSortDir((d) => d === 'asc' ? 'desc' : 'asc')
    else { setSortKey(col); setSortDir('asc') }
  }

  const { data: companies, isLoading } = useQuery<Company[]>({
    queryKey: ['companies'],
    queryFn: () => companiesApi.list(),
  })

  const createMutation = useMutation({
    mutationFn: (data: CompanyCreate) => companiesApi.create(data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['companies'] }); setAdding(false); setNewName(''); toast.success('Company added') },
    onError: () => toast.error('Failed to add company'),
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, name }: { id: number; name: string }) =>
      companiesApi.update(id, { name }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['companies'] }); setEditingId(null); toast.success('Company updated') },
    onError: () => toast.error('Failed to update company'),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: number) => companiesApi.delete(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['companies'] }); toast.success('Company deleted') },
    onError: () => toast.error('Failed to delete company'),
  })

  const allCompanies = (companies ?? [])
    .filter((c) => c.name.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => {
      const va = sortKey === 'id' ? a.id : a.name.toLowerCase()
      const vb = sortKey === 'id' ? b.id : b.name.toLowerCase()
      if (va < vb) return sortDir === 'asc' ? -1 : 1
      if (va > vb) return sortDir === 'asc' ? 1 : -1
      return 0
    })
  const totalPages = Math.ceil(allCompanies.length / PAGE_SIZE)
  const paged = allCompanies.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE)

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-[var(--text)]">Companies</h2>
          <p className="text-xs text-[var(--text-muted)] mt-0.5">
            {allCompanies.length} of {companies?.length ?? 0} companies
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <svg viewBox="0 0 16 16" fill="currentColor" className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[var(--text-muted)] pointer-events-none">
              <path d="M11.742 10.344a6.5 6.5 0 1 0-1.397 1.398h-.001q.044.06.098.115l3.85 3.85a1 1 0 0 0 1.415-1.414l-3.85-3.85a1 1 0 0 0-.115-.1zM12 6.5a5.5 5.5 0 1 1-11 0 5.5 5.5 0 0 1 11 0" />
            </svg>
            <input
              type="text"
              placeholder="Search companies…"
              value={search}
              onChange={(e) => { setSearch(e.target.value); setCurrentPage(1) }}
              className="pl-8 pr-3 h-8 w-52 rounded-lg border border-[var(--border)] bg-[var(--surface)] text-sm text-[var(--text)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[var(--primary)] transition-colors"
            />
          </div>
          {!adding && (
            <Button size="sm" onClick={() => setAdding(true)}>
              <svg viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5">
                <path d="M10.75 4.75a.75.75 0 0 0-1.5 0v4.5h-4.5a.75.75 0 0 0 0 1.5h4.5v4.5a.75.75 0 0 0 1.5 0v-4.5h4.5a.75.75 0 0 0 0-1.5h-4.5v-4.5Z" />
              </svg>
              Add Company
            </Button>
          )}
        </div>
      </div>

      {adding && (
        <Card className="p-4">
          <p className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wide mb-3">New Company</p>
          <form
            onSubmit={(e) => { e.preventDefault(); createMutation.mutate({ name: newName }) }}
            className="flex gap-2"
          >
            <input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Company name"
              required
              className="flex-1 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--text)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[var(--primary)] transition-colors"
            />
            <Button type="submit" loading={createMutation.isPending}>Save</Button>
            <Button type="button" variant="secondary" onClick={() => { setAdding(false); setNewName('') }}>Cancel</Button>
          </form>
        </Card>
      )}

      <Card>
        {!isLoading && (!companies || companies.length === 0) ? (
          <div className="flex flex-col items-center py-16 text-[var(--text-muted)]">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className="w-10 h-10 mb-3 opacity-30">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3.75 21h16.5M4.5 3h15M5.25 3v18m13.5-18v18M9 6.75h1.5m-1.5 3h1.5m-1.5 3h1.5m3-6H15m-1.5 3H15m-1.5 3H15M9 21v-3.375c0-.621.504-1.125 1.125-1.125h3.75c.621 0 1.125.504 1.125 1.125V21" />
            </svg>
            <p className="text-sm">No companies yet.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--border)]">
                  {(['id', 'name'] as const).map((col) => (
                    <th key={col} className="text-left px-5 py-3">
                      <button
                        onClick={() => { handleSort(col); setCurrentPage(1) }}
                        className={`flex items-center gap-1 text-xs font-semibold uppercase tracking-wide transition-colors ${
                          sortKey === col ? 'text-[var(--primary)]' : 'text-[var(--text-muted)] hover:text-[var(--text)]'
                        }`}
                      >
                        {col === 'id' ? 'ID' : 'Company Name'}
                        <svg viewBox="0 0 16 16" fill="currentColor" className={`w-3 h-3 transition-opacity ${sortKey === col ? 'opacity-100' : 'opacity-30'}`}>
                          {sortKey === col && sortDir === 'asc'
                            ? <path d="M8 3.5a.5.5 0 0 1 .5.5v6.793l2.146-2.147a.5.5 0 0 1 .708.708l-3 3a.5.5 0 0 1-.708 0l-3-3a.5.5 0 1 1 .708-.708L7.5 10.793V4a.5.5 0 0 1 .5-.5Z" transform="rotate(180 8 8)" />
                            : sortKey === col && sortDir === 'desc'
                            ? <path d="M8 3.5a.5.5 0 0 1 .5.5v6.793l2.146-2.147a.5.5 0 0 1 .708.708l-3 3a.5.5 0 0 1-.708 0l-3-3a.5.5 0 1 1 .708-.708L7.5 10.793V4a.5.5 0 0 1 .5-.5Z" />
                            : <path d="M5.854 4.646a.5.5 0 0 0-.708 0l-2 2a.5.5 0 0 0 .708.708L5 6.207V11.5a.5.5 0 0 0 1 0V6.207l1.146 1.147a.5.5 0 1 0 .708-.708l-2-2Zm5 .708L12.146 6.5a.5.5 0 0 0 .708-.708l-2-2a.5.5 0 0 0-.708 0l-2 2a.5.5 0 0 0 .708.708L10 5.207V10.5a.5.5 0 0 0 1 0V5.207l1.146 1.147Z" />
                          }
                        </svg>
                      </button>
                    </th>
                  ))}
                  <th className="w-10" />
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <SkeletonTableRows rows={5} widths={['w-10', 'w-1/2', 'w-6']} />
                ) : paged.map((company) => (
                  <tr key={company.id} className="border-b border-[var(--border)] last:border-0 hover:bg-[var(--surface)] transition-colors">
                    {editingId === company.id ? (
                      <td colSpan={3} className="px-5 py-3">
                        <form
                          onSubmit={(e) => { e.preventDefault(); updateMutation.mutate({ id: company.id, name: editName }) }}
                          className="flex gap-2"
                        >
                          <input
                            value={editName}
                            onChange={(e) => setEditName(e.target.value)}
                            required
                            className="flex-1 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--text)] focus:outline-none focus:border-[var(--primary)] transition-colors"
                          />
                          <Button type="submit" loading={updateMutation.isPending} size="sm">Save</Button>
                          <Button type="button" variant="secondary" size="sm" onClick={() => setEditingId(null)}>Cancel</Button>
                        </form>
                      </td>
                    ) : (
                      <>
                        <td className="px-5 py-3 text-[var(--text-muted)] font-mono text-xs">#{company.id}</td>
                        <td className="px-5 py-3 font-medium text-[var(--text)]">{company.name}</td>
                        <td className="px-5 py-3 text-right">
                          <MoreMenu
                            actions={[
                              {
                                label: 'Edit',
                                icon: <PencilIcon />,
                                onClick: () => { setEditingId(company.id); setEditName(company.name) },
                              },
                              {
                                label: 'Delete',
                                icon: <TrashIcon />,
                                onClick: () => { if (confirm(`Delete "${company.name}"?`)) deleteMutation.mutate(company.id) },
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
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-5 py-3 border-t border-[var(--border)]">
            <span className="text-xs text-[var(--text-muted)]">
              {(currentPage - 1) * PAGE_SIZE + 1}–{Math.min(currentPage * PAGE_SIZE, allCompanies.length)} / {allCompanies.length}
            </span>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="h-7 w-7 rounded-lg border border-[var(--border)] bg-[var(--surface)] flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--text)] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              >
                <svg viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5">
                  <path fillRule="evenodd" d="M11.78 5.22a.75.75 0 0 1 0 1.06L8.06 10l3.72 3.72a.75.75 0 1 1-1.06 1.06l-4.25-4.25a.75.75 0 0 1 0-1.06l4.25-4.25a.75.75 0 0 1 1.06 0Z" clipRule="evenodd" />
                </svg>
              </button>
              <span className="text-xs text-[var(--text-muted)] tabular-nums px-2">{currentPage} / {totalPages}</span>
              <button
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="h-7 w-7 rounded-lg border border-[var(--border)] bg-[var(--surface)] flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--text)] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              >
                <svg viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5">
                  <path fillRule="evenodd" d="M8.22 5.22a.75.75 0 0 1 1.06 0l4.25 4.25a.75.75 0 0 1 0 1.06l-4.25 4.25a.75.75 0 0 1-1.06-1.06L11.94 10 8.22 6.28a.75.75 0 0 1 0-1.06Z" clipRule="evenodd" />
                </svg>
              </button>
            </div>
          </div>
        )}
      </Card>
    </div>
  )
}
