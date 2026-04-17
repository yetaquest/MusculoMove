import { Matrix4, Quaternion, Vector3 } from 'three'
import type { SegmentTransform } from '../types/api'

export function segmentTransformToMatrix4(transform: SegmentTransform) {
  const matrix = new Matrix4()
  const rotation = transform.rotation_matrix_3x3
  const [x, y, z] = transform.translation_m
  matrix.set(
    rotation[0][0],
    rotation[0][1],
    rotation[0][2],
    x,
    rotation[1][0],
    rotation[1][1],
    rotation[1][2],
    y,
    rotation[2][0],
    rotation[2][1],
    rotation[2][2],
    z,
    0,
    0,
    0,
    1,
  )
  return matrix
}

export function segmentTransformToPose(transform: SegmentTransform) {
  const position = new Vector3()
  const quaternion = new Quaternion()
  const scale = new Vector3()
  segmentTransformToMatrix4(transform).decompose(position, quaternion, scale)
  return { position, quaternion }
}

export function quaternionTuple(quaternion: Quaternion): [number, number, number, number] {
  return [quaternion.x, quaternion.y, quaternion.z, quaternion.w]
}
