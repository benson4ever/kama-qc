export default function EntryCard({ title, titleZh, subtitle, badge, meta, onClick, children }) {
  return (
    <div className={`card ${onClick ? 'clickable' : ''}`} onClick={onClick}>
      <div className="row between">
        <div className="stack">
          <strong>{title} {titleZh && <span className="zh">{titleZh}</span>}</strong>
          {subtitle && <span className="muted">{subtitle}</span>}
        </div>
        {badge}
      </div>
      {meta && <div className="row wrap muted" style={{ marginTop: '0.4rem', fontSize: '0.85rem', gap: '0.75rem' }}>{meta}</div>}
      {children}
    </div>
  );
}
