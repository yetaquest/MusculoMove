import { useEffect, useMemo, useRef, useState } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { ContactShadows, Html, OrbitControls } from '@react-three/drei'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { Matrix4, Object3D, Quaternion, Vector3 } from 'three'
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib'
import type { NormalizedPoseResponse, ViewerConfig } from '../../types/api'
import type { AppliedSegmentInfo, CameraPreset, ViewerMode } from '../../types/viewer'
import { blendPose, smoothingAlpha } from '../../lib/interpolation'
import { quaternionTuple, segmentTransformToMatrix4, segmentTransformToPose } from '../../lib/transformAdapter'
import { Button } from '../ui/button'
import { Card } from '../ui/card'

type ModelViewportProps = {
  response: NormalizedPoseResponse | null
  viewer: ViewerConfig | null
  selectedSegment: string
  setSelectedSegment: (segment: string) => void
  onViewerModeChange: (mode: ViewerMode) => void
  onAppliedSegmentsChange: (segments: Record<string, AppliedSegmentInfo>) => void
  onWarning: (warning: string | null) => void
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

function resolveViewerAssetUrl(assetUrl: string) {
  const apiRoot = import.meta.env.VITE_API_ROOT ?? '/api'
  if (assetUrl.startsWith('http://') || assetUrl.startsWith('https://')) {
    return assetUrl
  }
  if (assetUrl.startsWith('/api') && apiRoot !== '/api') {
    return `${apiRoot}${assetUrl.slice('/api'.length)}`
  }
  return assetUrl
}

export function ModelViewport({
  response,
  viewer,
  selectedSegment,
  setSelectedSegment,
  onViewerModeChange,
  onAppliedSegmentsChange,
  onWarning,
}: ModelViewportProps) {
  const [cameraPreset, setCameraPreset] = useState<CameraPreset>('three-quarter')
  const [failedAssetUrl, setFailedAssetUrl] = useState<string | null>(null)
  const currentAssetUrl = viewer?.assetUrl ?? null
  const opensimViewerAvailable = Boolean(viewer?.runtime.available && failedAssetUrl !== currentAssetUrl)

  useEffect(() => {
    onViewerModeChange(opensimViewerAvailable ? 'opensim' : 'debug')
  }, [onViewerModeChange, opensimViewerAvailable])

  return (
    <Card className="viewer-panel relative overflow-hidden p-0">
      <div className="relative h-[540px] w-full sm:h-[620px] xl:h-[calc(100svh-13rem)] xl:min-h-[720px] xl:max-h-[940px]">
        <div className="absolute inset-x-4 top-4 z-20 flex flex-wrap items-start justify-between gap-3">
          <div className="rounded-[22px] border border-[var(--border)] bg-white/86 p-2 shadow-[0_12px_28px_rgba(31,36,31,0.08)] backdrop-blur">
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
          </div>
          <div className="rounded-full border border-[var(--border)] bg-white/86 px-3 py-2 text-xs font-semibold uppercase tracking-[0.16em] text-[var(--muted)] shadow-[0_12px_28px_rgba(31,36,31,0.08)] backdrop-blur">
            {opensimViewerAvailable ? 'OpenSim GLTF' : 'Debug geometry'}
          </div>
        </div>

        <Canvas camera={{ position: [2.6, 1.7, 2.6], fov: 34 }} shadows className="size-full">
          <color attach="background" args={['#f7f1e6']} />
          <fog attach="fog" args={['#f7f1e6', 5, 12]} />
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
          {opensimViewerAvailable && viewer ? (
            <OpenSimBody
              response={response}
              viewer={viewer}
              onAppliedSegmentsChange={onAppliedSegmentsChange}
              onLoadError={(message) => {
                setFailedAssetUrl(viewer.assetUrl)
                onWarning(message)
              }}
              onReady={() => {
                setFailedAssetUrl(null)
                onWarning(null)
              }}
            />
          ) : (
            <DebugBody
              response={response}
              selectedSegment={selectedSegment}
              setSelectedSegment={setSelectedSegment}
              onAppliedSegmentsChange={onAppliedSegmentsChange}
            />
          )}
          <ContactShadows position={[0, 0.001, 0]} opacity={0.35} scale={8} blur={2.5} far={3.2} />
        </Canvas>

        <div className="pointer-events-none absolute inset-x-4 bottom-4 z-20 flex justify-end">
          <div className="rounded-full border border-[var(--border)] bg-white/80 px-3 py-2 text-xs text-[var(--muted)] shadow-[0_12px_28px_rgba(31,36,31,0.08)] backdrop-blur">
            Drag to orbit. Scroll to zoom.
          </div>
        </div>
      </div>
    </Card>
  )
}

function CameraController({ preset }: { preset: CameraPreset }) {
  const controlsRef = useRef<OrbitControlsImpl | null>(null)
  const { camera } = useThree()

  useEffect(() => {
    const target = new Vector3(0, 1.02, 0)
    const positions: Record<CameraPreset, [number, number, number]> = {
      front: [3.25, 1.45, 0],
      side: [0, 1.35, 3.1],
      'three-quarter': [2.6, 1.7, 2.6],
    }
    const nextPosition = positions[preset]
    camera.position.set(...nextPosition)
    controlsRef.current?.target.copy(target)
    controlsRef.current?.update()
  }, [camera, preset])

  return <OrbitControls ref={controlsRef} enablePan={false} enableZoom enableRotate />
}

function Ground() {
  return (
    <mesh receiveShadow rotation-x={-Math.PI / 2} position={[0, -0.01, 0]}>
      <circleGeometry args={[4.5, 48]} />
      <meshStandardMaterial color="#efe5d5" />
    </mesh>
  )
}

function OpenSimBody({
  response,
  viewer,
  onAppliedSegmentsChange,
  onLoadError,
  onReady,
}: {
  response: NormalizedPoseResponse | null
  viewer: ViewerConfig
  onAppliedSegmentsChange: (segments: Record<string, AppliedSegmentInfo>) => void
  onLoadError: (message: string) => void
  onReady: () => void
}) {
  const [scene, setScene] = useState<Object3D | null>(null)
  const nodesRef = useRef<Record<string, Object3D>>({})
  const tempPosition = useRef(new Vector3())
  const tempQuaternion = useRef(new Quaternion())
  const tempScale = useRef(new Vector3())
  const tempLocalMatrix = useRef(new Matrix4())
  const assetUrl = useMemo(() => resolveViewerAssetUrl(viewer.assetUrl), [viewer.assetUrl])

  useEffect(() => {
    let cancelled = false
    const loader = new GLTFLoader()
    loader.load(
      assetUrl,
      (gltf) => {
        if (cancelled) {
          return
        }
        const nextScene = gltf.scene.clone(true)
        const nodes: Record<string, Object3D> = {}
        nextScene.traverse((object: Object3D) => {
          if (object.name) {
            nodes[object.name] = object
          }
        })
        nodesRef.current = nodes
        setScene(nextScene)
        onReady()
      },
      undefined,
      (error) => {
        if (cancelled) {
          return
        }
        const message =
          error instanceof Error
            ? `OpenSim GLTF load failed: ${error.message}`
            : 'OpenSim GLTF load failed. Falling back to debug geometry.'
        onLoadError(message)
      },
    )

    return () => {
      cancelled = true
    }
  }, [assetUrl, onLoadError, onReady])

  useEffect(() => {
    if (!response) {
      return
    }
    const appliedSegments: Record<string, AppliedSegmentInfo> = {}
    Object.entries(response.segmentTransforms).forEach(([segmentName, transform]) => {
      const nodeName = viewer.bodyNodes[segmentName] ?? null
      appliedSegments[segmentName] = {
        segmentName,
        nodeName,
        applied: Boolean(nodeName && nodesRef.current[nodeName]),
        quaternion: quaternionTuple(segmentTransformToPose(transform).quaternion),
      }
    })
    onAppliedSegmentsChange(appliedSegments)
  }, [onAppliedSegmentsChange, response, scene, viewer.bodyNodes])

  useFrame((_, delta) => {
    if (!response || !scene) {
      return
    }
    const alpha = smoothingAlpha(delta)
    scene.updateMatrixWorld(true)
    Object.entries(response.segmentTransforms).forEach(([segmentName, transform]) => {
      const nodeName = viewer.bodyNodes[segmentName]
      if (!nodeName) {
        return
      }
      const node = nodesRef.current[nodeName]
      if (!node) {
        return
      }
      const parentMatrix = node.parent?.matrixWorld ?? new Matrix4()
      tempLocalMatrix.current.copy(parentMatrix).invert().multiply(segmentTransformToMatrix4(transform))
      tempLocalMatrix.current.decompose(
        tempPosition.current,
        tempQuaternion.current,
        tempScale.current,
      )
      blendPose(
        node.position,
        node.quaternion,
        tempPosition.current,
        tempQuaternion.current,
        alpha,
      )
      node.updateMatrix()
      node.updateMatrixWorld(true)
    })
  })

  if (!scene) {
    return <Html center>Loading OpenSim model…</Html>
  }

  return <primitive object={scene} position={[0, 0, 0]} />
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
        nodeName: null,
        applied: true,
        quaternion: quaternionTuple(segmentTransformToPose(transform).quaternion),
      }
    })
    onAppliedSegmentsChange(appliedSegments)
  }, [onAppliedSegmentsChange, response])

  if (!response) {
    return <Html center>No pose loaded yet.</Html>
  }

  return (
    <group>
      {Object.entries(response.segmentTransforms).map(([segmentName, transform]) => {
        const pose = segmentTransformToPose(transform)
        const dimensions = debugSegmentSizes[segmentName] ?? [0.08, 0.08, 0.08]
        const isSelected = selectedSegment === segmentName
        return (
          <mesh
            key={segmentName}
            position={pose.position}
            quaternion={pose.quaternion}
            castShadow
            receiveShadow
            onClick={() => setSelectedSegment(segmentName)}
          >
            <boxGeometry args={dimensions} />
            <meshStandardMaterial
              color={isSelected ? '#d96d34' : '#d7c0a3'}
              metalness={0.12}
              roughness={0.55}
            />
          </mesh>
        )
      })}
    </group>
  )
}
