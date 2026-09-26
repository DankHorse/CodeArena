import { ArrowUpRight } from 'lucide-react';

export function Topbar() {
  return (
    <header className="topbar">
      <p className="breadcrumb">CodeArena <span aria-hidden="true">/</span> <strong>Arena control</strong></p>
      <div className="topbar-controls">
        <span className="badge badge-cyan">FIXTURE EVENT</span>
        <button className="public-site" type="button" disabled title="Public site coming soon">PUBLIC SITE <ArrowUpRight size={15} aria-hidden="true" /></button>
      </div>
    </header>
  );
}
