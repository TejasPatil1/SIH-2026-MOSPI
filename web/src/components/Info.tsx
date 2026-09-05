/**
 * The one help pattern for the whole application.
 *
 * Every technical term in the interface is explained through this component and
 * nothing else — so the same word never gets two different explanations, and a
 * judge learns the affordance once and it works everywhere.
 *
 * Built on the native Popover API rather than a hand-rolled overlay. That buys,
 * for free and correctly: rendering in the top layer (so a popover inside a
 * scrolling panel or a table cell is never clipped), light-dismiss on outside
 * click, Escape to close, focus returned to the trigger, and only one popover
 * open at a time. A bespoke implementation of those four behaviours is where
 * tooltip bugs live.
 *
 * Two entry points:
 *   <Info terms={['median', 'percentile']} />   an "i" beside a heading
 *   <Term k="median" />                          an underlined word in prose
 */
import { useCallback, useId, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { GLOSSARY, type TermDef, type TermKey } from '../lib/glossary';

/* React 18 forwards these to the DOM already; this only teaches TypeScript. */
declare module 'react' {
  interface HTMLAttributes<T> {
    popover?: 'auto' | 'manual';
  }
  interface ButtonHTMLAttributes<T> {
    popovertarget?: string;
    popovertargetaction?: 'show' | 'hide' | 'toggle';
  }
}

/* -------------------------------------------------------------------- style */
/*
 * Injected once here rather than added to styles.css: this component is
 * self-contained, so it can be dropped into any page without a second edit.
 */
const CSS = `
.info-btn {
  display: inline-grid; place-items: center;
  width: 15px; height: 15px; flex: none;
  border-radius: 999px;
  border: 1px solid #D3D0C8;
  color: #7C8492; background: #FFFFFF;
  font-size: 9.5px; font-weight: 800; line-height: 1;
  font-family: inherit; font-style: normal;
  cursor: pointer; user-select: none;
  transition: color .15s, border-color .15s, background-color .15s;
  vertical-align: 1px;
}
.info-btn:hover { color: #1B3F73; border-color: #C8D5E8; background: #EEF2F8; }
.info-btn[data-open='true'] { color: #1B3F73; border-color: #1B3F73; background: #EEF2F8; }

/* An underlined word in running prose. Inherits its own type — never a chip. */
.info-term {
  font: inherit; color: inherit; background: none; border: 0; padding: 0;
  cursor: help;
  text-decoration: underline dotted #A5ABB5;
  text-underline-offset: 2.5px;
  transition: color .15s, text-decoration-color .15s;
}
.info-term:hover, .info-term[data-open='true'] {
  color: #1B3F73; text-decoration-color: #1B3F73;
}

[popover].info-pop {
  position: fixed;
  inset: auto;
  margin: 0;
  padding: 0;
  width: 320px;
  max-width: calc(100vw - 24px);
  overflow: hidden auto;
  overscroll-behavior: contain;
  background: #FFFFFF;
  color: #15181D;
  border: 1px solid #D3D0C8;
  border-radius: 8px;
  box-shadow: 0 8px 24px -6px rgba(21,24,29,.18), 0 0 0 1px rgba(21,24,29,.06);
  opacity: 1;
  transform: translateY(0);
  transition: opacity .14s ease, transform .14s ease,
              overlay .14s allow-discrete, display .14s allow-discrete;
}
[popover].info-pop:not(:popover-open) { opacity: 0; transform: translateY(-3px); }
@starting-style { [popover].info-pop:popover-open { opacity: 0; transform: translateY(-3px); } }
[popover].info-pop::backdrop { background: transparent; }

.info-close {
  position: absolute; top: 7px; right: 7px;
  width: 20px; height: 20px; display: none; place-items: center;
  border: 0; border-radius: 4px; background: transparent;
  color: #7C8492; font-size: 15px; line-height: 1; cursor: pointer;
}
.info-close:hover { background: #EDEBE6; color: #15181D; }

/* Touch and narrow viewports: a bottom sheet beats a floating card. */
@media (max-width: 560px) {
  [popover].info-pop {
    left: 0 !important; right: 0 !important;
    top: auto !important; bottom: 0 !important;
    width: auto !important; max-width: none !important;
    max-height: 72vh !important;
    border-radius: 12px 12px 0 0;
    border-bottom: 0;
    transform: translateY(0);
  }
  [popover].info-pop:not(:popover-open) { transform: translateY(100%); }
  @starting-style { [popover].info-pop:popover-open { transform: translateY(100%); } }
  .info-close { display: grid; }
}

@media (prefers-reduced-motion: reduce) {
  [popover].info-pop { transition-duration: .01ms; }
}
`;

if (typeof document !== 'undefined' && !document.getElementById('pews-info-css')) {
  const el = document.createElement('style');
  el.id = 'pews-info-css';
  el.textContent = CSS;
  document.head.appendChild(el);
}

/* ---------------------------------------------------------------- placement */
/**
 * Anchors the card to the trigger using `top`/`bottom` rather than a transform,
 * so flipping above the trigger needs no measurement of the card itself — and
 * so `transform` stays free for the open/close transition.
 */
function anchor(pop: HTMLElement, btn: HTMLElement) {
  const b = btn.getBoundingClientRect();
  const M = 12;
  const vw = document.documentElement.clientWidth;
  const vh = document.documentElement.clientHeight;

  const roomBelow = vh - b.bottom - M * 2;
  const roomAbove = b.top - M * 2;
  const flip = roomBelow < 190 && roomAbove > roomBelow;

  const w = Math.min(320, vw - M * 2);
  const left = Math.min(Math.max(M, b.left + b.width / 2 - w / 2), vw - w - M);

  pop.style.left = `${Math.round(left)}px`;
  pop.style.maxHeight = `${Math.round(Math.max(roomBelow, roomAbove))}px`;
  if (flip) {
    pop.style.top = 'auto';
    pop.style.bottom = `${Math.round(vh - b.top + 7)}px`;
  } else {
    pop.style.bottom = 'auto';
    pop.style.top = `${Math.round(b.bottom + 7)}px`;
  }
}

/* ------------------------------------------------------------------ content */

function Definition({ k, lead }: { k: TermKey; lead?: boolean }) {
  const d: TermDef = GLOSSARY[k];
  return (
    <div className={lead ? '' : 'pt-2.5 mt-2.5 border-t border-line-faint'}>
      <div className="text-[12px] font-semibold text-ink leading-snug">{d.term}</div>
      <p className="text-[12px] text-ink-2 leading-relaxed mt-1">{d.short}</p>
      {d.why && <p className="text-[12px] text-ink-3 leading-relaxed mt-1.5">{d.why}</p>}
    </div>
  );
}

interface PopBodyProps {
  title?: string;
  terms: TermKey[];
  children?: ReactNode;
  id: string;
}

function PopBody({ title, terms, children, id }: PopBodyProps) {
  return (
    <div className="p-3.5">
      <button
        className="info-close"
        popovertarget={id}
        popovertargetaction="hide"
        aria-label="Close"
      >
        ×
      </button>
      {title && (
        <div className="eyebrow mb-2 pr-6">{title}</div>
      )}
      {children && (
        <div className="text-[12px] text-ink-2 leading-relaxed [&_code]:text-ink [&_code]:font-medium [&_strong]:text-ink [&_strong]:font-semibold">
          {children}
        </div>
      )}
      {terms.map((k, i) => (
        <div key={k} className={!title && !children && i === 0 ? 'pr-6' : undefined}>
          <Definition k={k} lead={i === 0 && !children && !title} />
        </div>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------- wiring */

/**
 * Shared trigger/popover plumbing.
 *
 * The card is portalled to <body> rather than rendered in place: <Term> is meant
 * to sit inside running prose, and a <div> parented to a <p> is invalid markup
 * that the parser silently repairs by closing the paragraph early. Since the
 * popover lives in the top layer anyway, its position in the DOM buys nothing.
 */
function usePop() {
  const id = `pop${useId()}`.replace(/:/g, '');
  const btn = useRef<HTMLButtonElement>(null);

  const popRef = useCallback((el: HTMLElement | null) => {
    if (!el || el.dataset.bound) return;
    el.dataset.bound = '1';
    el.addEventListener('beforetoggle', (e) => {
      const open = (e as Event & { newState?: string }).newState === 'open';
      if (open && btn.current) anchor(el, btn.current);
      btn.current?.setAttribute('data-open', String(open));
    });
  }, []);

  const card = (body: ReactNode) =>
    createPortal(
      <div id={id} popover="auto" className="info-pop" role="note" ref={popRef}>
        {body}
      </div>,
      document.body,
    );

  return { id, btn, card };
}

/* -------------------------------------------------------------------- <Info> */

/** An "i" beside a heading or label. The primary help affordance. */
export function Info({
  terms = [],
  title,
  children,
  label,
  className,
}: {
  /** Glossary keys to define, in reading order. */
  terms?: TermKey[];
  /** Optional eyebrow above the body — e.g. "How this was produced". */
  title?: string;
  /** Optional prose shown above the definitions. */
  children?: ReactNode;
  /** Screen-reader label for the trigger. Defaults from `title` or the terms. */
  label?: string;
  className?: string;
}) {
  const { id, btn, card } = usePop();

  return (
    <>
      <button
        ref={btn}
        type="button"
        className={`info-btn ${className ?? ''}`}
        popovertarget={id}
        aria-label={
          label ??
          (title ?? (terms.length ? `What ${GLOSSARY[terms[0]].term} means` : 'More information'))
        }
        /* Degrades to a native tooltip if a browser lacks the Popover API. */
        title={terms.length ? GLOSSARY[terms[0]].short : undefined}
      >
        i
      </button>
      {card(
        <PopBody title={title} terms={terms} id={id}>
          {children}
        </PopBody>,
      )}
    </>
  );
}

/* -------------------------------------------------------------------- <Term> */

/** A single term inside running prose or a label. Underlined; click to define. */
export function Term({ k, children }: { k: TermKey; children?: ReactNode }) {
  const { id, btn, card } = usePop();

  return (
    <>
      <button
        ref={btn}
        type="button"
        className="info-term"
        popovertarget={id}
        aria-label={`${GLOSSARY[k].term} — what this means`}
        title={GLOSSARY[k].short}
      >
        {children ?? GLOSSARY[k].term}
      </button>
      {card(<PopBody terms={[k]} id={id} />)}
    </>
  );
}
