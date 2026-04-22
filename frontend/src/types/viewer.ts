export type CameraPreset = 'front' | 'side' | 'three-quarter'

export type ViewerMode = 'opensim' | 'debug'

export type AppliedSegmentInfo = {
  segmentName: string
  nodeName: string | null
  applied: boolean
  quaternion: [number, number, number, number]
}
