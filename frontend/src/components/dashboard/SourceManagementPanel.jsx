import { ChevronDown, Database, Play, RefreshCw, Search } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import StatusCard from "../cards/StatusCard";
import {
  createSource,
  getSources,
  testSourceCrawl,
  updateSource,
} from "../../api/client";

const emptyForm = {
  name: "",
  url: "",
};

function SourceManagementPanel() {
  const [sources, setSources] = useState([]);
  const [filters, setFilters] = useState({ name: "", isActive: "all" });
  const [form, setForm] = useState(emptyForm);
  const [editingSourceId, setEditingSourceId] = useState(null);
  const [selectedSourceId, setSelectedSourceId] = useState(null);
  const [statusMessage, setStatusMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [sourcesPage, setSourcesPage] = useState(1);
  const SOURCES_PER_PAGE = 5;

  const totalSourcesPages = Math.max(
    1,
    Math.ceil(sources.length / SOURCES_PER_PAGE),
  );
  const paginatedSources = useMemo(() => {
    return sources.slice(
      (sourcesPage - 1) * SOURCES_PER_PAGE,
      sourcesPage * SOURCES_PER_PAGE,
    );
  }, [sources, sourcesPage]);

  useEffect(() => {
    if (sourcesPage > totalSourcesPages) {
      setSourcesPage(totalSourcesPages);
    }
  }, [sourcesPage, totalSourcesPages]);

  async function loadSources(nextFilters = filters) {
    setIsLoading(true);
    setErrorMessage("");

    try {
      const data = await getSources({
        name: nextFilters.name.trim(),
        isActive:
          nextFilters.isActive === "all"
            ? undefined
            : nextFilters.isActive === "active",
      });
      setSources(data);
      setSourcesPage(1);
      if (!selectedSourceId && data.length > 0) {
        setSelectedSourceId(data[0].id);
      }
    } catch (error) {
      setErrorMessage(error.message || "Failed to load sources.");
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    loadSources(filters);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters]);

  async function handleSubmit(event) {
    event.preventDefault();
    if (!form.name.trim() || !form.url.trim()) return;

    setIsSubmitting(true);
    setErrorMessage("");
    setStatusMessage("");

    try {
      if (editingSourceId) {
        const updatedSource = await updateSource(editingSourceId, {
          name: form.name.trim(),
          url: form.url.trim(),
        });
        setStatusMessage(`${updatedSource.name} updated.`);
      } else {
        const createdSource = await createSource({
          name: form.name.trim(),
          url: form.url.trim(),
        });
        setSelectedSourceId(createdSource.id);
        setStatusMessage(`${createdSource.name} created.`);
      }

      setForm(emptyForm);
      setEditingSourceId(null);
      await loadSources();
    } catch (error) {
      setErrorMessage(error.message || "Failed to save source.");
    } finally {
      setIsSubmitting(false);
    }
  }

  function handleEdit(source) {
    setEditingSourceId(source.id);
    setForm({ name: source.name, url: source.url });
    setSelectedSourceId(source.id);
  }

  async function handleTestCrawl(sourceId) {
    setErrorMessage("");
    setStatusMessage("");

    try {
      const job = await testSourceCrawl(sourceId);
      setStatusMessage(`Test crawl queued as job #${job.job_id}.`);
    } catch (error) {
      setErrorMessage(error.message || "Failed to queue test crawl.");
    }
  }

  return (
    <StatusCard
      actions={
        <button
          className="btn-secondary inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-[10px]"
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
            <Database
              className="h-4 w-4"
              style={{ color: "var(--lg-accent)" }}
            />
            {editingSourceId ? "Edit Source" : "New Source"}
          </div>

          <label className="block text-[10px] uppercase tracking-[0.16em] text-slate-500">
            Name
            <input
              className="mt-1 w-full rounded-lg border border-slate-800 bg-slate-950/70 px-2.5 py-2 text-[12px] normal-case tracking-normal text-slate-100 outline-none transition"
              onChange={(event) =>
                setForm((current) => ({ ...current, name: event.target.value }))
              }
              style={{ caretColor: "var(--lg-accent)" }}
              value={form.name}
            />
          </label>

          <label className="mt-3 block text-[10px] uppercase tracking-[0.16em] text-slate-500">
            URL
            <input
              className="mt-1 w-full rounded-lg border border-slate-800 bg-slate-950/70 px-2.5 py-2 text-[12px] normal-case tracking-normal text-slate-100 outline-none transition"
              onChange={(event) =>
                setForm((current) => ({ ...current, url: event.target.value }))
              }
              style={{ caretColor: "var(--lg-accent)" }}
              value={form.url}
            />
          </label>

          <div className="mt-3 flex flex-wrap gap-2">
            <button
              className="btn-secondary rounded-lg px-2.5 py-1.5 text-[11px] disabled:cursor-not-allowed disabled:opacity-50"
              disabled={isSubmitting || !form.name.trim() || !form.url.trim()}
              type="submit"
            >
              {editingSourceId ? "Save" : "Create"}
            </button>
            {editingSourceId ? (
              <button
                className="btn-secondary rounded-lg px-2.5 py-1.5 text-[11px] text-slate-300"
                onClick={() => {
                  setEditingSourceId(null);
                  setForm(emptyForm);
                }}
                type="button"
              >
                Cancel
              </button>
            ) : null}
          </div>
        </form>

        <div className="space-y-3">
          <div className="flex flex-wrap gap-2">
            <label className="flex min-w-[180px] flex-1 items-center gap-2 rounded-lg border border-slate-800 bg-slate-950/70 px-2.5 py-2">
              <Search className="h-3.5 w-3.5 text-slate-500" />
              <input
                className="w-full bg-transparent text-[12px] text-slate-100 outline-none placeholder:text-slate-600"
                onChange={(event) =>
                  setFilters((current) => ({
                    ...current,
                    name: event.target.value,
                  }))
                }
                placeholder="Filter by name"
                value={filters.name}
              />
            </label>
            <div className="relative min-w-[108px]">
              <select
                className="w-full appearance-none rounded-lg border border-slate-800 px-2.5 py-2 pr-8 text-[12px] outline-none"
                onChange={(event) =>
                  setFilters((current) => ({
                    ...current,
                    isActive: event.target.value,
                  }))
                }
                style={{
                  WebkitAppearance: "none",
                  MozAppearance: "none",
                  appearance: "none",
                  background: "var(--lg-card)",
                  boxShadow: "none",
                  color: "var(--lg-text)",
                }}
                value={filters.isActive}
              >
                <option value="all">All</option>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
              <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-500" />
            </div>
          </div>

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
              <p className="px-3 py-3 text-[11px] text-slate-400">
                Loading sources...
              </p>
            ) : paginatedSources.length === 0 ? (
              <p className="px-3 py-3 text-[11px] text-slate-400">
                No sources match this view.
              </p>
            ) : (
              paginatedSources.map((source) => (
                <div
                  className={`grid min-w-[680px] grid-cols-[0.9fr_1.3fr_0.6fr_1.2fr] items-center gap-2 border-t border-slate-800 px-3 py-2 text-[11px] ${
                    selectedSourceId === source.id
                      ? "bg-slate-900/80"
                      : "bg-slate-950/35"
                  }`}
                  key={source.id}
                >
                  <button
                    className="inline-block max-w-[140px] truncate text-left text-slate-100"
                    onClick={() => setSelectedSourceId(source.id)}
                    type="button"
                    style={{
                      color:
                        selectedSourceId === source.id
                          ? "var(--lg-text)"
                          : undefined,
                    }}
                  >
                    {source.name}
                  </button>
                  <span className="truncate text-slate-400">{source.url}</span>
                  <span
                    className={
                      source.is_active ? "text-emerald-300" : "text-slate-500"
                    }
                  >
                    {source.is_active ? "Active" : "Inactive"}
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    <button
                      className="rounded-md border border-slate-700 px-2 py-1 text-slate-300"
                      onClick={() => handleEdit(source)}
                      type="button"
                    >
                      Edit
                    </button>
                    <button
                      className="inline-flex items-center gap-1 rounded-md border border-slate-700 px-2 py-1 text-slate-200"
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
          {sources.length > SOURCES_PER_PAGE ? (
            <div className="mt-3 flex items-center justify-between text-[11px] text-slate-400">
              <span>
                Showing {(sourcesPage - 1) * SOURCES_PER_PAGE + 1} to{" "}
                {Math.min(sourcesPage * SOURCES_PER_PAGE, sources.length)} of{" "}
                {sources.length} sources
              </span>
              <div className="flex items-center gap-1.5">
                <button
                  className="rounded border border-slate-800 bg-slate-950/80 px-2.5 py-1 text-slate-300 disabled:opacity-40"
                  disabled={sourcesPage === 1}
                  onClick={() => setSourcesPage(sourcesPage - 1)}
                  type="button"
                >
                  Prev
                </button>
                <span className="rounded border border-slate-700 bg-[#060b18] px-2 py-0.5 text-slate-200">
                  {sourcesPage}
                </span>
                <button
                  className="rounded border border-slate-800 bg-slate-950/80 px-2.5 py-1 text-slate-300 disabled:opacity-40"
                  disabled={sourcesPage === totalSourcesPages}
                  onClick={() => setSourcesPage(sourcesPage + 1)}
                  type="button"
                >
                  Next
                </button>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </StatusCard>
  );
}

export default SourceManagementPanel;
