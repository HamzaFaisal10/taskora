export function PageHeader({
  title,
  description,
  actions,
  eyebrow,
}: {
  title: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  eyebrow?: React.ReactNode;
}) {
  return (
    <div className="border-border flex flex-wrap items-end justify-between gap-3 border-b px-4 py-5 sm:px-8">
      <div className="min-w-0">
        {eyebrow && <div className="text-subtle mb-1 text-xs">{eyebrow}</div>}
        <h1 className="truncate text-xl font-semibold tracking-tight">{title}</h1>
        {description && <p className="text-muted mt-1 text-sm">{description}</p>}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}
