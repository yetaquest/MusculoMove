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
  addSelection,
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
    <Card className="flex h-full min-h-0 flex-col overflow-hidden p-4">
      <div>
        <p className="font-[var(--serif)] text-xl text-[var(--ink)]">Lower-body tightness</p>
        <p className="mt-1 text-sm text-[var(--muted)]">
          Pick muscles from a compact grid, then set side and severity on the selections card.
        </p>
      </div>

      <div className="mt-4 rounded-[22px] border border-[var(--border)] bg-white px-4 py-3">
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

      <div className="mt-4">
        <p className="mb-2 text-xs font-semibold uppercase tracking-[0.16em] text-[var(--muted)]">
          Featured
        </p>
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

      <div className="mt-4 flex min-h-0 flex-1 flex-col overflow-hidden rounded-[24px] border border-[var(--border)] bg-[var(--surface-strong)] p-2">
        <div className="mb-2 px-2 text-xs font-semibold uppercase tracking-[0.16em] text-[var(--muted)]">
          All muscles
        </div>
        <div className="min-h-0 flex-1 overflow-auto pr-1">
          <div className="grid grid-cols-2 gap-2">
            {availableEntries.map((entry) => (
              <button
                key={entry.baseName}
                onClick={() => addSelection(entry.baseName)}
                className="rounded-[18px] border border-transparent bg-white/65 px-3 py-3 text-left transition hover:border-[var(--accent)] hover:bg-white"
              >
                <div>
                  <p className="text-sm font-medium leading-tight text-[var(--ink)]">{entry.label}</p>
                  <p className="mt-1 text-[11px] text-[var(--muted)]">{entry.baseName}</p>
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>
    </Card>
  )
}

export function ActiveSelectionsCard({
  selections,
  requestRunning,
  interactionMode,
  updateSelection,
  removeSelection,
  clearSelections,
  optimize,
  commitEvaluate,
}: Pick<
  ControlRailProps,
  | 'selections'
  | 'requestRunning'
  | 'interactionMode'
  | 'updateSelection'
  | 'removeSelection'
  | 'clearSelections'
  | 'optimize'
  | 'commitEvaluate'
>) {
  return (
    <Card className="flex h-full min-h-0 flex-col overflow-hidden p-4">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="font-[var(--serif)] text-lg text-[var(--ink)]">Active selections</p>
          <p className="mt-1 text-sm text-[var(--muted)]">
            {selections.length === 0
              ? 'No muscles selected yet.'
              : `${selections.length} active ${selections.length === 1 ? 'selection' : 'selections'}.`}
          </p>
        </div>
        <Button variant="ghost" size="sm" onClick={clearSelections}>
          <RotateCcw className="size-4" />
          Reset
        </Button>
      </div>

      <div className="mt-4 min-h-0 flex-1 space-y-3 overflow-auto pr-1">
        {selections.length === 0 ? (
          <div className="rounded-[24px] border border-dashed border-[var(--border)] bg-[var(--surface-strong)] px-4 py-8 text-center text-sm text-[var(--muted)]">
            Add one or more muscles from the tightness panel to start building a passive-tightness scenario.
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
                    <span className="font-[var(--mono)] text-[var(--ink)]">
                      {selection.severity.toFixed(2)}
                    </span>
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

      <div className="mt-4 flex flex-wrap gap-2">
        <Button onClick={optimize} disabled={requestRunning || selections.length === 0}>
          <Play className="size-4" />
          Optimize
        </Button>
        {interactionMode === 'release' ? (
          <Button variant="secondary" onClick={commitEvaluate} disabled={requestRunning}>
            Update posture
          </Button>
        ) : null}
      </div>
    </Card>
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
