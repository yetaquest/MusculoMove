import { useDeferredValue, useState } from 'react'
import { motion } from 'framer-motion'
import { Minus, Play, RotateCcw, Search } from 'lucide-react'
import type { ActiveMuscleSelection, MuscleCatalogEntry, SideOption } from '../../types/api'
import { Button } from '../ui/button'
import { Card } from '../ui/card'

type ControlRailProps = {
  catalog: MuscleCatalogEntry[]
  selections: ActiveMuscleSelection[]
  requestRunning: boolean
  interactionMode: 'debounced' | 'release'
  addSelection: (baseName: string) => void
  updateSelection: (
    id: string,
    updates: Partial<Pick<ActiveMuscleSelection, 'side' | 'severity'>>,
  ) => void
  removeSelection: (id: string) => void
  clearSelections: () => void
  optimize: () => void
  commitEvaluate: () => void
}

const featuredPresets = [
  'iliacus',
  'psoas',
  'recfem',
  'bflh',
  'bfsh',
  'semiten',
  'semimem',
  'soleus',
  'gasmed',
  'gaslat',
  'tibant',
  'glmed1',
  'glmax1',
]

export function ControlRail({
  catalog,
  selections,
  requestRunning,
  interactionMode,
  addSelection,
  updateSelection,
  removeSelection,
  clearSelections,
  optimize,
  commitEvaluate,
}: ControlRailProps) {
  const [query, setQuery] = useState('')
  const deferredQuery = useDeferredValue(query)
  const availableEntries = catalog.filter((entry) =>
    entry.label.toLowerCase().includes(deferredQuery.toLowerCase()) ||
    entry.baseName.includes(deferredQuery.toLowerCase()),
  )
  const featuredEntries = featuredPresets
    .map((preset) => catalog.find((entry) => entry.baseName === preset))
    .filter(Boolean) as MuscleCatalogEntry[]

  return (
    <div className="flex flex-col gap-4">
      <Card className="p-5">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--accent-strong)]">
            Quick Start
          </p>
          <p className="mt-2 font-[var(--serif)] text-xl text-[var(--ink)]">How to use the posture sandbox</p>
        </div>

        <div className="mt-4 rounded-[22px] border border-[var(--border)] bg-white/80 p-4 text-sm text-[var(--muted)]">
          <ol className="space-y-3">
            <li>1. Add one or two lower-body muscles from the list below.</li>
            <li>2. Set side and severity, then use `Preview current sliders` or let live preview update.</li>
            <li>3. Press `Optimize` to solve the current passive compensation pose and inspect the model output.</li>
          </ol>
        </div>

        <div className="mt-4 rounded-[22px] bg-[var(--accent-soft)] px-4 py-3 text-sm text-[var(--ink)]">
          Example: tighten `iliacus` and `psoas` on the right at `0.60`, preview the pose, then run
          `Optimize` and compare the pelvis and hip posture in the viewport.
        </div>
      </Card>

      <Card className="p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="font-[var(--serif)] text-2xl text-[var(--ink)]">Lower-body tightness</p>
            <p className="mt-2 text-sm text-[var(--muted)]">
              Add lower-body muscles, choose a side, then evaluate or optimize the passive scenario.
            </p>
          </div>
        </div>

        <div className="mt-5 rounded-[24px] border border-[var(--border)] bg-white px-4 py-3">
          <div className="flex items-center gap-3">
            <Search className="size-4 text-[var(--muted)]" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              className="w-full border-none bg-transparent outline-none"
              placeholder="Search iliacus, semimem, soleus, glmed1..."
            />
          </div>
        </div>

        <div className="mt-5">
          <p className="mb-3 text-xs font-semibold uppercase tracking-[0.16em] text-[var(--muted)]">Quick add</p>
          <div className="flex flex-wrap gap-2">
            {featuredEntries.map((entry) => (
              <button
                key={entry.baseName}
                onClick={() => addSelection(entry.baseName)}
                className="rounded-full border border-[var(--border)] bg-[var(--surface-strong)] px-3 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-[var(--ink)] transition hover:border-[var(--accent)] hover:bg-white"
              >
                {entry.label}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-5 max-h-60 overflow-auto rounded-[24px] border border-[var(--border)] bg-[var(--surface-strong)] p-2">
          <div className="grid gap-2">
            {availableEntries.slice(0, 18).map((entry) => (
              <button
                key={entry.baseName}
                onClick={() => addSelection(entry.baseName)}
                className="flex items-center justify-between rounded-[20px] px-4 py-3 text-left transition hover:bg-white"
              >
                <div>
                  <p className="font-medium text-[var(--ink)]">{entry.label}</p>
                  <p className="text-xs text-[var(--muted)]">{entry.baseName}</p>
                </div>
                <span className="text-xs uppercase tracking-[0.14em] text-[var(--muted)]">
                  {entry.groups.join(', ')}
                </span>
              </button>
            ))}
          </div>
        </div>
      </Card>

      <Card className="p-5">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="font-[var(--serif)] text-xl text-[var(--ink)]">Active selections</p>
            <p className="text-sm text-[var(--muted)]">
              Preview updates the current passive scenario. Optimize solves the phase-1 pose.
            </p>
          </div>
          <Button variant="ghost" size="sm" onClick={clearSelections}>
            <RotateCcw className="size-4" />
            Reset
          </Button>
        </div>

        <div className="mt-4 space-y-3">
          {selections.length === 0 ? (
            <div className="rounded-[24px] border border-dashed border-[var(--border)] bg-[var(--surface-strong)] px-4 py-8 text-center text-sm text-[var(--muted)]">
              Add one or more muscles from the list above to start building a passive-tightness scenario.
            </div>
          ) : (
            selections.map((selection) => (
              <motion.div
                key={selection.id}
                layout
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className="rounded-[24px] border border-[var(--border)] bg-white p-4"
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="font-medium text-[var(--ink)]">{selection.baseName}</p>
                    <p className="text-xs uppercase tracking-[0.14em] text-[var(--muted)]">
                      Max shortening fraction {selection.maxShorteningFraction.toFixed(2)}
                    </p>
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => removeSelection(selection.id)}>
                    <Minus className="size-4" />
                  </Button>
                </div>

                <div className="mt-4 grid gap-4 md:grid-cols-[1fr_1.2fr]">
                  <SideSelector
                    side={selection.side}
                    onChange={(side) => updateSelection(selection.id, { side })}
                  />
                  <div>
                    <div className="mb-2 flex items-center justify-between text-sm">
                      <span className="text-[var(--muted)]">Severity</span>
                      <span className="font-[var(--mono)] text-[var(--ink)]">{selection.severity.toFixed(2)}</span>
                    </div>
                    <input
                      type="range"
                      className="range-input"
                      min={0}
                      max={1}
                      step={0.01}
                      value={selection.severity}
                      onChange={(event) =>
                        updateSelection(selection.id, { severity: Number(event.target.value) })
                      }
                      onMouseUp={() => {
                        if (interactionMode === 'release') {
                          commitEvaluate()
                        }
                      }}
                      onTouchEnd={() => {
                        if (interactionMode === 'release') {
                          commitEvaluate()
                        }
                      }}
                    />
                  </div>
                </div>
              </motion.div>
            ))
          )}
        </div>

        <div className="mt-5 flex flex-wrap gap-3">
          <Button onClick={optimize} disabled={requestRunning || selections.length === 0}>
            <Play className="size-4" />
            Optimize
          </Button>
          {interactionMode === 'release' ? (
            <Button variant="secondary" onClick={commitEvaluate} disabled={requestRunning}>
              Preview current sliders
            </Button>
          ) : null}
        </div>
      </Card>
    </div>
  )
}

function SideSelector({
  side,
  onChange,
}: {
  side: SideOption
  onChange: (side: SideOption) => void
}) {
  const options: SideOption[] = ['left', 'right', 'bilateral']
  return (
    <div>
      <p className="mb-2 text-sm text-[var(--muted)]">Side</p>
      <div className="grid grid-cols-3 gap-2 rounded-full bg-[var(--surface-strong)] p-1">
        {options.map((option) => (
          <button
            key={option}
            onClick={() => onChange(option)}
            className={`rounded-full px-3 py-2 text-xs font-semibold uppercase tracking-[0.14em] transition ${
              side === option
                ? 'bg-[var(--accent)] text-white shadow-[0_12px_18px_rgba(18,87,82,0.18)]'
                : 'text-[var(--muted)] hover:bg-white'
            }`}
          >
            {option}
          </button>
        ))}
      </div>
    </div>
  )
}
