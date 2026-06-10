function CompaniesBarChart({ companies }) {
  const maxCount = Math.max(...companies.map((company) => company.count), 1)

  return (
    <div className="space-y-4">
      {companies.map((company) => (
        <div className="space-y-2" key={company.name}>
          <div className="flex items-center justify-between gap-4 text-sm">
            <span className="text-slate-200">{company.name}</span>
            <span className="text-slate-500">
              {company.count} findings • Score {company.score}
            </span>
          </div>
          <div className="h-2.5 rounded-full bg-slate-900/80">
            <div
              className="h-full rounded-full"
              style={{
                width: `${(company.count / maxCount) * 100}%`,
                background: `linear-gradient(90deg, ${company.color}, rgba(255,255,255,0.7))`,
              }}
            />
          </div>
        </div>
      ))}
    </div>
  )
}

export default CompaniesBarChart
