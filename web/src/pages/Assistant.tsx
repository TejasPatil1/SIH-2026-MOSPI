import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAssistant } from '../api/hooks';
import { ASSISTANT_SUGGESTIONS } from '../api/mock';
import { Disclosure, Page, Panel, RiskBadge, Section, cx } from '../components/ui';

export default function Assistant() {
  const nav = useNavigate();
  const [q, setQ] = useState('');
  const [asked, setAsked] = useState<string | null>(null);
  const ask = useAssistant();

  const submit = (text: string) => {
    const t = text.trim();
    if (!t) return;
    setAsked(t);
    setQ('');
    ask.mutate(t);
  };

  const a = ask.data;

  return (
    <Page
      title="Ask the portfolio"
      lede="Natural-language questions answered by fixed parameterised queries over the scored portfolio. Deterministic by design — it retrieves, it does not generate."
    >
      <div className="grid grid-cols-[minmax(0,1fr)_286px] gap-5 items-start">
        <div>
          {/* ------------------------------------------------------- input */}
          <form
            onSubmit={(e) => { e.preventDefault(); submit(q); }}
            className="flex gap-2 mb-3"
          >
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Ask about sectors, ministries, stalled projects, exposure or risk drivers…"
              className="field flex-1 h-9"
              autoFocus
            />
            <button type="submit" className="btn btn-primary h-9 px-4" disabled={!q.trim() || ask.isPending}>
              Ask
            </button>
          </form>

          <div className="flex flex-wrap gap-2 mb-5">
            {ASSISTANT_SUGGESTIONS.map((s) => (
              <button
                key={s}
                onClick={() => submit(s)}
                className="text-[12px] px-2.5 h-[26px] rounded-full border border-line bg-surface text-ink-2
                           hover:border-accent-line hover:bg-accent-soft hover:text-accent
                           transition-all duration-150 active:scale-[0.98]"
              >
                {s}
              </button>
            ))}
          </div>

          {/* ------------------------------------------------------ answer */}
          {!asked && (
            <Panel className="border-dashed">
              <p className="text-[12.5px] text-ink-2 leading-relaxed">
                Pick a suggested question or type your own. Answers are assembled from query results, so every
                figure traces back to a row in the scored portfolio — the assistant is structurally incapable of
                inventing a number.
              </p>
            </Panel>
          )}

          {asked && (
            <div className="space-y-3">
              <div className="flex justify-end">
                <div className="max-w-[76%] px-3.5 py-2 rounded-lg rounded-br-sm bg-accent text-white text-[13px] leading-snug">
                  {asked}
                </div>
              </div>

              {ask.isPending && (
                <div className="flex items-center gap-1.5 px-3.5 py-3">
                  {[0, 1, 2].map((i) => (
                    <span
                      key={i}
                      className="w-[5px] h-[5px] rounded-full bg-ink-4"
                      style={{ animation: `bounce 1.1s ease-in-out ${i * 0.16}s infinite` }}
                    />
                  ))}
                  <style>{'@keyframes bounce{0%,60%,100%{opacity:.32;transform:translateY(0)}30%{opacity:1;transform:translateY(-3px)}}'}</style>
                </div>
              )}

              {a && (
                <div className="fade-in space-y-3">
                  <Panel>
                    <div className="flex items-center gap-2 mb-2.5">
                      <span className={cx('chip', a.understood ? 'bg-accent-soft text-accent border-accent-line' : 'bg-line-faint text-ink-3 border-line')}>
                        {a.intent_label}
                      </span>
                      {a.understood && (
                        <span className="num text-2xs text-ink-3 tracking-[0.04em]">{a.intent}</span>
                      )}
                    </div>

                    <p className="text-[13.5px] text-ink leading-relaxed">{a.answer}</p>

                    {a.metrics.length > 0 && (
                      <div className="flex flex-wrap gap-x-7 gap-y-3 mt-4 pt-3.5 border-t border-line-faint">
                        {a.metrics.map((m) => (
                          <div key={m.label}>
                            <div className="eyebrow mb-1">{m.label}</div>
                            <div className="num text-md font-semibold text-ink leading-none">{m.value}</div>
                          </div>
                        ))}
                      </div>
                    )}

                    {!a.understood && a.supported && (
                      <ul className="mt-3 pt-3 border-t border-line-faint space-y-1.5">
                        {a.supported.map((s) => (
                          <li key={s}>
                            <button onClick={() => submit(s)}
                              className="text-[12.5px] text-accent hover:underline text-left">
                              {s}
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}

                    {a.understood && (
                      <Disclosure summary="How this was answered">
                        <div className="space-y-3">
                          {a.filters_applied.length > 0 && (
                            <div>
                              <div className="eyebrow mb-1.5">Filters applied</div>
                              <div className="flex flex-wrap gap-1.5">
                                {a.filters_applied.map((f) => (
                                  <span key={`${f.field}${f.value}`} className="num text-2xs px-2 h-[21px] inline-flex items-center rounded border border-line bg-raised text-ink-2">
                                    {f.field} {f.op} {f.value}
                                  </span>
                                ))}
                              </div>
                            </div>
                          )}
                          <div>
                            <div className="eyebrow mb-1.5">Executed query</div>
                            <pre className="num text-[11.5px] leading-relaxed bg-ink text-white/90 rounded px-3 py-2.5 overflow-x-auto">
                              {a.query_text}
                            </pre>
                          </div>
                          <p className="text-[12px] text-ink-2 leading-relaxed">
                            The intent parser selects one of eight fixed query templates. No query is
                            string-built from user input and no language model touches the numbers.
                          </p>
                        </div>
                      </Disclosure>
                    )}
                  </Panel>

                  {a.projects.length > 0 && (
                    <Section title="Matching projects" note={`${a.projects.length} shown`} flush>
                      <div className="flex flex-wrap gap-2">
                        {a.projects.map((p) => (
                          <button
                            key={p.project_id}
                            onClick={() => nav(`/project/${p.project_id}`)}
                            className="group flex items-center gap-2.5 pl-3 pr-2.5 py-2 rounded border border-line bg-surface
                                       hover:border-accent-line hover:bg-accent-soft transition-all duration-150 text-left max-w-[330px]"
                          >
                            <span className="min-w-0">
                              <span className="block text-[12.5px] font-medium text-ink truncate">{p.project_name}</span>
                              <span className="num block text-2xs text-ink-3">{p.project_id} · {p.sector}</span>
                            </span>
                            <RiskBadge band={p.risk_band} score={p.risk_score} size="sm" />
                          </button>
                        ))}
                      </div>
                    </Section>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* --------------------------------------------------- right rail */}
        <Panel>
          <div className="eyebrow mb-2.5">Why this is not a chatbot</div>
          <p className="text-[12px] text-ink-2 leading-relaxed">
            A generative model asked about ₹42.78 lakh crore of public expenditure can produce a fluent,
            confident, wrong number. For a government monitoring system that failure mode is unacceptable,
            so the language surface is deliberately narrow.
          </p>
          <div className="eyebrow mt-4 mb-2">Supported intents</div>
          <ul className="space-y-1">
            {['TOP_RISK', 'SECTOR_SUMMARY', 'MINISTRY_SUMMARY', 'STALLED_PROJECTS',
              'PROJECT_LOOKUP', 'DRIVER_QUERY', 'COMPARE_SECTORS', 'COUNT_QUERY'].map((i) => (
              <li key={i} className="num text-[11.5px] text-ink-2 flex items-center gap-2">
                <span className="w-1 h-1 rounded-full bg-ink-4 shrink-0" />
                {i}
              </li>
            ))}
          </ul>
          <p className="text-[12px] text-ink-2 leading-relaxed mt-4 pt-3 border-t border-line-faint">
            Anything outside these returns a fallback listing what it can answer, rather than a guess.
          </p>
        </Panel>
      </div>
    </Page>
  );
}
