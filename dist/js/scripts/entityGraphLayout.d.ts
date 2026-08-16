/**
 * Computes map coordinates for the entity graph.
 *
 * The layout is deliberately *not* a force simulation. A force layout arranges schemas by
 * how densely they reference one another, which reproduces the directory tree and teaches a
 * reader nothing they could not get from `ls -R`. This places schemas by architectural
 * layer instead: the primitives everything is built from sit at the centre, the root
 * entities form a ring around them, and the category/directory catalogues sit on the rim.
 * Reading outward from the middle is reading the build-up the concept docs describe.
 *
 * Being a pure function of the graph, it is also deterministic: unchanged schemas keep their
 * coordinates from one release to the next, so the map is worth building spatial memory of.
 */
import type { EntityGraphNode } from "./buildEntityGraph";
/**
 * Assigns `x`/`y` to every node in place and returns the same array.
 *
 * Nodes are grouped into bands by layer, then ordered within a band by domain so that
 * schemas from the same corner of the corpus land next to one another on the ring.
 */
export declare function computeEntityGraphLayout(nodes: EntityGraphNode[]): EntityGraphNode[];
