import { startTransition, useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { toast } from 'sonner'
import { fetchManifest, fetchSampleResponse, postEvaluate, postOptimize } from './api/client'
import { normalizeManifestResponse, normalizePoseResponse } from './api/normalize'
import { ControlRail, QuickStartCard } from './components/controls/ControlRail'
import { DebugPanel } from './components/debug/DebugPanel'
import { StatusBar } from './components/status/StatusBar'
import { ModelViewport } from './components/viewer/ModelViewport'
import { selectionsToRequests } from './lib/muscleSelection'
import { useAppStore } from './state/appStore'
import type { NormalizedPoseResponse } from './types/api'
import type { AppliedSegmentInfo } from './types/viewer'

const debugTestPose = {
  pelvis_tilt: -0.22,
  lumbar_extension: 0.16,
  hip_flexion_r: 0.68,
  knee_angle_r: 0.82,
  ankle_angle_r: -0.28,
} as const

const neutralPhase1Pose = {
  pelvis_tilt: 0,
  lumbar_extension: 0,
  hip_flexion_r: 0,
  knee_angle_r: 0,
  ankle_angle_r: 0,
} as const

type ViewerDiagnosticMode = 'none' | 'frontend-limb-test'

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
  const startedAt = performance.now()
  try {
    const raw = await postOptimize(requests.optimize)
    const response = normalizePoseResponse(raw, 'backend')
    state.setLatestResponse(response)
    state.setWarning(null)
    const durationMs = performance.now() - startedAt
    if (durationMs > 850) {
      state.setInteractionMode('release')
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Optimize request failed.'
    state.setWarning(`${message} Keeping the last valid pose on screen.`)
    useAppStore.setState({ requestRunning: false })
    toast.error(message)
  }
}

async function requestPosturePreview() {
  await requestOptimize()
}

async function requestDebugPose(pose: Record<string, number>, message: string) {
  const state = useAppStore.getState()
  if (!state.manifest) {
    return
  }
  useAppStore.setState({
    requestRunning: true,
    requestMessage: message,
    lastRequestMode: 'evaluate',
  })
  try {
    const raw = await postEvaluate({
      pose,
      tightness: [],
      selected_groups: [],
      include_upper_body_debug_metrics: false,
    })
    const response = normalizePoseResponse(raw, 'backend')
    state.setLatestResponse(response)
    state.setWarning(null)
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Debug pose request failed.'
    state.setWarning(`${errorMessage} Keeping the last valid pose on screen.`)
    useAppStore.setState({ requestRunning: false })
    toast.error(errorMessage)
  }
}

function App() {
  const manifest = useAppStore((state) => state.manifest)
  const latestResponse = useAppStore((state) => state.latestResponse)
  const sampleResponse = useAppStore((state) => state.sampleResponse)
  const activeSelections = useAppStore((state) => state.activeSelections)
  const warning = useAppStore((state) => state.warning)
  const debugOpen = useAppStore((state) => state.debugOpen)
  const selectedSegment = useAppStore((state) => state.selectedSegment)
  const requestMessage = useAppStore((state) => state.requestMessage)
  const requestRunning = useAppStore((state) => state.requestRunning)
  const interactionMode = useAppStore((state) => state.interactionMode)
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
  const [appliedSegments, setAppliedSegments] = useState<Record<string, AppliedSegmentInfo>>({})
  const [viewerDiagnosticMode, setViewerDiagnosticMode] =
    useState<ViewerDiagnosticMode>('none')
  const [baselineResponse, setBaselineResponse] = useState<NormalizedPoseResponse | null>(null)
  const lastAutoPreviewKeyRef = useRef<string | null>(null)

  useEffect(() => {
    let active = true
    async function boot() {
      try {
        const sampleRaw = await fetchSampleResponse()
        if (!active) {
          return
        }
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
          const normalizedManifest = normalizeManifestResponse(manifestRaw)
          setManifest(normalizedManifest)
          setViewerMode(normalizedManifest.viewer.runtime.available ? 'opensim' : 'debug')
        })
        const baselineRaw = await postEvaluate({
          tightness: [],
          selected_groups: [],
          include_upper_body_debug_metrics: false,
        })
        if (!active) {
          return
        }
        setBaselineResponse(normalizePoseResponse(baselineRaw, 'backend'))
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
    if (!manifest || !baselineResponse || interactionMode !== 'debounced') {
      return
    }

    const selectionKey = JSON.stringify(
      activeSelections.map((selection) => [
        selection.baseName,
        selection.side,
        Number(selection.severity.toFixed(3)),
      ]),
    )
    if (requestRunning || lastAutoPreviewKeyRef.current === selectionKey) {
      return
    }

    const timeout = window.setTimeout(() => {
      lastAutoPreviewKeyRef.current = selectionKey
      void requestPosturePreview()
    }, 320)
    return () => window.clearTimeout(timeout)
  }, [activeSelections, baselineResponse, interactionMode, manifest, requestRunning])

  return (
    <div className="musculomove-shell">
      <main className="relative z-10 mx-auto max-w-[1680px] px-4 py-4 lg:px-6 lg:py-6">
        <div className="grid gap-4 xl:grid-cols-[360px_minmax(0,1fr)]">
          <motion.section
            initial={{ opacity: 0, x: -12 }}
            animate={{ opacity: 1, x: 0 }}
            className="xl:sticky xl:top-6 xl:self-start"
          >
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
                void requestPosturePreview()
              }}
              optimize={() => void requestOptimize()}
              commitEvaluate={() => void requestPosturePreview()}
            />
          </motion.section>

          <motion.section
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-4"
          >
            <StatusBar
              requestMessage={requestMessage}
              requestRunning={requestRunning}
              warning={warning}
              debugOpen={debugOpen}
              onDebugToggle={() => setDebugOpen(!debugOpen)}
            />

            <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
              <ModelViewport
                response={latestResponse}
                baselineResponse={baselineResponse ?? sampleResponse}
                viewer={manifest?.viewer ?? null}
                diagnosticMode={viewerDiagnosticMode}
                selectedSegment={selectedSegment}
                setSelectedSegment={setSelectedSegment}
                onViewerModeChange={setViewerMode}
                onAppliedSegmentsChange={setAppliedSegments}
                onWarning={setWarning}
              />
              <QuickStartCard />
            </div>

            <DebugPanel
              open={debugOpen}
              response={latestResponse}
              selectedSegment={selectedSegment}
              setSelectedSegment={setSelectedSegment}
              appliedSegments={appliedSegments}
              requestRunning={requestRunning}
              applyDebugPose={() =>
                void requestDebugPose(debugTestPose, 'Applying an obvious debug pose…')
              }
              resetDebugPose={() =>
                void requestDebugPose(neutralPhase1Pose, 'Resetting the debug pose…')
              }
              diagnosticMode={viewerDiagnosticMode}
              enableFrontendLimbTest={() => setViewerDiagnosticMode('frontend-limb-test')}
              clearFrontendLimbTest={() => setViewerDiagnosticMode('none')}
            />
          </motion.section>
        </div>
      </main>
    </div>
  )
}

export default App
