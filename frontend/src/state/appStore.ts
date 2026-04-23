import { create } from 'zustand'
import type {
  ActiveMuscleSelection,
  NormalizedManifest,
  NormalizedPoseResponse,
  SideOption,
} from '../types/api'
import type { ViewerMode } from '../types/viewer'

type InteractionMode = 'debounced' | 'release'

type AppState = {
  manifest: NormalizedManifest | null
  latestResponse: NormalizedPoseResponse | null
  sampleResponse: NormalizedPoseResponse | null
  activeSelections: ActiveMuscleSelection[]
  warning: string | null
  debugOpen: boolean
  selectedSegment: string
  requestMessage: string
  requestRunning: boolean
  interactionMode: InteractionMode
  viewerMode: ViewerMode
  lastRequestMode: 'evaluate' | 'optimize' | 'fallback'
  setManifest: (manifest: NormalizedManifest) => void
  setLatestResponse: (response: NormalizedPoseResponse) => void
  setSampleResponse: (response: NormalizedPoseResponse) => void
  addSelection: (baseName: string) => void
  updateSelection: (
    id: string,
    updates: Partial<Pick<ActiveMuscleSelection, 'side' | 'severity'>>,
  ) => void
  removeSelection: (id: string) => void
  clearSelections: () => void
  setWarning: (warning: string | null) => void
  setDebugOpen: (debugOpen: boolean) => void
  setSelectedSegment: (segment: string) => void
  setInteractionMode: (mode: InteractionMode) => void
  setViewerMode: (mode: ViewerMode) => void
}

function nextSelectionId() {
  return `selection-${Math.random().toString(36).slice(2, 9)}`
}

export const useAppStore = create<AppState>((set) => ({
  manifest: null,
  latestResponse: null,
  sampleResponse: null,
  activeSelections: [],
  warning: null,
  debugOpen: false,
  selectedSegment: 'pelvis',
  requestMessage: 'Loading saved sample pose.',
  requestRunning: false,
  interactionMode: 'debounced',
  viewerMode: 'debug',
  lastRequestMode: 'fallback',
  setManifest: (manifest) => set({ manifest }),
  setLatestResponse: (latestResponse) =>
    set({
      latestResponse,
      requestMessage: latestResponse.status.message,
      requestRunning: latestResponse.status.running,
      lastRequestMode: latestResponse.status.mode,
    }),
  setSampleResponse: (sampleResponse) =>
    set((state) => ({
      sampleResponse,
      latestResponse: state.latestResponse ?? sampleResponse,
      requestMessage: state.latestResponse?.status.message ?? sampleResponse.status.message,
      requestRunning: state.latestResponse?.status.running ?? sampleResponse.status.running,
      lastRequestMode: state.latestResponse?.status.mode ?? sampleResponse.status.mode,
    })),
  addSelection: (baseName) =>
    set((state) => {
      if (state.activeSelections.some((selection) => selection.baseName === baseName)) {
        return state
      }
      return {
        activeSelections: [
          ...state.activeSelections,
          {
            id: nextSelectionId(),
            baseName,
            side: 'bilateral' satisfies SideOption,
            severity: 0.45,
            maxShorteningFraction: 0.2,
          },
        ],
      }
    }),
  updateSelection: (id, updates) =>
    set((state) => ({
      activeSelections: state.activeSelections.map((selection) =>
        selection.id === id ? { ...selection, ...updates } : selection,
      ),
    })),
  removeSelection: (id) =>
    set((state) => ({
      activeSelections: state.activeSelections.filter((selection) => selection.id !== id),
    })),
  clearSelections: () => set({ activeSelections: [] }),
  setWarning: (warning) => set({ warning }),
  setDebugOpen: (debugOpen) => set({ debugOpen }),
  setSelectedSegment: (selectedSegment) => set({ selectedSegment }),
  setInteractionMode: (interactionMode) => set({ interactionMode }),
  setViewerMode: (viewerMode) => set({ viewerMode }),
}))
