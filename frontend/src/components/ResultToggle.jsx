// options: [{ value, label, color: 'green'|'red'|'blue' }]
export default function ResultToggle({ value, onChange, options }) {
  return (
    <div className="toggle" role="group">
      {options.map((o) => {
        const on = value === o.value;
        const cls = on ? (o.color === 'green' ? 'on-green' : o.color === 'red' ? 'on-red' : 'on-blue') : '';
        return (
          <button type="button" key={o.value} className={cls} onClick={() => onChange(o.value)}>
            {on ? '✓ ' : ''}{o.label}
          </button>
        );
      })}
    </div>
  );
}
