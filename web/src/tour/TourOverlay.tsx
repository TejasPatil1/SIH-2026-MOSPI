import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from 'react';
import { useTour } from './TourProvider';
import type { Placement, TourIcon } from './steps';
import { cx } from '../components/ui';

const W = 380;      // spotlight popover width
const W_STATEMENT = 640; // the two opening moments are an argument, not a label
const GAP = 16;     // distance from the spotlight edge
const EDGE = 14;    // minimum distance from the viewport edge

type Side = Exclude<Placement, 'auto'>;

/**
 * The padded spotlight rect. A plain object rather than a DOMRect, but it must
 * carry `bottom`/`right` — leaving them off makes every fit test compare against
 * undefined, which is NaN-false, and the popover lands on top of its own target.
 */
interface Box {
  top: number; left: number; width: number; height: number; bottom: number; right: number;
}

const room = (side: Side, r: Box) => {
  if (side === 'top') return r.top;
  if (side === 'bottom') return window.innerHeight - r.bottom;
  if (side === 'left') return r.left;
  return window.innerWidth - r.right;
};

const fits = (side: Side, r: Box, h: number) =>
  room(side, r) >= (side === 'top' || side === 'bottom' ? h : W) + GAP + EDGE;

function place(preferred: Placement, r: Box, h: number) {
  const order: Side[] =
    preferred === 'auto'
      ? (['bottom', 'right', 'top', 'left'] as Side[])
      : ([preferred, 'bottom', 'top', 'right', 'left'] as Side[]).filter(
          (s, i, a) => a.indexOf(s) === i,
        );

  // Prefer the requested side, fall back to any side with room, and if the
  // target fills the viewport take whichever side has the most space so any
  // overlap is as small as it can be.
  const side =
    order.find((s) => fits(s, r, h)) ??
    order.slice().sort((a, b) => room(b, r) - room(a, r))[0];

  let top: number;
  let left: number;
  if (side === 'top') { top = r.top - GAP - h; left = r.left + r.width / 2 - W / 2; }
  else if (side === 'bottom') { top = r.bottom + GAP; left = r.left + r.width / 2 - W / 2; }
  else if (side === 'left') { left = r.left - GAP - W; top = r.top + r.height / 2 - h / 2; }
  else { left = r.right + GAP; top = r.top + r.height / 2 - h / 2; }

  const clamp = (v: number, max: number) => Math.min(Math.max(v, EDGE), Math.max(EDGE, max));
  return {
    top: clamp(top, window.innerHeight - h - EDGE),
    left: clamp(left, window.innerWidth - W - EDGE),
  };
}

/* ------------------------------------------------------------------- icons */

const ICONS: Record<TourIcon, string> = {
  portfolio: 'M4 19V9M10 19V4M16 19v-7M22 19H2',
  risk: 'M12 3l9 16H3zM12 10v4M12 17h.01',
  sector: 'M4 6h16M4 12h11M4 18h6',
  queue: 'M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01',
  money: 'M6 5h12M6 9h12M9 5c3.5 0 5.5 1.6 5.5 4S12.5 13 9 13H7l7 6',
  chart: 'M3 3v18h18M7 15l4-5 3 3 5-7',
  forecast: 'M4 12h16M8 8v8M16 6v12M12 3v18',
  explain: 'M4 6h9M4 11h13M4 16h6M19 14v6M19 11h.01',
  replay: 'M3 12a9 9 0 109-9 9 9 0 00-6.4 2.7L3 8M3 4v4h4',
  proof: 'M4 12.5l5 5L20 6.5',
  evidence: 'M9 3h6M8 7h8M5 11h14v9a1 1 0 01-1 1H6a1 1 0 01-1-1zM9 16h6',
  guard: 'M12 3l8 3v6c0 4.5-3.2 7.9-8 9-4.8-1.1-8-4.5-8-9V6zM9 12l2 2 4-4',
  cycle: 'M3 12a9 9 0 0115-6.7L21 8M21 12a9 9 0 01-15 6.7L3 16M21 4v4h-4M3 20v-4h4',
  /* the two opening moments: a late alarm, then an early one */
  problem: 'M12 21a9 9 0 100-18 9 9 0 000 18zM12 7v5.5l3.5 2.2',
  solution: 'M3 17l5.5-6 3.6 3.4L21 6M15 6h6v6',
};

