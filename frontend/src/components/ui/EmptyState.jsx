export default function EmptyState({ icon: Icon, title, description }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 px-4 py-10 text-center">
      {Icon ? (
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[var(--surface-soft)] text-[var(--text-muted)]">
          <Icon size={22} />
        </div>
      ) : null}
      <p className="text-sm font-semibold text-[var(--text)]">{title}</p>
      {description ? <p className="max-w-xs text-xs text-[var(--text-muted)]">{description}</p> : null}
    </div>
  );
}
