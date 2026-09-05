import {
  createContext, useCallback, useContext, useEffect, useMemo, useRef, useState,
  type ReactNode,
} from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { TOUR_STEPS, type TourStep } from './steps';
import TourOverlay from './TourOverlay';

const STORAGE_KEY = 'pews.tour.v1';
const TARGET_TIMEOUT_MS = 2200;

type Status = 'completed' | 'skipped' | null;

interface TourApi {
  active: boolean;
  step: TourStep | null;
  index: number;
  total: number;
  rect: DOMRect | null;
  /** Optional tighter ring on one element inside the spotlight. */
  subRect: DOMRect | null;
  /** Target selector resolved to nothing — the step degrades to a centred card. */
  orphaned: boolean;
  start: (fromId?: string) => void;
  next: () => void;
  back: () => void;
  skip: () => void;
  seen: boolean;
}

const Ctx = createContext<TourApi | null>(null);

export const useTour = () => {
  const v = useContext(Ctx);
  if (!v) throw new Error('useTour must be used inside <TourProvider>');
  return v;
};

const read = (): Status => {
  try {
    return (localStorage.getItem(STORAGE_KEY) as Status) ?? null;
  } catch {
    return null;
  }
};
const write = (v: Status) => {
  try {
    v ? localStorage.setItem(STORAGE_KEY, v) : localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* private mode — the tour just won't be remembered */
  }
};

/** Rects change every frame while scrolling; only re-render when they actually move. */
const sameRect = (a: DOMRect | null, b: DOMRect | null) => {
  if (!a || !b) return a === b;
  return (
    Math.abs(a.x - b.x) < 0.5 && Math.abs(a.y - b.y) < 0.5 &&
    Math.abs(a.width - b.width) < 0.5 && Math.abs(a.height - b.height) < 0.5
  );
};

