import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

function FindingsLineChart({ data }) {
  return (
    <div className="h-36">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart
          data={data}
          margin={{ top: 12, right: 0, left: -18, bottom: 0 }}
        >
          <CartesianGrid stroke="var(--lg-chart-grid)" vertical={false} />
          <XAxis
            axisLine={false}
            dataKey="date"
            interval="preserveStartEnd"
            minTickGap={16}
            tick={{ fill: "var(--lg-chart-label)", fontSize: 10 }}
            tickLine={false}
          />
          <YAxis
            axisLine={false}
            tick={{ fill: "var(--lg-chart-label)", fontSize: 10 }}
            tickLine={false}
          />
          <Tooltip
            contentStyle={{
              background: "var(--lg-surface-elevated)",
              border: "1px solid var(--lg-control-border)",
              borderRadius: "14px",
              color: "var(--lg-text)",
              boxShadow: "0 12px 24px rgba(32, 43, 56, 0.1)",
            }}
          />
          <Line
            activeDot={{
              fill: "var(--lg-chart-line)",
              r: 3.5,
              stroke: "var(--lg-surface-elevated)",
              strokeWidth: 2,
            }}
            dataKey="findings"
            dot={false}
            fill="none"
            stroke="var(--lg-chart-line)"
            strokeWidth={2.25}
            type="monotone"
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

export default FindingsLineChart;
