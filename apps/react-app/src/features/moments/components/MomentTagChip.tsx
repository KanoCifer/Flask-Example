import { Link } from 'react-router-dom';

interface MomentTagChipProps {
  name: string;
  to?: string;
}

export function MomentTagChip({ name, to }: MomentTagChipProps) {
  const target = to ?? `/moments?tag=${encodeURIComponent(name)}`;
  return (
    <Link
      to={target}
      className="text-muted hover:text-ink hover:bg-surface inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 font-serif text-[11px] tracking-wide transition-colors"
    >
      <span className="text-ink/70 font-serif">#</span>
      <span>{name}</span>
    </Link>
  );
}