/* --------------------------------------------------------------- streaming */

const reduced = () =>
  typeof window !== 'undefined' &&
  !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

/**
 * Reveals the body a character at a time so the eye is pulled to it. Driven by
 * elapsed time rather than a per-character interval, so a line always lands in
 * roughly the same duration regardless of its length.
 */
function useStreamedText(text: string) {
  const [n, setN] = useState(0);

  useEffect(() => {
    if (reduced()) { setN(text.length); return; }
    setN(0);
    const duration = Math.min(1100, 260 + text.length * 9);
    const startedAt = performance.now();
    let raf = 0;
    const tick = (t: number) => {
      const p = Math.min(1, (t - startedAt) / duration);
      setN(Math.floor(p * text.length));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [text]);

  return [text.slice(0, n), n >= text.length, () => setN(text.length)] as const;
}

/** Splits a title so one phrase can carry the accent colour. */
const emphasise = (title: string, emphasis?: string) => {
  if (!emphasis) return [title, '', ''] as const;
  const i = title.indexOf(emphasis);
  if (i < 0) return [title, '', ''] as const;
  return [title.slice(0, i), emphasis, title.slice(i + emphasis.length)] as const;
};

/* ----------------------------------------------------------------- overlay */

export default function TourOverlay() {
  const { step, index, total, rect, subRect, orphaned, next, back, skip } = useTour();
  const popRef = useRef<HTMLDivElement>(null);
  const [h, setH] = useState(240);

  const statement = step?.kind === 'statement';
  const [shown, done, reveal] = useStreamedText(statement ? '' : step?.body ?? '');

  // Height changes as the text streams and the tip appears, so re-measure on
  // those transitions — but with real deps, not on every commit.
  useLayoutEffect(() => {
    if (popRef.current) setH(popRef.current.offsetHeight);
  }, [step, shown, done, orphaned]);

  if (!step) return null;

  // Hold the overlay back until the target has been measured. Rendering during
  // that first frame paints a full-screen dim with a centred card, which then
  // jumps to the spotlight — a visible flash on every step change.
  if (step.target && !rect && !orphaned) return null;

  const isLast = index >= total - 1;

  /* ------------------------------------------------------ statement moment */
  if (statement) {
    const [before, accent, after] = emphasise(step.title, step.emphasis);
    return (
      <div className="fixed inset-0 z-[70] bg-ink/72 backdrop-blur-[1.5px] grid place-items-center px-6 tour-scrim">
        <div className="tour-statement" style={{ width: Math.min(W_STATEMENT, window.innerWidth - 48) }}>
          <div className="flex items-center justify-between gap-4 mb-5">
            <div className="flex items-center gap-2.5 min-w-0">
              {step.icon && (
                <span className="tour-icon shrink-0">
                  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                    strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
                    <path d={ICONS[step.icon]} />
                  </svg>
                </span>
              )}
              {step.kicker && (
                <span className="text-2xs font-bold uppercase tracking-[0.14em] text-accent">{step.kicker}</span>
              )}
            </div>
            <span className="num text-[12px] font-semibold text-ink-3 shrink-0">
              <span className="text-ink">{index + 1}</span> / {total}
            </span>
          </div>

          <h2 className="text-[27px] font-semibold text-ink leading-[1.2] tracking-[-0.022em] max-w-[92%]">
            {before}
            {accent && <span className="text-accent">{accent}</span>}
            {after}
          </h2>

          <p className="text-[15px] text-ink-2 leading-[1.62] mt-4 max-w-[62ch]">{step.body}</p>
          {step.body2 && (
            <p className="text-[15px] text-ink-2 leading-[1.62] mt-3 max-w-[62ch]">{step.body2}</p>
          )}

          {step.video && <TourVideo key={step.video} src={step.video} poster={step.poster} />}

          {step.stats && (
            <div className="grid grid-cols-3 gap-5 mt-6 pt-5 border-t border-line divide-x divide-line">
              {step.stats.map((s, i) => (
                <div key={s.label} className={cx('min-w-0', i > 0 && 'pl-5')}>
                  <div className="num text-2xl font-semibold tracking-[-0.028em] leading-none text-ink flex items-baseline gap-1.5">
                    <span>{s.value}</span>
                    {s.unit && <span className="text-[12.5px] font-medium text-ink-3 tracking-normal">{s.unit}</span>}
                  </div>
                  <div className="text-[12.5px] text-ink-2 leading-snug mt-2">{s.label}</div>
                </div>
              ))}
            </div>
          )}

          {step.tip && (
            <div className="tour-tip mt-5 text-[13px]">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 mt-px">
                <path d="M9 18h6M10 22h4M12 2a7 7 0 00-4 12.7V17h8v-2.3A7 7 0 0012 2z" />
              </svg>
              <span>{step.tip}</span>
            </div>
          )}

          <div className="flex items-center justify-between gap-3 mt-6 pt-4 border-t border-line-faint">
            <button onClick={skip} className="text-[13px] font-medium text-ink-3 hover:text-ink transition-colors">
              Skip the walkthrough
            </button>
            <div className="flex items-center gap-2">
              {index > 0 && (
                <button onClick={back} className="btn btn-ghost h-9 px-3">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5M11 6l-6 6 6 6" /></svg>
                  Back
                </button>
              )}
              <button onClick={next} className="btn btn-primary h-9 px-4 text-[13px]">
                Continue
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  /* ------------------------------------------------------- spotlight step */

  const pad = step.pad ?? 6;
  const radius = step.radius ?? 8;

  const box: Box | null = rect
    ? {
        top: rect.top - pad, left: rect.left - pad,
        width: rect.width + pad * 2, height: rect.height + pad * 2,
        bottom: rect.bottom + pad, right: rect.right + pad,
      }
    : null;

  const pos = box
    ? place(step.placement ?? 'auto', box, h)
    : { top: window.innerHeight / 2 - h / 2, left: window.innerWidth / 2 - W / 2 };

  const frame: CSSProperties | null = box
    ? { top: box.top, left: box.left, width: box.width, height: box.height, borderRadius: radius }
    : null;

  const [before, accent, after] = emphasise(step.title, step.emphasis);

  return (
    <div className="fixed inset-0 z-[70] pointer-events-none">
      {/*
        Dimming is one enormous box-shadow spread from the spotlight rect, so the
        cut-out animates with an ordinary CSS transition and the highlighted
        element keeps its own pixels — nothing is painted on top of it.
      */}
      {frame && box ? (
        <>
          <div className="tour-spot" style={frame} />
          <div className="tour-frame" style={frame} />

          {/* Swallow clicks everywhere except the spotlight, so the tour cannot
              be knocked off course — the target itself stays live. */}
          <Blocker style={{ top: 0, left: 0, right: 0, height: Math.max(0, box.top) }} />
          <Blocker style={{ top: box.bottom, left: 0, right: 0, bottom: 0 }} />
          <Blocker style={{ top: box.top, left: 0, width: Math.max(0, box.left), height: box.height }} />
          <Blocker style={{ top: box.top, left: box.right, right: 0, height: box.height }} />
        </>
      ) : (
        <div className="absolute inset-0 bg-ink/55 pointer-events-auto" />
      )}

      {/* A second, tighter ring on one element inside the spotlight. */}
      {subRect && (
        <div
          className="tour-sub"
          style={{
            top: subRect.top - 3, left: subRect.left - 3,
            width: subRect.width + 6, height: subRect.height + 6,
          }}
        />
      )}

      {/* ---------------------------------------------------------- popover */}
      <div
        ref={popRef}
        className="tour-pop pointer-events-auto"
        style={{ top: pos.top, left: pos.left, width: W }}
        onClick={() => { if (!done) reveal(); }}
      >
        <div className="flex items-center justify-between gap-4 mb-3">
          <div className="flex-1 min-w-0">
            <div className="num text-[12px] font-semibold text-ink-3 mb-1.5">
              <span className="text-ink">{index + 1}</span> / {total}
            </div>
            <div className="h-[3px] rounded-full bg-line-faint overflow-hidden">
              <div
                className="h-full bg-accent rounded-full transition-[width] duration-500 ease-out"
                style={{ width: `${((index + 1) / total) * 100}%` }}
              />
            </div>
          </div>
          <span className="chip bg-accent-soft text-accent border-accent-line shrink-0">
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor"
              strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 4L3 6.5v13L9 17l6 2.5 6-2.5v-13L15 6.5zM9 4v13M15 6.5v13" />
            </svg>
            Guided tour
          </span>
        </div>

        <div className="flex items-start gap-3">
          {step.icon && (
            <span className="tour-icon shrink-0">
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
                <path d={ICONS[step.icon]} />
              </svg>
            </span>
          )}
          <h3 className="text-[17.5px] font-semibold text-ink leading-[1.28] tracking-[-0.018em] pt-0.5">
            {before}
            {accent && <span className="text-accent">{accent}</span>}
            {after}
          </h3>
        </div>

        <p className="text-[15px] text-ink-2 leading-[1.58] mt-3 min-h-[46px]">
          {shown}
          {!done && <span className="tour-caret" />}
        </p>

        {orphaned && (
          <p className="text-[13px] text-ink-3 mt-2 pt-2 border-t border-line-faint leading-snug">
            This control isn’t on screen right now — the explanation still applies.
          </p>
        )}

        {step.tip && done && (
          <div className="tour-tip fade-in">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
              strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 mt-px">
              <path d="M9 18h6M10 22h4M12 2a7 7 0 00-4 12.7V17h8v-2.3A7 7 0 0012 2z" />
            </svg>
            <span>{step.tip}</span>
          </div>
        )}

        {step.action && (
          <div className="flex items-center gap-2.5 mt-3 px-3 py-2.5 rounded bg-accent-soft border border-accent-line">
            <span className="tour-dot" />
            <span className="text-[13.5px] font-semibold text-accent leading-snug">{step.action}</span>
          </div>
        )}

        <div className="flex items-center justify-between gap-2 mt-4 pt-3 border-t border-line-faint">
          <button onClick={skip} className="text-[13px] font-medium text-ink-3 hover:text-ink transition-colors">
            Skip tour
          </button>
          <div className="flex items-center gap-1.5">
            {index > 0 && (
              <button onClick={back} className="btn btn-ghost h-8 px-2.5 text-[13px]">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5M11 6l-6 6 6 6" /></svg>
                Back
              </button>
            )}
            <button onClick={next} className={cx('btn h-8 px-3 text-[13px]', step.action ? 'btn-ghost' : 'btn-primary')}>
              {isLast ? 'Finish' : step.action ? 'Skip this' : 'Next'}
              {!isLast && (
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Streams a static clip. `preload="metadata"` fetches only the header (a few KB),
 * so the step stays weightless and a missing file fails fast enough to hide
 * the block; the rest arrives over HTTP range requests as it plays, which every
 * static host (and Vite) already serves — no backend, no player library.
 */
function TourVideo({ src, poster }: { src: string; poster?: string }) {
  const [gone, setGone] = useState(false);
  if (gone) return null;
  return (
    <video
      className="mt-5 w-full rounded-lg border border-line bg-ink/90 aspect-video"
      src={src}
      poster={poster}
      controls
      playsInline
      preload="metadata"
      onError={() => setGone(true)}
    />
  );
}

const Blocker = ({ style }: { style: CSSProperties }) => (
  <div className="absolute pointer-events-auto" style={style} onClick={(e) => e.stopPropagation()} />
);
