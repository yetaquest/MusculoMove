import { Quaternion, Vector3 } from 'three'

export function smoothingAlpha(delta: number, durationMs = 220) {
  const seconds = Math.max(durationMs / 1000, 0.001)
  return 1 - Math.exp(-delta / seconds)
}

export function blendPose(
  position: Vector3,
  quaternion: Quaternion,
  targetPosition: Vector3,
  targetQuaternion: Quaternion,
  alpha: number,
) {
  position.lerp(targetPosition, alpha)
  quaternion.slerp(targetQuaternion, alpha)
}
