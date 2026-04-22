import type {
  ApiStatus,
  MuscleCatalogEntry,
  NormalizedManifest,
  NormalizedPoseResponse,
  SegmentTransform,
} from '../types/api'

function asSegmentTransformMap(value: unknown) {
  return value as Record<string, SegmentTransform>
}

export function normalizeManifestResponse(raw: unknown): NormalizedManifest {
  const data = raw as {
    bodies: string[]
    lower_body_groups: Record<string, string[]>
    lower_body_muscles: string[]
    lower_body_muscle_catalog: Array<{
      base_name: string
      label: string
      groups: string[]
      sides: {
        left: string | null
        right: string | null
      }
    }>
    viewer: {
      asset_url: string
      model_path: string
      geometry_path: string
      body_nodes: Record<string, string>
      runtime: {
        available: boolean
        error?: string
      }
    }
  }

  const muscleCatalog: MuscleCatalogEntry[] = data.lower_body_muscle_catalog.map((entry) => ({
    baseName: entry.base_name,
    label: entry.label,
    groups: entry.groups,
    sides: entry.sides,
  }))

  return {
    bodies: data.bodies,
    lowerBodyGroups: data.lower_body_groups,
    lowerBodyMuscles: data.lower_body_muscles,
    muscleCatalog,
    viewer: {
      assetUrl: data.viewer.asset_url,
      modelPath: data.viewer.model_path,
      geometryPath: data.viewer.geometry_path,
      bodyNodes: data.viewer.body_nodes,
      runtime: data.viewer.runtime,
    },
  }
}

export function normalizePoseResponse(
  raw: unknown,
  source: NormalizedPoseResponse['source'],
): NormalizedPoseResponse {
  const data = raw as {
    pose_rad?: Record<string, number>
    segment_transforms?: Record<string, SegmentTransform>
    status?: Partial<ApiStatus>
    objective?: {
      total?: number
    }
  }

  return {
    source,
    segmentTransforms: asSegmentTransformMap(data.segment_transforms ?? {}),
    poseRad: data.pose_rad ?? {},
    objectiveTotal: data.objective?.total ?? null,
    status: {
      mode: data.status?.mode ?? (source === 'sample' ? 'fallback' : 'evaluate'),
      message:
        data.status?.message ??
        (source === 'sample' ? 'Saved sample pose loaded.' : 'Pose response received.'),
      running: data.status?.running ?? false,
      phase: data.status?.phase ?? (source === 'sample' ? 'fallback' : 'evaluate'),
    },
    raw,
  }
}