export function TourProvider({ children }: { children: ReactNode }) {
  // Placeholder steps are declared but unwritten; they are excluded here so the
  // tour never shows an empty card, and included again the moment they are filled.
  const steps = useMemo(() => TOUR_STEPS.filter((s) => !s.placeholder), []);

  const [active, setActive] = useState(false);
  const [index, setIndex] = useState(0);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const [subRect, setSubRect] = useState<DOMRect | null>(null);
  const [orphaned, setOrphaned] = useState(false);
  const [seen, setSeen] = useState(() => read() !== null);

  const navigate = useNavigate();
  const location = useLocation();
  const scrolledFor = useRef<string | null>(null);

  const step = active ? steps[index] ?? null : null;

  const stop = useCallback((status: Exclude<Status, null>) => {
    setActive(false);
    setRect(null);
    setSubRect(null);
    setOrphaned(false);
    write(status);
    setSeen(true);
  }, []);

  const start = useCallback((fromId?: string) => {
    const at = fromId ? steps.findIndex((s) => s.id === fromId) : 0;
    scrolledFor.current = null;
    setIndex(at < 0 ? 0 : at);
    setRect(null);
    setSubRect(null);
    setOrphaned(false);
    setActive(true);
  }, [steps]);

  // Plain closures rather than functional updaters: these carry side effects
  // (stop, scroll reset), which must not run twice under StrictMode.
  const next = useCallback(() => {
    if (index >= steps.length - 1) { stop('completed'); return; }
    scrolledFor.current = null;
    setRect(null);
    setSubRect(null);
    setOrphaned(false);
    setIndex(index + 1);
  }, [index, steps.length, stop]);

  const back = useCallback(() => {
    if (index <= 0) return;
    scrolledFor.current = null;
    setRect(null);
    setSubRect(null);
    setOrphaned(false);
    setIndex(index - 1);
  }, [index]);

  const skip = useCallback(() => stop('skipped'), [stop]);

  // ---- route the app to wherever the step lives -----------------------------
  useEffect(() => {
    if (!step?.route) return;
    if (location.pathname !== step.route) navigate(step.route);
  }, [step, location.pathname, navigate]);

  // ---- track the target: resolve it, follow it, give up gracefully ----------
  // Event-driven rather than a permanent rAF loop. A loop that never idles keeps
  // the compositor busy for the whole tour and makes headless capture
  // non-deterministic; scroll + resize + ResizeObserver covers every way the
  // target actually moves.
  useEffect(() => {
    if (!step) return;
    if (!step.target) {
      setRect(null);
      setSubRect(null);
      setOrphaned(false);
      return;
    }

    const selector = step.target;
    let cancelled = false;
    let poll = 0;
    const startedAt = performance.now();

    const measure = () => {
      if (cancelled) return;
      const el = document.querySelector(selector);
      const r = el?.getBoundingClientRect();

      if (!el || !r || (r.width === 0 && r.height === 0)) {
        // Still mounting — most targets appear once their query resolves.
        if (performance.now() - startedAt > TARGET_TIMEOUT_MS) {
          setOrphaned(true);
          setRect(null);
        }
        poll = window.setTimeout(measure, 120);
        return;
      }

      setOrphaned(false);
      setRect((prev) => (sameRect(prev, r) ? prev : r));

      const sub = step.subTarget ? document.querySelector(step.subTarget) : null;
      const sr = sub?.getBoundingClientRect() ?? null;
      setSubRect((prev) => (sameRect(prev, sr) ? prev : sr));

      if (scrolledFor.current !== step.id) {
        scrolledFor.current = step.id;
        const margin = 96;
        if (r.top < margin || r.bottom > window.innerHeight - margin) {
          el.scrollIntoView({ block: 'center', behavior: 'smooth' });
          settle();
        }
      }
    };

    // A smooth scroll moves the target over many frames, and the container that
    // scrolls is a nested <main>, not the window. Rather than trust any single
    // event, track every frame for a short bounded burst whenever motion starts.
    let settling = 0;
    const settle = () => {
      if (cancelled) return;
      const first = settling === 0;
      settling = 40;
      if (!first) return;
      const step_ = () => {
        if (cancelled || settling-- <= 0) { settling = 0; return; }
        measure();
        requestAnimationFrame(step_);
      };
      requestAnimationFrame(step_);
    };
    const onMove = () => { measure(); settle(); };

    measure();

    const ro = new ResizeObserver(measure);
    ro.observe(document.body);
    const el = document.querySelector(selector);
    if (el) ro.observe(el);
    window.addEventListener('scroll', onMove, true);
    window.addEventListener('resize', onMove);

    // Backstop. Scroll events from a nested scroll container and late layout
    // shifts (fonts, async panels) can land between the listeners, leaving the
    // spotlight drawn where the target used to be. Four checks a second is far
    // cheaper than a permanent rAF loop and always converges.
    const settleTimer = window.setInterval(measure, 250);

    return () => {
      cancelled = true;
      window.clearTimeout(poll);
      window.clearInterval(settleTimer);
      ro.disconnect();
      window.removeEventListener('scroll', onMove, true);
      window.removeEventListener('resize', onMove);
    };
  }, [step]);

  // ---- steps that wait on the user doing the thing --------------------------
  useEffect(() => {
    if (!step?.advanceWhen) return;
    if (step.advanceWhen()) return; // already satisfied; let them press Next
    const t = window.setInterval(() => {
      if (step.advanceWhen!()) {
        window.clearInterval(t);
        next();
      }
    }, 180);
    return () => window.clearInterval(t);
  }, [step, next]);

  // ---- keyboard ------------------------------------------------------------
  useEffect(() => {
    if (!active) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.preventDefault(); skip(); }
      if (e.key === 'ArrowRight') { e.preventDefault(); next(); }
      if (e.key === 'ArrowLeft') { e.preventDefault(); back(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [active, next, back, skip]);

  // ---- entry: ?tour=<step-id> deep link, else first visit -------------------
  // The deep link lets a presenter jump straight to a step (and makes each step
  // reachable for screenshots) without clicking through the whole tour.
  useEffect(() => {
    if (steps.length === 0) return;
    const wanted = new URLSearchParams(window.location.search).get('tour');
    if (wanted) {
      const at = steps.findIndex((x) => x.id === wanted);
      const t = window.setTimeout(() => { setIndex(at < 0 ? 0 : at); setActive(true); }, 250);
      return () => window.clearTimeout(t);
    }
    if (read() !== null) return;
    const t = window.setTimeout(() => setActive(true), 900);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [steps.length]);

  const api = useMemo<TourApi>(() => ({
    active, step, index, total: steps.length, rect, subRect, orphaned,
    start, next, back, skip, seen,
  }), [active, step, index, steps.length, rect, subRect, orphaned, start, next, back, skip, seen]);

  return (
    <Ctx.Provider value={api}>
      {children}
      {active && step && <TourOverlay />}
    </Ctx.Provider>
  );
}
