import { Suspense, useEffect, useRef, useState } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { ContactShadows, Html, OrbitControls, useGLTF } from '@react-three/drei'
import { Matrix4, Object3D, Quaternion, Vector3 } from 'three'
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib'
import * as SkeletonUtils from 'three/examples/jsm/utils/SkeletonUtils.js'
import type { NormalizedPoseResponse } from '../../types/api'
import type { AppliedSegmentInfo, CameraPreset, ViewerMode } from '../../types/viewer'
import { segmentBoneMap } from '../../lib/segmentMap'
import { inspectBoneHierarchy } from '../../lib/boneInspector'
import { blendPose, smoothingAlpha } from '../../lib/interpolation'
import { quaternionTuple, segmentTransformToMatrix4, segmentTransformToPose } from '../../lib/transformAdapter'
import { Button } from '../ui/button'
import { Card } from '../ui/card'

type ModelViewportProps = {
  response: NormalizedPoseResponse | null
  selectedSegment: string
  setSelectedSegment: (segment: string) => void
  avatarAvailable: boolean
  onViewerModeChange: (mode: ViewerMode) => void
  onAppliedSegmentsChange: (segments: Record<string, AppliedSegmentInfo>) => void
}

const debugSegmentSizes: Record<string, [number, number, number]> = {
  pelvis: [0.22, 0.16, 0.28],
  torso: [0.24, 0.44, 0.2],
  femur_r: [0.12, 0.36, 0.12],
  femur_l: [0.12, 0.36, 0.12],
  tibia_r: [0.1, 0.34, 0.1],
  tibia_l: [0.1, 0.34, 0.1],
  calcn_r: [0.24, 0.08, 0.1],
  calcn_l: [0.24, 0.08, 0.1],
  toes_r: [0.16, 0.04, 0.08],
  toes_l: [0.16, 0.04, 0.08],
  humerus_r: [0.08, 0.24, 0.08],
  humerus_l: [0.08, 0.24, 0.08],
  ulna_r: [0.08, 0.2, 0.08],
  ulna_l: [0.08, 0.2, 0.08],
  hand_r: [0.1, 0.06, 0.08],
  hand_l: [0.1, 0.06, 0.08],
}

export function ModelViewport({
  response,
  selectedSegment,
  setSelectedSegment,
  avatarAvailable,
  onViewerModeChange,
  onAppliedSegmentsChange,
}: ModelViewportProps) {
  const [cameraPreset, setCameraPreset] = useState<CameraPreset>('three-quarter')

  useEffect(() => {
    onViewerModeChange(avatarAvailable ? 'avatar' : 'debug')
  }, [avatarAvailable, onViewerModeChange])

  return (
    <Card className="viewer-panel relative min-h-[560px] overflow-hidden p-3 lg:min-h-[720px]">
      <div className="absolute inset-x-5 top-5 z-20 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          <Button
            variant={cameraPreset === 'front' ? 'primary' : 'secondary'}
            size="sm"
            onClick={() => setCameraPreset('front')}
          >
            Front
          </Button>
          <Button
            variant={cameraPreset === 'side' ? 'primary' : 'secondary'}
            size="sm"
            onClick={() => setCameraPreset('side')}
          >
            Side
          </Button>
          <Button
            variant={cameraPreset === 'three-quarter' ? 'primary' : 'secondary'}
            size="sm"
            onClick={() => setCameraPreset('three-quarter')}
          >
            3/4
          </Button>
        </div>
        <div className="rounded-full border border-[var(--border)] bg-white/80 px-3 py-2 text-xs font-semibold uppercase tracking-[0.16em] text-[var(--muted)]">
          {avatarAvailable ? 'Avatar GLB' : 'Debug geometry'}
        </div>
      </div>

      <Canvas camera={{ position: [2.6, 1.7, 2.6], fov: 34 }} shadows>
        <color attach="background" args={['#f8f4ec']} />
        <fog attach="fog" args={['#f8f4ec', 5, 12]} />
        <ambientLight intensity={0.9} />
        <directionalLight
          position={[5, 7, 4]}
          intensity={1.35}
          castShadow
          shadow-mapSize-width={2048}
          shadow-mapSize-height={2048}
        />
        <directionalLight position={[-3, 3, -4]} intensity={0.42} color="#b6d6d4" />
        <Ground />
        <CameraController preset={cameraPreset} />
        <Suspense fallback={<Html center>Loading viewer…</Html>}>
          {avatarAvailable ? (
            <AvatarBody
              response={response}
              onAppliedSegmentsChange={onAppliedSegmentsChange}
            />
          ) : (
            <DebugBody
              response={response}
              selectedSegment={selectedSegment}
              setSelectedSegment={setSelectedSegment}
              onAppliedSegmentsChange={onAppliedSegmentsChange}
            />
          )}
        </Suspense>
        <ContactShadows position={[0, 0.001, 0]} opacity={0.35} scale={8} blur={2.5} far={3.2} />
      </Canvas>
    </Card>
  )
}

function CameraController({ preset }: { preset: CameraPreset }) {
  const controlsRef = useRef<OrbitControlsImpl | null>(null)
  const { camera } = useThree()

  useEffect(() => {
    const target = new Vector3(0, 1.02, 0)
    const positions: Record<CameraPreset, [number, number, number]> = {
      front: [0, 1.45, 3.25],
      side: [3.1, 1.35, 0],
      'three-quarter': [2.6, 1.7, 2.6],
    }
    const nextPosition = positions[preset]
    camera.position.set(...nextPosition)
    controlsRef.current?.target.copy(target)
    controlsRef.current?.update()
  }, [camera, preset])

  return <OrbitControls ref={controlsRef} enablePan enableZoom enableRotate />
}

