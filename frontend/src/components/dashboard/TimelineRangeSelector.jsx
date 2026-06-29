const RANGE_OPTIONS = [
  { value: "7d", label: "7D" },
  { value: "30d", label: "30D" },
  { value: "365d", label: "12M" },
];

function TimelineRangeSelector({ value, onChange }) {
  return (
    <div className="surface-elevated inline-flex rounded-lg border border-slate-800 p-1">
      {RANGE_OPTIONS.map((option) => {
        const isActive = option.value === value;

        return (
          <button
            className={`btn-segment rounded-md px-2.5 py-1 text-[10px] font-medium ${
              isActive ? "btn-segment-active" : ""
            }`}
            key={option.value}
            onClick={() => onChange(option.value)}
            type="button"
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

export default TimelineRangeSelector;
