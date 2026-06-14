# Frontend Backend Map

This map documents the current dashboard integration points for issue #43. It uses only endpoints that exist in the FastAPI backend.

| Frontend Area | Component | API Function | Method | Backend Endpoint | Request | Response | Status |
|---|---|---|---|---|---|---|---|
| Dashboard overview | `Dashboard.jsx`, `StatCard`, `LatestCriticalAlerts`, `RecentFindings`, right panel cards | `getDashboardOverview(timelineRange)` | GET | `/api/dashboard/overview` | `timeline_range=7d/30d/365d` | `DashboardOverviewOut` with summary, findings, critical alerts, live feed, timeline, data sources, severity, companies, detection status | Connected |
| Finding detail modal | `FindingDetailModal` | `getFindingDetail(findingId)` | GET | `/api/dashboard/findings/{finding_id}` | path param `finding_id` | `DashboardFindingDetailOut` including `llm_explanation`, evidence, recommended action | Connected |
| Finding status update | `FindingDetailModal` review actions | `updateFindingStatus(findingId, status)` | PATCH | `/api/dashboard/findings/{finding_id}/status` | `{ "status": "Reviewed" }` | updated `DashboardFindingDetailOut` | Connected |
| Backend summary stats | `Dashboard.jsx` summary merge | `getDashboardBackendStats(days)` | GET | `/api/stats/overview` | none | total findings, critical alerts, reviewed findings, monitored companies, latest finding timestamp | Connected |
| Timeline chart | `FindingsLineChart` through `Dashboard.jsx` | `getDashboardBackendStats(days)` | GET | `/api/stats/findings-by-day` | `days` query param | date buckets for chart data | Connected |
| Alert severity chart fallback | `Dashboard.jsx` severity merge | `getDashboardBackendStats(days)` | GET | `/api/stats/alerts-by-severity` | none | severity/count mapping | Connected |
| Company filters | `FindingsTable` filter dropdown | `getCompanies()` | GET | `/api/companies` | none | list of companies | Connected |
| Source management panel | `SourceManagementPanel` | `getSources(filters)` | GET | `/api/sources` | optional `name`, `is_active` | list of configured sources | Connected |
| Source create | `SourceManagementPanel` | `createSource(source)` | POST | `/api/sources` | source payload | source response | Connected |
| Source update | `SourceManagementPanel` | `updateSource(sourceId, source)` | PATCH | `/api/sources/{source_id}` | source update payload | source response | Connected |
| Source toggle | `SourceManagementPanel` | `toggleSource(sourceId)` | PATCH | `/api/sources/{source_id}/toggle` | path param `source_id` | source response | Connected |
| Source health | `SourceManagementPanel` | `getSourceHealth(sourceId)` | GET | `/api/sources/{source_id}/health` | path param `source_id` | source health metrics | Connected |
| Source metrics | `SourceManagementPanel` | `getSourceMetrics(sourceId)` | GET | `/api/sources/{source_id}/metrics` | path param `source_id` | source crawl metrics | Connected |
| Source test crawl | `SourceManagementPanel` | `testSourceCrawl(sourceId)` | POST | `/api/sources/{source_id}/test-crawl` | path param `source_id` | manual crawl job summary | Connected |
| Full findings API | future full findings page | not split yet | GET | `/api/findings` | filters, pagination | paginated findings | Backend available, not a separate page yet |
| Full alerts API | future alerts page | not split yet | GET | `/api/alerts` | filters, pagination | paginated alerts | Backend available, not a separate page yet |
| Health check | system status | not called directly in dashboard | GET | `/api/health` | none | health status | Backend available |

## Notes

- The frontend currently uses a centralized API module at `frontend/src/api/client.js`.
- The dashboard has no authentication flow, so the API client does not attach auth headers.
- Live monitoring uses the dashboard overview REST response and refreshes every 30 seconds. No WebSocket/SSE endpoint exists yet.
- Dashboard preview/fallback data is produced by the backend dashboard router when the database is unavailable; frontend mock data is limited to navigation/right-panel metadata.
