export type CameraPreset = 'front' | 'side' | 'three-quarter'

export type ViewerMode = 'avatar' | 'debug'

export type AppliedSegmentInfo = {
  segmentName: string
  boneName: string | null
  applied: boolean
  quaternion: [number, number, number, number]
}
