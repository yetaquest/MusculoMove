import { Activity, AlertTriangle, Orbit, TimerReset } from 'lucide-react'
import { motion } from 'framer-motion'
import { Badge } from '../ui/badge'
import { Card } from '../ui/card'

type StatusBarProps = {
  requestMessage: string
  requestRunning: boolean
  warning: string | null
  interactionMode: 'debounced' | 'release'
  lastRequestMode: 'evaluate' | 'optimize' | 'fallback'
}

export function StatusBar({
  requestMessage,
  requestRunning,
  warning,
  interactionMode,
  lastRequestMode,
}: StatusBarProps) {
  return (
    <div className="flex flex-col gap-3">
      <Card className="overflow-hidden">
        <div className="flex items-center justify-between gap-4 border-b border-[var(--border)] px-5 py-4">
          <div>
            <p className="font-[var(--serif)] text-lg text-[var(--ink)]">Runtime status</p>
            <p className="text-sm text-[var(--muted)]">{requestMessage}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge className="bg-[var(--accent-soft)] text-[var(--accent-strong)]">
              {lastRequestMode}
            </Badge>
            <Badge>{interactionMode === 'debounced' ? 'Live preview' : 'Release to preview'}</Badge>
          </div>
        </div>
        <div className="grid gap-3 px-5 py-4 text-sm text-[var(--muted)] sm:grid-cols-2">
          <div className="flex items-center gap-3">
            <span className="rounded-full bg-[var(--surface-strong)] p-2 text-[var(--accent-strong)]">
              <Activity className="size-4" />
            </span>
            <div>
              <p className="font-medium text-[var(--ink)]">Request mode</p>
              <p>{requestRunning ? 'Working on the latest request.' : 'Stable. Ready for the next update.'}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="rounded-full bg-[var(--surface-strong)] p-2 text-[var(--accent-strong)]">
              {interactionMode === 'debounced' ? <Orbit className="size-4" /> : <TimerReset className="size-4" />}
            </span>
            <div>
              <p className="font-medium text-[var(--ink)]">Preview policy</p>
              <p>
                {interactionMode === 'debounced'
                  ? 'Slider edits debounce into evaluate requests.'
                  : 'The UI waits until release before requesting a new preview.'}
              </p>
            </div>
          </div>
        </div>
      </Card>

      {warning ? (
        <motion.div
          initial={{ opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-[22px] border border-[color:var(--warn)]/30 bg-[color:rgba(199,101,47,0.12)] px-4 py-3 text-sm text-[var(--ink)]"
        >
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 size-4 shrink-0 text-[var(--warn)]" />
            <p>{warning}</p>
          </div>
        </motion.div>
      ) : null}
    </div>
  )
}
