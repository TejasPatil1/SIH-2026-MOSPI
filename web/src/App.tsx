import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, NavLink, Route, Routes, useLocation } from 'react-router-dom';
import { useHealth } from './api/hooks';
import { USE_MOCK } from './api/client';
import { EmptyState, cx } from './components/ui';
import { Info } from './components/Info';
import { HERO_PROJECT } from './lib/demo';
import { useTour } from './tour/TourProvider';
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


/**
 * The project the user is currently looking at, so "Project detail" and
 * "Time Machine" follow them rather than teleporting to a fixed demo project.
 */
const currentProject = (pathname: string) =>
  pathname.match(/^\/project\/([^/]+)/)?.[1] ?? HERO_PROJECT;

type NavItem = { to: string; label: string; icon: keyof typeof I; group: string; tour?: string };

const navFor = (project: string): NavItem[] => [
  { to: '/', label: 'Portfolio', icon: 'portfolio', group: 'Monitor' },
  { to: '/watchlist', label: 'Watchlist', icon: 'watchlist', group: 'Monitor', tour: 'nav-watchlist' },
  { to: `/project/${project}`, label: 'Project detail', icon: 'project', group: 'Investigate' },
  { to: `/project/${project}/replay`, label: 'Time Machine', icon: 'replay', group: 'Investigate' },
  // Validate sits above Operate: a reviewer should meet the evidence for the
  // method before the tooling around it, and the Assistant — the one surface
  // that invites an open-ended question — comes last.
  { to: '/evidence', label: 'Evidence', icon: 'evidence', group: 'Validate', tour: 'nav-evidence' },
  { to: '/upload', label: 'Upload & rescore', icon: 'upload', group: 'Operate', tour: 'nav-upload' },
  { to: '/assistant', label: 'Assistant', icon: 'assistant', group: 'Operate' },
];

function Icon({ d, size = 15 }: { d: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" className="nav-icon">
      <path d={d} />
    </svg>
  );
}

/* ------------------------------------------------------------------ sidebar */

const COLLAPSE_KEY = 'pews.nav.collapsed';

function useCollapsed() {
  const [collapsed, setCollapsed] = useState(() => {
    try {
      return localStorage.getItem(COLLAPSE_KEY) === '1';
    } catch {
      return false;
    }
  });
  const toggle = useCallback(() => {
    setCollapsed((c) => {
      try {
        localStorage.setItem(COLLAPSE_KEY, c ? '0' : '1');
      } catch {
        /* private mode — the choice just won't survive a reload */
      }
      return !c;
    });
  }, []);
  return [collapsed, toggle] as const;
}

