import type { Object3D } from 'three'

type BoneRow = {
  name: string
  depth: number
  parent: string | null
}

export function inspectBoneHierarchy(root: Object3D) {
  const rows: BoneRow[] = []

  function visit(node: Object3D, depth: number) {
    if ((node as Object3D & { isBone?: boolean }).isBone) {
      rows.push({
        name: node.name,
        depth,
        parent: node.parent?.name ?? null,
      })
    }
    node.children.forEach((child) => visit(child, depth + 1))
  }

  visit(root, 0)
  if (rows.length > 0) {
    console.groupCollapsed('MusculoMove avatar bone hierarchy')
    rows.forEach((row) => {
      console.log(`${' '.repeat(row.depth * 2)}${row.name}`, row.parent ? `← ${row.parent}` : '')
    })
    console.groupEnd()
  }
  return rows
}
