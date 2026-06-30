import jsPDF from 'jspdf'
import html2canvas from 'html2canvas'

const BRAND_DARK = [30, 30, 46] as const
const BRAND_BLUE = [96, 165, 250] as const
const TEXT_MUTED = [120, 130, 160] as const
const TEXT_MAIN  = [220, 225, 240] as const
const BG_CARD    = [20, 30, 50] as const
const DANGER     = [239, 68, 68] as const
const SUCCESS    = [34, 197, 94] as const
const WARNING    = [245, 158, 11] as const

function setFill(doc: jsPDF, rgb: readonly [number, number, number]) {
  doc.setFillColor(rgb[0], rgb[1], rgb[2])
}
function setDraw(doc: jsPDF, rgb: readonly [number, number, number]) {
  doc.setDrawColor(rgb[0], rgb[1], rgb[2])
}
function setTextColor(doc: jsPDF, rgb: readonly [number, number, number]) {
  doc.setTextColor(rgb[0], rgb[1], rgb[2])
}

function addHeader(doc: jsPDF, title: string) {
  const W = doc.internal.pageSize.getWidth()

  // Background bar
  setFill(doc, BRAND_DARK)
  doc.rect(0, 0, W, 28, 'F')

  // "Dark" text
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(18)
  setTextColor(doc, TEXT_MAIN)
  doc.text('Dark', 14, 17)

  // "Leak" text in blue
  doc.setFont('helvetica', 'bold')
  setTextColor(doc, BRAND_BLUE)
  const darkW = doc.getTextWidth('Dark')
  doc.text('Leak', 14 + darkW + 1, 17)

  // Right-side subtitle
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  setTextColor(doc, TEXT_MUTED)
  const dateStr = new Date().toLocaleString('tr-TR')
  doc.text(dateStr, W - 14, 10, { align: 'right' })
  doc.text(title, W - 14, 18, { align: 'right' })

  // Divider
  setDraw(doc, BRAND_BLUE)
  doc.setLineWidth(0.5)
  doc.line(0, 28, W, 28)
}

function addFooter(doc: jsPDF, pageNum: number, total: number) {
  const W = doc.internal.pageSize.getWidth()
  const H = doc.internal.pageSize.getHeight()
  setDraw(doc, [40, 50, 80])
  doc.setLineWidth(0.3)
  doc.line(14, H - 12, W - 14, H - 12)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7)
  setTextColor(doc, TEXT_MUTED)
  doc.text('DarkLeak — Confidential Security Report', 14, H - 6)
  doc.text(`Page ${pageNum} / ${total}`, W - 14, H - 6, { align: 'right' })
}

// ─── Dashboard stats PDF ───────────────────────────────────────────────────────

interface Stats {
  total_records: number
  pending_analysis: number
  analyzed: number
  total_emails_found: number
  largest_leak_mb: number | null
  latest_collection: string | null
  records_per_source: Record<string, number>
}

export async function exportDashboardPdf(
  stats: Stats,
  chartElementIds: string[],
) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const W = doc.internal.pageSize.getWidth()
  let y = 38

  addHeader(doc, 'Security Overview Report')

  // ── Stats table ──
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10)
  setTextColor(doc, TEXT_MAIN)
  doc.text('System Statistics', 14, y)
  y += 7

  const rows = [
    ['Total Leak Records',   stats.total_records.toLocaleString()],
    ['Pending Analysis',     stats.pending_analysis.toLocaleString()],
    ['Analyzed Records',     stats.analyzed.toLocaleString()],
    ['Total Emails Exposed', stats.total_emails_found.toLocaleString()],
    ['Largest Leak Detected', stats.largest_leak_mb != null ? `${stats.largest_leak_mb} MB` : 'N/A'],
    ['Last Data Collection', stats.latest_collection ? new Date(stats.latest_collection).toLocaleString('tr-TR') : 'N/A'],
  ]

  rows.forEach(([label, value], i) => {
    const rowY = y + i * 9
    setFill(doc, i % 2 === 0 ? BG_CARD : [16, 24, 40])
    doc.rect(14, rowY - 5, W - 28, 9, 'F')
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(9)
    setTextColor(doc, TEXT_MUTED)
    doc.text(label, 18, rowY)
    doc.setFont('helvetica', 'bold')
    setTextColor(doc, TEXT_MAIN)
    doc.text(value, W - 18, rowY, { align: 'right' })
  })

  y += rows.length * 9 + 8

  // ── Records per source ──
  if (Object.keys(stats.records_per_source).length > 0) {
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(10)
    setTextColor(doc, TEXT_MAIN)
    doc.text('Records by Source', 14, y)
    y += 7

    Object.entries(stats.records_per_source).forEach(([source, count], i) => {
      const rowY = y + i * 9
      setFill(doc, i % 2 === 0 ? BG_CARD : [16, 24, 40])
      doc.rect(14, rowY - 5, W - 28, 9, 'F')
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(9)
      setTextColor(doc, TEXT_MUTED)
      doc.text(source, 18, rowY)
      doc.setFont('helvetica', 'bold')
      setTextColor(doc, BRAND_BLUE)
      doc.text(count.toLocaleString(), W - 18, rowY, { align: 'right' })
    })

    y += Object.keys(stats.records_per_source).length * 9 + 8
  }

  // ── Chart screenshots ──
  for (const id of chartElementIds) {
    const el = document.getElementById(id)
    if (!el) continue

    if (y > 220) {
      doc.addPage()
      addHeader(doc, 'Security Overview Report')
      y = 38
    }

    try {
      const canvas = await html2canvas(el, {
        backgroundColor: '#0d1526',
        scale: 2,
        logging: false,
      })
      const imgData = canvas.toDataURL('image/png')
      const imgH = (canvas.height / canvas.width) * (W - 28)
      doc.addImage(imgData, 'PNG', 14, y, W - 28, imgH)
      y += imgH + 8
    } catch {
      // chart capture failed, skip
    }
  }

  const totalPages = (doc as unknown as { internal: { getNumberOfPages: () => number } }).internal.getNumberOfPages()
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i)
    addFooter(doc, i, totalPages)
  }

  doc.save(`darkleak-overview-${new Date().toISOString().slice(0, 10)}.pdf`)
}

