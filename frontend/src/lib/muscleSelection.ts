import type {
  ActiveMuscleSelection,
  EvaluateRequest,
  MuscleCatalogEntry,
  OptimizeRequest,
} from '../types/api'

function groupsForSide(groups: string[], side: ActiveMuscleSelection['side']) {
  if (side === 'bilateral') {
    return groups
  }
  const suffix = side === 'left' ? '_l' : '_r'
  return groups.filter((group) => group.endsWith(suffix))
}

function targetsForSide(entry: MuscleCatalogEntry, side: ActiveMuscleSelection['side']) {
  if (side === 'bilateral') {
    return [entry.sides.left, entry.sides.right].filter(Boolean) as string[]
  }
  if (side === 'left' && entry.sides.left) {
    return [entry.sides.left]
  }
  if (side === 'right' && entry.sides.right) {
    return [entry.sides.right]
  }
  return []
}

export function selectionsToRequests(
  selections: ActiveMuscleSelection[],
  catalog: MuscleCatalogEntry[],
): {
  evaluate: EvaluateRequest
  optimize: OptimizeRequest
} {
  const catalogMap = new Map(catalog.map((entry) => [entry.baseName, entry]))
  const selectedGroups = new Set<string>()
  const tightness = selections
    .map((selection) => {
      const entry = catalogMap.get(selection.baseName)
      if (!entry) {
        return null
      }
      groupsForSide(entry.groups, selection.side).forEach((group) => selectedGroups.add(group))
      const targets = targetsForSide(entry, selection.side)
      if (targets.length === 0) {
        return null
      }
      return {
        targets,
        severity: selection.severity,
        max_shortening_fraction: selection.maxShorteningFraction,
      }
    })
    .filter(Boolean) as EvaluateRequest['tightness']

  return {
    evaluate: {
      tightness,
      selected_groups: Array.from(selectedGroups),
      include_upper_body_debug_metrics: false,
    },
    optimize: {
      tightness,
      selected_groups: Array.from(selectedGroups),
      include_upper_body_debug_metrics: false,
      max_iterations: 8,
      initial_step_rad: 0.08726646259971647,
      tolerance_rad: 0.008726646259971648,
    },
  }
}
