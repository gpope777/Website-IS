import { MOUNTAINS, HALF } from './terrain';

/**
 * Las Tierras Corruptas (spec S5 §3): the rules that are not terrain. The rim line is the old muro de niebla (S4-G):
 * nobody crosses it northward except flying. After the ending, la Grieta (S5-G) opens a gap for walkers.
 */
export const RIM_LINE = -HALF - MOUNTAINS.rimFrom;

/** A ground (or land-mount, swimming, gliding) move crossing the rim line northward. Flying never asks. */
export function rimCrossBlocked(pz: number, nz: number): boolean {
  return pz >= RIM_LINE && nz < RIM_LINE;
}
