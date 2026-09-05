import { NavLink, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { useHealth } from './api/hooks';
import { cx } from './components/ui';
import Portfolio from './pages/Portfolio';
import Watchlist from './pages/Watchlist';
import ProjectDetail from './pages/ProjectDetail';
import TimeMachine from './pages/TimeMachine';
import Evidence from './pages/Evidence';
import Assistant from './pages/Assistant';
import Upload from './pages/Upload';

/* Inline icons — bundling an icon package for nine glyphs is not worth the weight. */
const I = {
  portfolio: 'M4 19V9M10 19V4M16 19v-7M22 19H2',
  watchlist: 'M4 6h16M4 12h16M4 18h9',
  project: 'M4 5h16v14H4zM4 10h16M9 10v9',
  replay: 'M3 12a9 9 0 109-9 9 9 0 00-6.4 2.7L3 8M3 4v4h4',
  upload: 'M12 16V4M7 9l5-5 5 5M4 16v3a1 1 0 001 1h14a1 1 0 001-1v-3',
  evidence: 'M9 3h6M8 7h8M5 11h14v9a1 1 0 01-1 1H6a1 1 0 01-1-1zM9 16h6',
  assistant: 'M21 12a8 8 0 01-8 8H4l1.8-3.2A8 8 0 1121 12z',
};

const NAV: { to: string; label: string; icon: keyof typeof I; group: string }[] = [
  { to: '/', label: 'Portfolio', icon: 'portfolio', group: 'Monitor' },
  { to: '/watchlist', label: 'Watchlist', icon: 'watchlist', group: 'Monitor' },
  { to: '/project/PRJ-004217', label: 'Project detail', icon: 'project', group: 'Investigate' },
  { to: '/project/PRJ-004217/replay', label: 'Time Machine', icon: 'replay', group: 'Investigate' },
  { to: '/upload', label: 'Upload & rescore', icon: 'upload', group: 'Operate' },
  { to: '/assistant', label: 'Assistant', icon: 'assistant', group: 'Operate' },
  { to: '/evidence', label: 'Evidence', icon: 'evidence', group: 'Validate' },
];

function Icon({ d, size = 14 }: { d: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" className="nav-icon">
      <path d={d} />
    </svg>
  );
}

function Sidebar() {
  const { pathname } = useLocation();
  const groups = [...new Set(NAV.map((n) => n.group))];

  const isActive = (to: string) => {
    if (to === '/') return pathname === '/';
    if (to.endsWith('/replay')) return pathname.endsWith('/replay');
    if (to.startsWith('/project/')) return pathname.startsWith('/project/') && !pathname.endsWith('/replay');
    return pathname.startsWith(to);
  };

  return (
    <nav className="w-[178px] shrink-0 border-r border-line bg-surface/60 px-2 py-2.5 flex flex-col">
      {groups.map((g) => (
        <div key={g} className="mb-3">
          <div className="eyebrow px-2.5 mb-1">{g}</div>
          <div className="space-y-px">
            {NAV.filter((n) => n.group === g).map((n) => (
              <NavLink key={n.to} to={n.to} className="nav-item" data-active={isActive(n.to)}>
                <Icon d={I[n.icon]} />
                {n.label}
              </NavLink>
            ))}
          </div>
        </div>
      ))}

      <div className="mt-auto px-2.5 pt-2.5 border-t border-line">
        <p className="text-2xs text-ink-4 leading-snug">MoSPI · Infrastructure &amp; Project Monitoring Division</p>
      </div>
    </nav>
  );
}

function StatusRail() {
  const { data, isError } = useHealth();
  const degraded = isError || data?.status === 'degraded' || data?.models_loaded === false;

  return (
    <div className="flex items-center gap-3">
      {/* Provenance: calm and permanent, never an alarm (§23). */}
      <div className="hidden lg:flex items-center gap-2 h-[26px] pl-2 pr-2.5 rounded border border-line bg-raised">
        <span className="w-1.5 h-1.5 rounded-full bg-ink-4" />
        <span className="text-2xs font-semibold uppercase tracking-[0.07em] text-ink-3">Prototype data</span>
        <span className="text-[11.5px] text-ink-3 border-l border-line pl-2.5">Synthetic PAIMANA schema</span>
      </div>

      <div className="flex items-center gap-2 h-[26px] pl-2 pr-2.5 rounded border border-line bg-raised">
        <span className={cx('w-1.5 h-1.5 rounded-full', degraded ? 'bg-risk-watch' : 'bg-risk-low')} />
        <span className="num text-[11.5px] font-medium text-ink-2">
          {isError ? 'Scoring service offline' : degraded ? 'Serving cached scores' : data?.model_version ?? '—'}
        </span>
      </div>

      <div className="flex items-center gap-2 pl-3 border-l border-line">
        <div className="w-[26px] h-[26px] rounded-full bg-accent-soft border border-accent-line grid place-items-center">
          <span className="text-[10.5px] font-bold text-accent tracking-tight">IA</span>
        </div>
        <div className="hidden xl:block leading-tight">
          <div className="text-[12px] font-semibold text-ink">IPMD Analyst</div>
          <div className="text-2xs text-ink-3">Read-only session</div>
        </div>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <div className="h-full flex flex-col">
      <header className="h-[50px] shrink-0 border-b border-line bg-surface flex items-center justify-between px-4">
        <div className="flex items-center gap-3">
          <div className="w-[27px] h-[27px] rounded bg-accent grid place-items-center shrink-0">
            <svg width="16" height="16" viewBox="0 0 32 32" fill="none" stroke="white" strokeWidth="2.6"
              strokeLinecap="round" strokeLinejoin="round">
              <path d="M6 22.5L12 15.5L17 19L26 8.5" />
            </svg>
          </div>
          <div className="leading-tight">
            <div className="text-[13.5px] font-semibold tracking-[-0.01em] text-ink">
              PEWS <span className="text-ink-3 font-normal">·</span>{' '}
              <span className="font-medium text-ink-2">Project Early Warning System</span>
            </div>
            <div className="text-2xs text-ink-3 tracking-[0.02em]">
              Central Sector Infrastructure Portfolio · PAIMANA
            </div>
          </div>
        </div>
        <StatusRail />
      </header>

      <div className="flex-1 flex min-h-0">
        <Sidebar />
        <main className="flex-1 min-w-0 overflow-y-auto">
          <div className="px-5 py-4 max-w-[1600px]">
            <Routes>
              <Route path="/" element={<Portfolio />} />
              <Route path="/watchlist" element={<Watchlist />} />
              <Route path="/project/:id" element={<ProjectDetail />} />
              <Route path="/project/:id/replay" element={<TimeMachine />} />
              <Route path="/upload" element={<Upload />} />
              <Route path="/assistant" element={<Assistant />} />
              <Route path="/evidence" element={<Evidence />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </div>
        </main>
      </div>
    </div>
  );
}
