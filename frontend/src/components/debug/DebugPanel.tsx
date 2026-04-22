import { quaternionTuple, segmentTransformToPose } from '../../lib/transformAdapter'
import type { NormalizedPoseResponse } from '../../types/api'
import type { AppliedSegmentInfo } from '../../types/viewer'
import { Card } from '../ui/card'

type DebugPanelProps = {
  open: boolean
  response: NormalizedPoseResponse | null
  selectedSegment: string
  setSelectedSegment: (segment: string) => void
  appliedSegments: Record<string, AppliedSegmentInfo>
}

export function DebugPanel({
  open,
  response,
  selectedSegment,
  setSelectedSegment,
  appliedSegments,
}: DebugPanelProps) {
  if (!open) {
    return null
  }

  const segmentNames = Object.keys(response?.segmentTransforms ?? {})
  const transform = response?.segmentTransforms[selectedSegment]
  const pose = transform ? segmentTransformToPose(transform) : null
  const applied = appliedSegments[selectedSegment]

  return (
    <Card className="h-full p-5">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="font-[var(--serif)] text-lg text-[var(--ink)]">Debug inspector</p>
          <p className="text-sm text-[var(--muted)]">Matrix-first backend data, mapped for the viewer.</p>
        </div>
      </div>

      <div className="mt-5 space-y-5">
        <label className="block">
          <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.16em] text-[var(--muted)]">
            Selected segment
          </span>
          <select
            className="w-full rounded-2xl border border-[var(--border)] bg-white px-3 py-3 text-sm"
            value={selectedSegment}
            onChange={(event) => setSelectedSegment(event.target.value)}
          >
            {segmentNames.map((segment) => (
              <option key={segment} value={segment}>
                {segment}
              </option>
            ))}
          </select>
        </label>

        <div className="grid gap-3 rounded-[24px] bg-[var(--surface-strong)] p-4 text-sm">
          <DebugRow label="Mapped node" value={applied?.nodeName ?? 'unmapped'} />
          <DebugRow label="Applied" value={String(applied?.applied ?? false)} />
          <DebugRow label="Request mode" value={response?.status.mode ?? 'fallback'} />
        </div>

        <DebugMatrix
          title="Translation (m)"
          lines={transform ? transform.translation_m.map((value) => value.toFixed(5)) : ['n/a']}
        />
        <DebugMatrix
          title="Rotation matrix"
          lines={
            transform
              ? transform.rotation_matrix_3x3.map((row) =>
                  `[${row.map((value) => value.toFixed(5)).join(', ')}]`,
                )
              : ['n/a']
          }
        />
        <DebugMatrix
          title="Derived quaternion"
          lines={pose ? quaternionTuple(pose.quaternion).map((value) => value.toFixed(5)) : ['n/a']}
        />
      </div>
    </Card>
  )
}

function DebugRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-[var(--muted)]">{label}</span>
      <code className="rounded-full bg-white px-3 py-1 text-[var(--ink)]">{value}</code>
    </div>
  )
}

function DebugMatrix({ title, lines }: { title: string; lines: string[] }) {
  return (
    <div>
      <p className="mb-2 text-xs font-semibold uppercase tracking-[0.16em] text-[var(--muted)]">{title}</p>
      <div className="space-y-2 rounded-[24px] bg-[#1d2623] px-4 py-4 font-[var(--mono)] text-xs text-[#d7ece7]">
        {lines.map((line) => (
          <div key={line}>{line}</div>
        ))}
      </div>
    </div>
  )
}
