import { useEffect, useMemo, useRef, useState } from 'react'
import { Canvas, useThree } from '@react-three/fiber'
import { Html, OrbitControls } from '@react-three/drei'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { Matrix4, Object3D, Quaternion, Vector3 } from 'three'
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib'
import type { NormalizedPoseResponse, ViewerConfig } from '../../types/api'
import type { AppliedSegmentInfo, CameraPreset, ViewerMode } from '../../types/viewer'
import {
  applySegmentTransformToMatrix4,
  applySegmentTransformToPose,
  quaternionTuple,
  segmentTransformToPose,
} from '../../lib/transformAdapter'
import { Button } from '../ui/button'
import { Card } from '../ui/card'

type ModelViewportProps = {
  response: NormalizedPoseResponse | null
  viewer: ViewerConfig | null
  diagnosticMode: 'none' | 'frontend-limb-test'
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

const cameraTarget = new Vector3(0, 1.02, 0)
const identityMatrix = new Matrix4()
const cameraPositions: Record<CameraPreset, [number, number, number]> = {
  front: [3.25, 1.45, 0],
  side: [0, 1.35, 3.1],
  'three-quarter': [2.6, 1.7, 2.6],
}

function canonicalizeViewerNodeName(name: string) {
  return name.replace(/[^A-Za-z0-9_]/g, '')
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
  diagnosticMode,
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

        <Canvas camera={{ position: [2.6, 1.7, 2.6], fov: 34 }} frameloop="demand" className="size-full">
          <color attach="background" args={['#f7f1e6']} />
          <fog attach="fog" args={['#f7f1e6', 5, 12]} />
          <ambientLight intensity={0.9} />
          <directionalLight
            position={[5, 7, 4]}
            intensity={1.35}
            shadow-mapSize-width={2048}
            shadow-mapSize-height={2048}
          />
          <directionalLight position={[-3, 3, -4]} intensity={0.42} color="#b6d6d4" />
          <Ground />
          <CameraController preset={cameraPreset} />
          {opensimViewerAvailable && viewer ? (
            <OpenSimBody
              key={viewer.assetUrl}
              response={response}
              diagnosticMode={diagnosticMode}
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
    const nextPosition = cameraPositions[preset]
    camera.position.set(...nextPosition)
    controlsRef.current?.target.copy(cameraTarget)
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
  diagnosticMode,
  viewer,
  onAppliedSegmentsChange,
  onLoadError,
  onReady,
}: {
  response: NormalizedPoseResponse | null
  diagnosticMode: 'none' | 'frontend-limb-test'
  viewer: ViewerConfig
  onAppliedSegmentsChange: (segments: Record<string, AppliedSegmentInfo>) => void
  onLoadError: (message: string) => void
  onReady: () => void
}) {
  const [scene, setScene] = useState<Object3D | null>(null)
  const nodesRef = useRef<Record<string, Object3D>>({})
  const scratchPosition = useRef(new Vector3())
  const scratchQuaternion = useRef(new Quaternion())
  const scratchScale = useRef(new Vector3())
  const scratchWorldMatrix = useRef(new Matrix4())
  const scratchLocalMatrix = useRef(new Matrix4())
  const scratchParentMatrix = useRef(new Matrix4())
  const diagnosticOriginalsRef = useRef<
    Record<string, { position: Vector3; quaternion: Quaternion; scale: Vector3 }>
  >({})
  const invalidate = useThree((state) => state.invalidate)
  const assetUrl = useMemo(() => resolveViewerAssetUrl(viewer.assetUrl), [viewer.assetUrl])

  useEffect(() => {
    let cancelled = false
    let loadedScene: Object3D | null = null
    const loader = new GLTFLoader()
    nodesRef.current = {}
    loader.load(
      assetUrl,
      (gltf) => {
        if (cancelled) {
          return
        }
        const nextScene = gltf.scene.clone(true)
        loadedScene = nextScene
        const nodes: Record<string, Object3D> = {}
        nextScene.traverse((object: Object3D) => {
          if (object.name) {
            nodes[object.name] = object
            nodes[canonicalizeViewerNodeName(object.name)] = object
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
      nodesRef.current = {}
      if (loadedScene) {
        disposeSceneGraph(loadedScene)
      }
    }
  }, [assetUrl, onLoadError, onReady])

  useEffect(() => {
    if (!response || !scene) {
      return
    }

    const appliedSegments: Record<string, AppliedSegmentInfo> = {}
    scene.updateMatrixWorld(true)
    Object.entries(response.segmentTransforms).forEach(([segmentName, transform]) => {
      const nodeName = viewer.bodyNodes[segmentName] ?? null
      const node = nodeName
        ? nodesRef.current[nodeName] ?? nodesRef.current[canonicalizeViewerNodeName(nodeName)]
        : null
      applySegmentTransformToPose(
        transform,
        scratchPosition.current,
        scratchQuaternion.current,
        scratchScale.current,
        scratchWorldMatrix.current,
      )
      appliedSegments[segmentName] = {
        segmentName,
        nodeName,
        applied: Boolean(node),
        quaternion: quaternionTuple(scratchQuaternion.current),
      }

      if (!node) {
        return
      }

      const parentWorldMatrix = node.parent?.matrixWorld ?? identityMatrix
      scratchParentMatrix.current.copy(parentWorldMatrix).invert()
      applySegmentTransformToMatrix4(transform, scratchLocalMatrix.current)
      scratchLocalMatrix.current.premultiply(scratchParentMatrix.current)
      scratchLocalMatrix.current.decompose(
        scratchPosition.current,
        scratchQuaternion.current,
        scratchScale.current,
      )
      node.position.copy(scratchPosition.current)
      node.quaternion.copy(scratchQuaternion.current)
      node.updateMatrix()
    })
    scene.updateMatrixWorld(true)
    onAppliedSegmentsChange(appliedSegments)
    invalidate()
  }, [invalidate, onAppliedSegmentsChange, response, scene, viewer.bodyNodes])

  useEffect(() => {
    if (!scene) {
      return
    }

    const diagnosticTargets = [
      {
        nodeName: 'Body:/bodyset/femur_r',
        translation: [0.24, 0.18, 0] as const,
        rotationAxis: [0, 0, 1] as const,
        rotationRad: 1.2,
      },
      {
        nodeName: 'Body:/bodyset/tibia_r',
        translation: [0.34, 0.08, 0] as const,
        rotationAxis: [0, 0, 1] as const,
        rotationRad: 1.35,
      },
      {
        nodeName: 'Body:/bodyset/calcn_r',
        translation: [0.36, -0.02, 0] as const,
        rotationAxis: [0, 0, 1] as const,
        rotationRad: 0.95,
      },
    ]

    if (diagnosticMode === 'frontend-limb-test') {
      diagnosticTargets.forEach(({ nodeName, translation, rotationAxis, rotationRad }) => {
        const node =
          nodesRef.current[nodeName] ?? nodesRef.current[canonicalizeViewerNodeName(nodeName)]
        if (!node) {
          return
        }
        if (!diagnosticOriginalsRef.current[nodeName]) {
          diagnosticOriginalsRef.current[nodeName] = {
            position: node.position.clone(),
            quaternion: node.quaternion.clone(),
            scale: node.scale.clone(),
          }
        }
        node.position.copy(diagnosticOriginalsRef.current[nodeName].position)
        node.quaternion.copy(diagnosticOriginalsRef.current[nodeName].quaternion)
        node.position.add(new Vector3(...translation))
        node.quaternion.multiply(
          new Quaternion().setFromAxisAngle(new Vector3(...rotationAxis), rotationRad),
        )
        node.updateMatrix()
      })
      scene.updateMatrixWorld(true)
      invalidate()
      return
    }

    const originalEntries = Object.entries(diagnosticOriginalsRef.current)
    if (originalEntries.length === 0) {
      return
    }
    originalEntries.forEach(([nodeName, original]) => {
      const node =
        nodesRef.current[nodeName] ?? nodesRef.current[canonicalizeViewerNodeName(nodeName)]
      if (!node) {
        return
      }
      node.position.copy(original.position)
      node.quaternion.copy(original.quaternion)
      node.scale.copy(original.scale)
      node.updateMatrix()
    })
    diagnosticOriginalsRef.current = {}
    scene.updateMatrixWorld(true)
    invalidate()
  }, [diagnosticMode, invalidate, response, scene])

  if (!scene) {
    return <Html center>Loading OpenSim model…</Html>
  }

  return <primitive object={scene} position={[0, 0, 0]} />
}

function disposeSceneGraph(root: Object3D) {
  root.traverse((object) => {
    const disposableObject = object as Object3D & {
      geometry?: { dispose?: () => void }
      material?: { dispose?: () => void } | Array<{ dispose?: () => void }>
    }
    disposableObject.geometry?.dispose?.()
    if (Array.isArray(disposableObject.material)) {
      disposableObject.material.forEach((material) => material.dispose?.())
      return
    }
    disposableObject.material?.dispose?.()
  })
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
