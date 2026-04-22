import { Matrix4, Quaternion, Vector3 } from 'three'
import type { SegmentTransform } from '../types/api'

export function applySegmentTransformToMatrix4(transform: SegmentTransform, matrix: Matrix4) {
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

export function segmentTransformToMatrix4(transform: SegmentTransform) {
  const matrix = new Matrix4()
  return applySegmentTransformToMatrix4(transform, matrix)
}

export function applySegmentTransformToPose(
  transform: SegmentTransform,
  position: Vector3,
  quaternion: Quaternion,
  scale: Vector3,
  matrix: Matrix4,
) {
  applySegmentTransformToMatrix4(transform, matrix).decompose(position, quaternion, scale)
  return { position, quaternion, scale }
}

export function segmentTransformToPose(transform: SegmentTransform) {
  const position = new Vector3()
  const quaternion = new Quaternion()
  const scale = new Vector3()
  applySegmentTransformToPose(transform, position, quaternion, scale, new Matrix4())
  return { position, quaternion }
}

export function quaternionTuple(quaternion: Quaternion): [number, number, number, number] {
  return [quaternion.x, quaternion.y, quaternion.z, quaternion.w]
}
