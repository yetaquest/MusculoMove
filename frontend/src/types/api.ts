export type SideOption = 'left' | 'right' | 'bilateral'

export type SegmentTransform = {
  translation_m: [number, number, number]
  rotation_matrix_3x3: [
    [number, number, number],
    [number, number, number],
    [number, number, number],
  ]
}

export type ApiStatus = {
  mode: 'evaluate' | 'optimize' | 'fallback'
  message: string
  running: boolean
  phase: string
}

export type MuscleCatalogEntry = {
  baseName: string
  label: string
  groups: string[]
  sides: {
    left: string | null
    right: string | null
  }
}

export type NormalizedManifest = {
  bodies: string[]
  lowerBodyGroups: Record<string, string[]>
  lowerBodyMuscles: string[]
  muscleCatalog: MuscleCatalogEntry[]
}

export type NormalizedPoseResponse = {
  source: 'backend' | 'sample'
  segmentTransforms: Record<string, SegmentTransform>
  poseRad: Record<string, number>
  status: ApiStatus
  objectiveTotal: number | null
  raw: unknown
}

export type ActiveMuscleSelection = {
  id: string
  baseName: string
  side: SideOption
  severity: number
  maxShorteningFraction: number
}

export type EvaluateRequest = {
  pose?: Record<string, number>
  tightness: Array<{
    targets: string[]
    severity: number
    max_shortening_fraction: number
  }>
  selected_groups: string[]
  include_upper_body_debug_metrics?: boolean
}

export type OptimizeRequest = {
  tightness: Array<{
    targets: string[]
    severity: number
    max_shortening_fraction: number
  }>
  selected_groups: string[]
  seed_pose?: Record<string, number>
  include_upper_body_debug_metrics?: boolean
  max_iterations?: number
  initial_step_rad?: number
  tolerance_rad?: number
}
