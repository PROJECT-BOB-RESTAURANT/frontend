import { GRID_SIZE } from '../../utils/grid'

export const MIN_ZOOM = 0.4
export const MAX_ZOOM = 2.5
export const MIN_SIZE = GRID_SIZE
export const MIN_SCALE = 0.4
export const MAX_SCALE = 5

export const WEEK_DAYS = [
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
  'Sunday',
]

export const DEFAULT_CANVAS_ZOOM = 1
export const DEFAULT_CANVAS_POSITION = { x: 160, y: 90 }

export const createId = (prefix) => `${prefix}_${crypto.randomUUID().slice(0, 8)}`
