import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

function FindingsLineChart({ data }) {
  return (
    <div className="h-36">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 12, right: 0, left: -18, bottom: 0 }}>
          <defs>
            <linearGradient id="findingsGlow" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor="#fb7185" stopOpacity={0.4} />
              <stop offset="100%" stopColor="#fb7185" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke="rgba(148, 163, 184, 0.08)" vertical={false} />
          <XAxis
            axisLine={false}
            dataKey="date"
            interval="preserveStartEnd"
            minTickGap={16}
            tick={{ fill: '#94a3b8', fontSize: 10 }}
            tickLine={false}
          />
          <YAxis
            axisLine={false}
            tick={{ fill: '#94a3b8', fontSize: 10 }}
            tickLine={false}
          />
          <Tooltip
            contentStyle={{
              background: 'rgba(6, 11, 29, 0.96)',
              border: '1px solid rgba(71, 85, 105, 0.45)',
              borderRadius: '16px',
              color: '#e2e8f0',
            }}
          />
          <Area
            dataKey="findings"
            fill="url(#findingsGlow)"
            stroke="#fb7185"
            strokeWidth={2.5}
            type="monotone"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}

export default FindingsLineChart
