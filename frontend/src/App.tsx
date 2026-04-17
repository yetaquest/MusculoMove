import { startTransition, useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { toast } from 'sonner'
import { fetchManifest, fetchSampleResponse, postEvaluate, postOptimize, probeAvatarAsset } from './api/client'
import { normalizeManifestResponse, normalizePoseResponse } from './api/normalize'
import { ControlRail } from './components/controls/ControlRail'
import { DebugPanel } from './components/debug/DebugPanel'
import { StatusBar } from './components/status/StatusBar'
import { ModelViewport } from './components/viewer/ModelViewport'
import { selectionsToRequests } from './lib/muscleSelection'
import { useAppStore } from './state/appStore'
import type { AppliedSegmentInfo } from './types/viewer'

async function requestEvaluate() {
  const state = useAppStore.getState()
  if (!state.manifest) {
    return
  }
  useAppStore.setState({
    requestRunning: true,
    requestMessage: 'Evaluating the current passive scenario…',
    lastRequestMode: 'evaluate',
  })
  const requests = selectionsToRequests(state.activeSelections, state.manifest.muscleCatalog)
  const startedAt = performance.now()
  try {
    const raw = await postEvaluate(requests.evaluate)
    const response = normalizePoseResponse(raw, 'backend')
    state.setLatestResponse(response)
    state.setWarning(null)
    const durationMs = performance.now() - startedAt
    if (durationMs > 850) {
      state.setInteractionMode('release')
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Evaluate request failed.'
    state.setWarning(`${message} Keeping the last valid pose on screen.`)
    useAppStore.setState({ requestRunning: false })
    toast.warning(message)
  }
}

async function requestOptimize() {
  const state = useAppStore.getState()
  if (!state.manifest) {
    return
  }
  useAppStore.setState({
    requestRunning: true,
    requestMessage: 'Running the phase-1 passive optimizer…',
    lastRequestMode: 'optimize',
  })
  const requests = selectionsToRequests(state.activeSelections, state.manifest.muscleCatalog)
  try {
    const raw = await postOptimize(requests.optimize)
    const response = normalizePoseResponse(raw, 'backend')
    state.setLatestResponse(response)
    state.setWarning(null)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Optimize request failed.'
    state.setWarning(`${message} Keeping the last valid pose on screen.`)
    useAppStore.setState({ requestRunning: false })
    toast.error(message)
  }
}

function App() {
  const manifest = useAppStore((state) => state.manifest)
  const latestResponse = useAppStore((state) => state.latestResponse)
  const activeSelections = useAppStore((state) => state.activeSelections)
  const warning = useAppStore((state) => state.warning)
  const debugOpen = useAppStore((state) => state.debugOpen)
  const selectedSegment = useAppStore((state) => state.selectedSegment)
  const requestMessage = useAppStore((state) => state.requestMessage)
  const requestRunning = useAppStore((state) => state.requestRunning)
  const interactionMode = useAppStore((state) => state.interactionMode)
  const lastRequestMode = useAppStore((state) => state.lastRequestMode)
  const setManifest = useAppStore((state) => state.setManifest)
  const setSampleResponse = useAppStore((state) => state.setSampleResponse)
  const addSelection = useAppStore((state) => state.addSelection)
  const updateSelection = useAppStore((state) => state.updateSelection)
  const removeSelection = useAppStore((state) => state.removeSelection)
  const clearSelections = useAppStore((state) => state.clearSelections)
  const setWarning = useAppStore((state) => state.setWarning)
  const setDebugOpen = useAppStore((state) => state.setDebugOpen)
  const setSelectedSegment = useAppStore((state) => state.setSelectedSegment)
  const setViewerMode = useAppStore((state) => state.setViewerMode)
  const [avatarAvailable, setAvatarAvailable] = useState(false)
  const [appliedSegments, setAppliedSegments] = useState<Record<string, AppliedSegmentInfo>>({})

  useEffect(() => {
    let active = true
    async function boot() {
      try {
        const [sampleRaw, avatarProbe] = await Promise.all([
          fetchSampleResponse(),
          probeAvatarAsset(),
        ])
        if (!active) {
          return
        }
        setAvatarAvailable(avatarProbe)
        setViewerMode(avatarProbe ? 'avatar' : 'debug')
        setSampleResponse(normalizePoseResponse(sampleRaw, 'sample'))
      } catch {
        if (!active) {
          return
        }
        setWarning('Saved sample pose could not be loaded. The viewer will wait for a backend response.')
      }

      try {
        const manifestRaw = await fetchManifest()
        if (!active) {
          return
        }
        startTransition(() => {
          setManifest(normalizeManifestResponse(manifestRaw))
        })
        await requestEvaluate()
      } catch (error) {
        if (!active) {
          return
        }
        const message =
          error instanceof Error
            ? error.message
            : 'Manifest request failed. The frontend is staying in fallback mode.'
        setWarning(`${message} Showing the saved sample pose instead.`)
        toast.warning(message)
      }
    }

    void boot()
    return () => {
      active = false
    }
  }, [setManifest, setSampleResponse, setViewerMode, setWarning])

  useEffect(() => {
    if (!manifest || interactionMode !== 'debounced') {
      return
    }
    const timeout = window.setTimeout(() => {
      void requestEvaluate()
    }, 220)
    return () => window.clearTimeout(timeout)
  }, [activeSelections, interactionMode, manifest])

  return (
    <div className="musculomove-shell">
      <main className="relative z-10 mx-auto max-w-[1680px] px-4 py-4 lg:px-6 lg:py-6">
        <div className="grid gap-4 xl:grid-cols-[360px_minmax(0,1fr)_360px]">
          <motion.section initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }}>
            <ControlRail
              catalog={manifest?.muscleCatalog ?? []}
              selections={activeSelections}
              requestRunning={requestRunning}
              interactionMode={interactionMode}
              addSelection={addSelection}
              updateSelection={updateSelection}
              removeSelection={removeSelection}
              clearSelections={() => {
              clearSelections()
                void requestEvaluate()
              }}
              optimize={() => void requestOptimize()}
              commitEvaluate={() => void requestEvaluate()}
            />
          </motion.section>

          <motion.section
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-4"
          >
            <div className="rounded-[32px] border border-[var(--border)] bg-[var(--surface)]/80 px-6 py-5 shadow-[var(--shadow)] backdrop-blur">
              <div className="flex flex-col gap-3 xl:flex-row xl:items-end xl:justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--accent-strong)]">
                    MusculoMove
                  </p>
                  <h1 className="mt-2 max-w-3xl font-[var(--serif)] text-4xl leading-[1.02] tracking-[-0.04em] text-[var(--ink)] lg:text-6xl">
                    Full-body passive accommodation, viewed as a live 3D posture experiment.
                  </h1>
                </div>
                <p className="max-w-sm text-sm leading-6 text-[var(--muted)]">
                  The viewer keeps the full-body rig in frame, while the controls stay focused on lower-body
                  muscle-property tightening. Use Optimize to solve the phase-1 compensation subset.
                </p>
              </div>
            </div>

            <StatusBar
              requestMessage={requestMessage}
              requestRunning={requestRunning}
              warning={warning}
              interactionMode={interactionMode}
              lastRequestMode={lastRequestMode}
            />

            <ModelViewport
              response={latestResponse}
              selectedSegment={selectedSegment}
              setSelectedSegment={setSelectedSegment}
              avatarAvailable={avatarAvailable}
              onViewerModeChange={setViewerMode}
              onAppliedSegmentsChange={setAppliedSegments}
            />
          </motion.section>

          <motion.aside initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} className="space-y-4">
            <div className="rounded-[28px] border border-[var(--border)] bg-[var(--surface)]/92 p-5 shadow-[var(--shadow)]">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="font-[var(--serif)] text-xl text-[var(--ink)]">Inspector</p>
                  <p className="text-sm text-[var(--muted)]">
                    Toggle transform diagnostics without interrupting the viewer.
                  </p>
                </div>
                <button
                  onClick={() => setDebugOpen(!debugOpen)}
                  className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                    debugOpen
                      ? 'bg-[var(--accent)] text-white'
                      : 'border border-[var(--border)] bg-white text-[var(--ink)]'
                  }`}
                >
                  {debugOpen ? 'Hide debug' : 'Show debug'}
                </button>
              </div>

              <div className="mt-5 space-y-3 text-sm text-[var(--muted)]">
                <p>
                  Current request mode: <strong className="text-[var(--ink)]">{lastRequestMode}</strong>
                </p>
                <p>
                  Current segment: <strong className="text-[var(--ink)]">{selectedSegment}</strong>
                </p>
                <p>
                  Bone mapping warnings never blank the viewer. Unmapped segments stay in rest pose when the
                  avatar is active.
                </p>
              </div>
            </div>

            <DebugPanel
              open={debugOpen}
              response={latestResponse}
              selectedSegment={selectedSegment}
              setSelectedSegment={setSelectedSegment}
              appliedSegments={appliedSegments}
            />
          </motion.aside>
        </div>
      </main>
    </div>
  )
}

export default App