function Sidebar({ collapsed, onToggle }: { collapsed: boolean; onToggle: () => void }) {
  const { pathname } = useLocation();
  const nav = navFor(currentProject(pathname));
  const groups = [...new Set(nav.map((n) => n.group))];

  const isActive = (to: string) => {
    if (to === '/') return pathname === '/';
    if (to.endsWith('/replay')) return pathname.endsWith('/replay');
    if (to.startsWith('/project/')) return pathname.startsWith('/project/') && !pathname.endsWith('/replay');
    return pathname.startsWith(to);
  };

  return (
    <nav
      style={{ width: collapsed ? 52 : 178 }}
      className="shrink-0 border-r border-line bg-surface/60 py-2.5 flex flex-col
                 transition-[width] duration-200 ease-out"
      aria-label="Sections"
    >
      <div className="flex-1 px-2">
        {groups.map((g, gi) => (
          <div key={g} className={cx('mb-3', collapsed && gi > 0 && 'pt-3 border-t border-line-faint')}>
            {/*
              Collapsed, the group name cannot fit — but the grouping itself still
              has to survive, so it degrades to a rule rather than disappearing.
            */}
            {!collapsed && <div className="eyebrow px-2.5 mb-1">{g}</div>}
            <div className="space-y-px">
              {nav.filter((n) => n.group === g).map((n) => (
                <NavLink
                  key={n.to}
                  to={n.to}
                  className="nav-item"
                  data-active={isActive(n.to)}
                  data-collapsed={collapsed}
                  data-tour={n.tour}
                >
                  <Icon d={I[n.icon]} />
                  <span className="nav-label">{n.label}</span>
                </NavLink>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="px-2 pt-2 border-t border-line">
        <button
          onClick={onToggle}
          className="nav-item w-full"
          data-collapsed={collapsed}
          aria-expanded={!collapsed}
          aria-label={collapsed ? 'Expand navigation' : 'Collapse navigation'}
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor"
            strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" className="nav-icon">
            <rect x="3" y="4" width="18" height="16" rx="2" />
            <path d="M9.5 4v16" />
            {collapsed
              ? <path d="M13.5 9.5L16 12l-2.5 2.5" />
              : <path d="M16 9.5L13.5 12l2.5 2.5" />}
          </svg>
          <span className="nav-label">Collapse</span>
        </button>
      </div>
    </nav>
  );
}

/* ------------------------------------------------------------------- header */

function StatusRail() {
  const { data, isError } = useHealth();
  /*
   * Running on bundled fixtures is a deliberate configuration, not a fault, so
   * it reads neutral. Amber is reserved for a service that was expected to
   * answer and did not — otherwise the header turns amber mid-demo and a judge
   * reasonably concludes the system is broken.
   */
  const fixture = USE_MOCK || data?.data_source === 'fixture';
  const degraded = !fixture && (isError || data?.status === 'degraded' || data?.models_loaded === false);

  return (
    <div className="flex items-center gap-3.5 text-[12px] shrink-0">
      {/*
        Provenance and service state read as one quiet line of fact rather than
        three competing badges. Both are permanent statements, never alarms (§23).
      */}
      <div className="hidden md:flex items-center gap-1.5">
        <span className="text-ink-3">Prototype data</span>
        <Info terms={['synthetic_data', 'paimana', 'cuf']} label="What prototype data means" />
      </div>

      <span className="hidden md:block w-px h-3.5 bg-line" aria-hidden />

      <div className="flex items-center gap-2">
        <span
          className={cx('w-1.5 h-1.5 rounded-full shrink-0',
            degraded ? 'bg-risk-watch' : fixture ? 'bg-ink-4' : 'bg-risk-low')}
          aria-hidden
        />
        <span className="num text-ink-2 whitespace-nowrap">
          {degraded
            ? (isError ? 'Scoring service offline' : 'Serving cached scores')
            : data?.model_version ?? 'pews-lgbm-v1.0.0'}
        </span>
        {fixture && !degraded && (
          <span className="text-ink-3 whitespace-nowrap hidden lg:inline">· bundled scores</span>
        )}
      </div>

      <span className="hidden lg:block w-px h-3.5 bg-line" aria-hidden />

      <span className="hidden lg:block text-ink-3 whitespace-nowrap">
        IPMD analyst <span className="text-ink-4">·</span> read-only
      </span>
    </div>
  );
}

function Wordmark() {
  return (
    <div className="flex items-stretch gap-2.5 min-w-0">
      {/*
        A rule, not a logo tile. The product has no brand mark, and inventing a
        glyph for it makes the most conspicuous thing on screen the one part that
        carries no information.
      */}
      <span className="w-[3px] rounded-full bg-accent shrink-0" aria-hidden />
      <div className="leading-[1.25] min-w-0">
        <div className="flex items-baseline gap-2 min-w-0">
          <span className="text-[15px] font-bold tracking-[-0.02em] text-ink shrink-0">PEWS</span>
          <span className="text-[12.5px] text-ink-2 truncate">Project Early Warning System</span>
        </div>
        <div className="text-[11px] text-ink-3 truncate">
          Ministry of Statistics &amp; Programme Implementation
          <span className="text-ink-4"> · </span>
          Infrastructure &amp; Project Monitoring Division
        </div>
      </div>
    </div>
  );
}

/**
 * Floating launcher, pinned to the right edge. Kept out of the header so it is
 * reachable from any screen without competing with the status line, and it
 * retracts to a disc until hovered so it never sits on top of the data.
 */
function TourLaunch() {
  const { start, active, seen } = useTour();
  if (active) return null;
  return (
    <button
      onClick={() => start()}
      title="Walk through the system step by step"
      className="group fixed right-4 bottom-5 z-50 flex items-center gap-2 h-10 pl-[11px] pr-[11px]
                 rounded-full bg-accent text-white shadow-pop border border-accent
                 hover:pr-4 hover:bg-accent-hover active:scale-[0.97]
                 transition-all duration-200"
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
        strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
        <circle cx="12" cy="12" r="9" />
        <path d="M15.2 8.8l-2 4.4-4.4 2 2-4.4z" />
      </svg>
      <span className="max-w-0 overflow-hidden whitespace-nowrap text-[12.5px] font-semibold
                       opacity-0 transition-all duration-200
                       group-hover:max-w-[128px] group-hover:opacity-100">
        {seen ? 'Replay tour' : 'Guided tour'}
      </span>
    </button>
  );
}

/**
 * A mistyped or stale URL used to be replaced silently with the portfolio, which
 * teleports the reader with no explanation and reads as a bug. It costs one
 * panel to say what happened.
 */
function NotFound() {
  const { pathname } = useLocation();
  return (
    <div className="fade-in pt-8">
      <EmptyState
        icon="search"
        title="No screen at this address"
        message={
          <>
            <span className="num text-ink">{pathname}</span> is not a route in this application.
            It may be a stale link, or an identifier that has changed.
          </>
        }
        action={
          <div className="flex items-center gap-2">
            <Link to="/" className="btn btn-primary">Back to the portfolio</Link>
            <Link to="/watchlist" className="btn btn-ghost">Open the watchlist</Link>
          </div>
        }
      />
    </div>
  );
}

export default function App() {
  const [collapsed, toggleCollapsed] = useCollapsed();
  const mainRef = useRef<HTMLElement>(null);
  const { pathname } = useLocation();

  /*
   * Reset the scroller on navigation. The element that scrolls is this nested
   * <main>, not the window, so `window.scrollTo` does nothing — which is why
   * clicking row 30 of the watchlist used to land halfway down the project
   * screen with its header off-frame.
   */
  useEffect(() => { mainRef.current?.scrollTo({ top: 0 }); }, [pathname]);

  /* Ctrl/Cmd-B is the near-universal binding for this. */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'b') {
        e.preventDefault();
        toggleCollapsed();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [toggleCollapsed]);

  return (
    <div className="h-full flex flex-col">
      <header className="h-[52px] shrink-0 border-b border-line bg-surface flex items-center justify-between gap-6 px-4 py-2">
        <Wordmark />
        <StatusRail />
      </header>

      <div className="flex-1 flex min-h-0">
        <Sidebar collapsed={collapsed} onToggle={toggleCollapsed} />
        <main ref={mainRef} className="flex-1 min-w-0 overflow-y-auto">
          {/* pb clears the floating tour launcher, which would otherwise sit on
              top of whatever the last row of a page happens to be. */}
          <div className="px-5 pt-4 pb-16 max-w-[1600px]">
            <Routes>
              <Route path="/" element={<Portfolio />} />
              <Route path="/watchlist" element={<Watchlist />} />
              <Route path="/project/:id" element={<ProjectDetail />} />
              <Route path="/project/:id/replay" element={<TimeMachine />} />
              <Route path="/upload" element={<Upload />} />
              <Route path="/assistant" element={<Assistant />} />
              <Route path="/evidence" element={<Evidence />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </div>
        </main>
      </div>

      <TourLaunch />
    </div>
  );
}
