import { Fragment } from 'react'
import { ToolAvatar } from '../tools/ToolAvatar'

type Step = { name: string; role: string; slug: string }

const stack: Step[] = [
  { name: 'Perplexity', role: 'Research the topic', slug: 'perplexity' },
  { name: 'Runway', role: 'Generate B-roll', slug: 'runway' },
  { name: 'ElevenLabs', role: 'Voice over and dub', slug: 'elevenlabs' },
]

export function WorkflowShowcase() {
  return (
    <section className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6">
      <div className="rounded-xl border border-border bg-surface p-6 sm:p-10">
        <p className="text-2xs uppercase tracking-widest text-text-muted">
          example workflow
        </p>
        <h2 className="mt-2 text-xl font-semibold tracking-tight text-text-primary">
          YouTube creator stack
        </h2>
        <p className="mt-1 text-sm text-text-secondary">
          A three-tool pipeline that takes an idea to a finished short.
        </p>

        <div className="mt-8 flex flex-col items-stretch gap-4 sm:flex-row sm:items-center">
          {stack.map((s, i) => (
            <Fragment key={s.slug}>
              <a
                href={`/tools/${s.slug}`}
                className="flex flex-1 items-center gap-3 rounded-lg border border-border bg-surface-2 p-4 transition-colors duration-base ease-enter hover:border-accent"
              >
                <ToolAvatar name={s.name} size={40} />
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-text-primary">
                    {s.name}
                  </p>
                  <p className="truncate text-2xs text-text-muted">{s.role}</p>
                </div>
              </a>
              {i < stack.length - 1 && (
                <span
                  aria-hidden="true"
                  className="hidden text-text-muted sm:inline"
                >
                  →
                </span>
              )}
            </Fragment>
          ))}
        </div>
      </div>
    </section>
  )
}
