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
      <Card className="px-5 py-4">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-start gap-3">
            <span className="rounded-full bg-[var(--surface-strong)] p-2 text-[var(--accent-strong)]">
              <Activity className="size-4" />
            </span>
            <div>
              <p className="font-medium text-[var(--ink)]">
                {requestRunning ? 'Processing current request' : 'Viewer ready'}
              </p>
              <p className="text-sm text-[var(--muted)]">{requestMessage}</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge className="bg-[var(--accent-soft)] text-[var(--accent-strong)]">{lastRequestMode}</Badge>
            <Badge>{interactionMode === 'debounced' ? 'Live preview' : 'Release to preview'}</Badge>
            <Badge className="gap-2">
              {interactionMode === 'debounced' ? <Orbit className="size-3.5" /> : <TimerReset className="size-3.5" />}
              {interactionMode === 'debounced' ? 'Auto evaluate' : 'Manual preview'}
            </Badge>
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
