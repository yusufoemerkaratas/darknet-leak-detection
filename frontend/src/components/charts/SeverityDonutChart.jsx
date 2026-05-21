import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts'

function SeverityDonutChart({ data, total }) {
  return (
    <div className="relative h-40">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            dataKey="value"
            innerRadius={38}
            outerRadius={56}
            paddingAngle={2}
            stroke="rgba(2, 6, 23, 0.9)"
            strokeWidth={4}
          >
            {data.map((entry) => (
              <Cell fill={entry.color} key={entry.label} />
            ))}
          </Pie>
          <Tooltip
            contentStyle={{
              background: 'rgba(6, 11, 29, 0.96)',
              border: '1px solid rgba(71, 85, 105, 0.45)',
              borderRadius: '16px',
              color: '#e2e8f0',
            }}
          />
        </PieChart>
      </ResponsiveContainer>

      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-display text-[1.4rem] font-semibold text-white">{total}</span>
        <span className="text-[10px] text-slate-400">Total</span>
      </div>
    </div>
  )
}

export default SeverityDonutChart
