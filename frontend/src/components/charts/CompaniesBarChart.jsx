function CompaniesBarChart({ companies }) {
  const maxCount = Math.max(...companies.map((company) => company.count), 1);

  return (
    <div className="space-y-2.5">
      {companies.map((company) => (
        <div className="space-y-1.5" key={company.name}>
          <div className="flex items-center justify-between gap-4 text-[11px]">
            <span className="font-medium" style={{ color: "var(--lg-text)" }}>
              {company.name}
            </span>
            <span style={{ color: "var(--lg-muted)" }}>
              {company.count} findings • Score {company.score}
            </span>
          </div>
          <div
            className="h-1.5 rounded-full"
            style={{
              background: "var(--lg-chart-track)",
              boxShadow: "inset 0 1px 1px rgba(15, 23, 42, 0.12)",
            }}
          >
            <div
              className="h-full rounded-full"
              style={{
                width: `${(company.count / maxCount) * 100}%`,
                background: company.color,
              }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

export default CompaniesBarChart;