function Ground() {
  return (
    <mesh receiveShadow rotation-x={-Math.PI / 2} position={[0, -0.01, 0]}>
      <circleGeometry args={[4.5, 48]} />
      <meshStandardMaterial color="#efe5d5" />
    </mesh>
  )
}

function AvatarBody({
  response,
  onAppliedSegmentsChange,
}: {
  response: NormalizedPoseResponse | null
  onAppliedSegmentsChange: (segments: Record<string, AppliedSegmentInfo>) => void
}) {
  const gltf = useGLTF('/models/avatar.glb')
  const [avatar] = useState(() => SkeletonUtils.clone(gltf.scene))
  const bonesRef = useRef<Record<string, Object3D>>({})
  const inspectedRef = useRef(false)
  const tempPosition = useRef(new Vector3())
  const tempQuaternion = useRef(new Quaternion())
  const tempScale = useRef(new Vector3())
  const tempLocalMatrix = useRef(new Matrix4())

  useEffect(() => {
    const bones: Record<string, Object3D> = {}
    avatar.traverse((object: Object3D) => {
      if ((object as Object3D & { isBone?: boolean }).isBone) {
        bones[object.name] = object
      }
    })
    bonesRef.current = bones
    if (!inspectedRef.current) {
      inspectBoneHierarchy(avatar)
      inspectedRef.current = true
    }
  }, [avatar])

  useEffect(() => {
    if (!response) {
      return
    }
    const appliedSegments: Record<string, AppliedSegmentInfo> = {}
    Object.entries(response.segmentTransforms).forEach(([segmentName, transform]) => {
      const boneName = segmentBoneMap[segmentName] ?? null
      const quaternion = quaternionTuple(segmentTransformToPose(transform).quaternion)
      appliedSegments[segmentName] = {
        segmentName,
        boneName,
        applied: Boolean(boneName && bonesRef.current[boneName]),
        quaternion,
      }
    })
    onAppliedSegmentsChange(appliedSegments)
  }, [onAppliedSegmentsChange, response])

  useFrame((_, delta) => {
    if (!response) {
      return
    }
    const alpha = smoothingAlpha(delta)
    avatar.updateMatrixWorld(true)
    Object.entries(response.segmentTransforms).forEach(([segmentName, transform]) => {
      const boneName = segmentBoneMap[segmentName]
      if (!boneName) {
        return
      }
      const bone = bonesRef.current[boneName]
      if (!bone) {
        return
      }
      const parentMatrix = bone.parent?.matrixWorld ?? new Matrix4()
      tempLocalMatrix.current.copy(parentMatrix).invert().multiply(segmentTransformToMatrix4(transform))
      tempLocalMatrix.current.decompose(
        tempPosition.current,
        tempQuaternion.current,
        tempScale.current,
      )
      blendPose(
        bone.position,
        bone.quaternion,
        tempPosition.current,
        tempQuaternion.current,
        alpha,
      )
      bone.updateMatrix()
      bone.updateMatrixWorld(true)
    })
  })

  return <primitive object={avatar} position={[0, 0, 0]} />
}

function DebugBody({
  response,
  selectedSegment,
  setSelectedSegment,
  onAppliedSegmentsChange,
}: {
  response: NormalizedPoseResponse | null
  selectedSegment: string
  setSelectedSegment: (segment: string) => void
  onAppliedSegmentsChange: (segments: Record<string, AppliedSegmentInfo>) => void
}) {
  useEffect(() => {
    if (!response) {
      return
    }
    const appliedSegments: Record<string, AppliedSegmentInfo> = {}
    Object.entries(response.segmentTransforms).forEach(([segmentName, transform]) => {
      appliedSegments[segmentName] = {
        segmentName,
        boneName: segmentBoneMap[segmentName] ?? null,
        applied: true,
        quaternion: quaternionTuple(segmentTransformToPose(transform).quaternion),
      }
    })
    onAppliedSegmentsChange(appliedSegments)
  }, [onAppliedSegmentsChange, response])

  return (
    <group>
      {Object.entries(response?.segmentTransforms ?? {}).map(([segmentName, transform]) => (
        <DebugSegment
          key={segmentName}
          segmentName={segmentName}
          transform={transform}
          selected={selectedSegment === segmentName}
          onSelect={() => setSelectedSegment(segmentName)}
        />
      ))}
    </group>
  )
}

function DebugSegment({
  segmentName,
  transform,
  selected,
  onSelect,
}: {
  segmentName: string
  transform: NonNullable<NormalizedPoseResponse['segmentTransforms'][string]>
  selected: boolean
  onSelect: () => void
}) {
  const meshRef = useRef<Object3D | null>(null)
  const target = useRef(segmentTransformToPose(transform))

  useEffect(() => {
    target.current = segmentTransformToPose(transform)
  }, [transform])

  useFrame((_, delta) => {
    if (!meshRef.current) {
      return
    }
    const alpha = smoothingAlpha(delta)
    blendPose(
      meshRef.current.position,
      meshRef.current.quaternion,
      target.current.position,
      target.current.quaternion,
      alpha,
    )
  })

  return (
    <mesh ref={meshRef} castShadow receiveShadow onClick={onSelect}>
      <boxGeometry args={debugSegmentSizes[segmentName] ?? [0.14, 0.14, 0.14]} />
      <meshStandardMaterial
        color={selected ? '#1f7a74' : '#d69a61'}
        emissive={selected ? '#1f7a74' : '#000000'}
        emissiveIntensity={selected ? 0.16 : 0}
      />
    </mesh>
  )
}