// ─── Findings PDF ─────────────────────────────────────────────────────────────

interface Finding {
  id: number
  title: string
  classification: string
  risk_score: number
  is_reviewed: boolean
  is_false_positive: boolean
  created_at: string
  explanation: string | null
}

function classificationColor(c: string): readonly [number, number, number] {
  if (c === 'critical' || c === 'high') return DANGER
  if (c === 'medium') return WARNING
  if (c === 'low') return BRAND_BLUE
  return TEXT_MUTED
}

function statusColor(f: Finding): readonly [number, number, number] {
  if (f.is_false_positive) return TEXT_MUTED
  if (f.is_reviewed) return SUCCESS
  return WARNING
}

function statusLabel(f: Finding) {
  if (f.is_false_positive) return 'False Positive'
  if (f.is_reviewed) return 'Reviewed'
  return 'Pending'
}

export function exportFindingsPdf(findings: Finding[]) {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })
  const W = doc.internal.pageSize.getWidth()
  const H = doc.internal.pageSize.getHeight()
  const MARGIN = 14
  const ROW_H = 8
  const COL = {
    id:    MARGIN,
    title: MARGIN + 14,
    cls:   MARGIN + 100,
    risk:  MARGIN + 136,
    status:MARGIN + 156,
    date:  MARGIN + 186,
  }

  let pageNum = 1
  addHeader(doc, 'Threat Findings Report')

  // ── Summary ──
  let y = 38
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  setTextColor(doc, TEXT_MUTED)

  const pending  = findings.filter(f => !f.is_reviewed && !f.is_false_positive).length
  const critical = findings.filter(f => f.classification === 'critical').length
  const reviewed = findings.filter(f => f.is_reviewed).length

  doc.text(`Total: ${findings.length}`, MARGIN, y)
  doc.text(`Pending: ${pending}`, MARGIN + 40, y)
  doc.text(`Critical: ${critical}`, MARGIN + 80, y)
  doc.text(`Reviewed: ${reviewed}`, MARGIN + 120, y)
  y += 8

  // ── Table header ──
  function drawTableHeader(yPos: number) {
    setFill(doc, [15, 25, 50])
    doc.rect(MARGIN, yPos - 5, W - MARGIN * 2, ROW_H, 'F')
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(7.5)
    setTextColor(doc, BRAND_BLUE)
    doc.text('#',            COL.id,     yPos)
    doc.text('Title',        COL.title,  yPos)
    doc.text('Classification', COL.cls,  yPos)
    doc.text('Risk',         COL.risk,   yPos)
    doc.text('Status',       COL.status, yPos)
    doc.text('Detected',     COL.date,   yPos)
    return yPos + ROW_H + 1
  }

  y = drawTableHeader(y)

  findings.forEach((f, i) => {
    if (y > H - 20) {
      addFooter(doc, pageNum, 0)
      doc.addPage()
      pageNum++
      addHeader(doc, 'Threat Findings Report')
      y = 38
      y = drawTableHeader(y)
    }

    setFill(doc, i % 2 === 0 ? BG_CARD : [12, 20, 38])
    doc.rect(MARGIN, y - 5, W - MARGIN * 2, ROW_H, 'F')

    doc.setFont('helvetica', 'normal')
    doc.setFontSize(7.5)

    setTextColor(doc, TEXT_MUTED)
    doc.text(`${f.id}`, COL.id, y)

    setTextColor(doc, TEXT_MAIN)
    const titleTrunc = f.title.length > 42 ? f.title.slice(0, 42) + '…' : f.title
    doc.text(titleTrunc, COL.title, y)

    setTextColor(doc, classificationColor(f.classification))
    doc.text(f.classification, COL.cls, y)

    const riskColor = f.risk_score >= 80 ? DANGER : f.risk_score >= 50 ? WARNING : BRAND_BLUE
    setTextColor(doc, riskColor)
    doc.text(`${f.risk_score}`, COL.risk, y)

    setTextColor(doc, statusColor(f))
    doc.text(statusLabel(f), COL.status, y)

    setTextColor(doc, TEXT_MUTED)
    doc.text(new Date(f.created_at).toLocaleDateString('tr-TR'), COL.date, y)

    y += ROW_H
  })

  const totalPages = pageNum
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i)
    addFooter(doc, i, totalPages)
  }

  doc.save(`darkleak-findings-${new Date().toISOString().slice(0, 10)}.pdf`)
}
