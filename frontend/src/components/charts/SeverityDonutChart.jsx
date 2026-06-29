import { useEffect, useState } from "react";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";

const donutToneMap = {
  dark: {
    Critical: "#a86c6c",
    Medium: "#ad9568",
    Low: "#34d399",
  },
  light: {
    Critical: "#b98383",
    Medium: "#baa06d",
    Low: "#10b981",
  },
};

function SeverityDonutChart({ data, total }) {
  const [isLightTheme, setIsLightTheme] = useState(false);

  useEffect(() => {
    const root = document.documentElement;
    const syncTheme = () => {
      setIsLightTheme(root.getAttribute("data-theme") === "light");
    };

    syncTheme();

    const observer = new MutationObserver(syncTheme);
    observer.observe(root, {
      attributes: true,
      attributeFilter: ["data-theme"],
    });

    return () => observer.disconnect();
  }, []);

  const toneMap = isLightTheme ? donutToneMap.light : donutToneMap.dark;

  return (
    <div className="severity-donut-shell relative h-40 overflow-hidden rounded-[18px]">
      <div
        className="pointer-events-none absolute inset-x-8 top-5 h-20 rounded-full blur-3xl"
        style={{
          background: isLightTheme
            ? "radial-gradient(circle, rgba(118, 166, 206, 0.12), transparent 72%)"
            : "radial-gradient(circle, rgba(110, 168, 215, 0.18), transparent 72%)",
        }}
      />
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            dataKey="value"
            innerRadius={40}
            outerRadius={54}
            paddingAngle={3}
            stroke={
              isLightTheme
                ? "rgba(222, 232, 240, 0.92)"
                : "rgba(13, 18, 24, 0.34)"
            }
            strokeWidth={3}
          >
            {data.map((entry) => (
              <Cell
                fill={toneMap[entry.label] ?? entry.color}
                key={entry.label}
              />
            ))}
          </Pie>
          <Tooltip
            contentStyle={{
              background: isLightTheme
                ? "rgba(247, 250, 252, 0.96)"
                : "rgba(18, 24, 31, 0.94)",
              border: isLightTheme
                ? "1px solid rgba(151, 170, 188, 0.22)"
                : "1px solid rgba(110, 128, 148, 0.28)",
              borderRadius: "14px",
              color: isLightTheme ? "#243444" : "#d9e2ea",
              boxShadow: isLightTheme
                ? "0 12px 24px rgba(90, 109, 129, 0.1)"
                : "0 12px 24px rgba(4, 8, 14, 0.16)",
            }}
          />
        </PieChart>
      </ResponsiveContainer>

      <div className="severity-donut-core pointer-events-none absolute inset-0 m-auto flex h-[82px] w-[82px] flex-col items-center justify-center rounded-full">
        <span
          className="font-display text-[1.28rem] font-semibold"
          style={{ color: isLightTheme ? "var(--lg-text)" : "white" }}
        >
          {total}
        </span>
        <span className="text-[10px] text-slate-400">findings</span>
      </div>
    </div>
  );
}

export default SeverityDonutChart;
