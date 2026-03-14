const createBase = (type, width, height, metadata = {}) => ({
  type,
  width,
  height,
  rotation: 0,
  metadata,
})

export const TABLE_OBJECT_TYPES = ['square_table', 'round_table', 'large_table']

const TABLE_DEFAULT_SEATS = {
  square_table: 4,
  round_table: 4,
  large_table: 8,
}

export const isTableObjectType = (type) => TABLE_OBJECT_TYPES.includes(type)

export const getDefaultSeatsForType = (type) => TABLE_DEFAULT_SEATS[type] ?? 4

export const OBJECT_LIBRARY = [
  {
    id: 'square_table',
    label: 'Square Table',
    config: createBase('square_table', 80, 80, { seats: 4, label: 'T-01' }),
  },
  {
    id: 'round_table',
    label: 'Round Table',
    config: createBase('round_table', 80, 80, { seats: 4, label: 'RT-01' }),
  },
  {
    id: 'large_table',
    label: 'Large Table',
    config: createBase('large_table', 140, 80, { seats: 8, label: 'LT-01' }),
  },
  {
    id: 'bar_desk',
    label: 'Bar Desk',
    config: createBase('bar_desk', 200, 70, { label: 'Bar' }),
  },
  {
    id: 'door',
    label: 'Door',
    config: createBase('door', 80, 20, { label: 'Door' }),
  },
  {
    id: 'stairs',
    label: 'Stairs',
    config: createBase('stairs', 100, 80, { label: 'Stairs' }),
  },
  {
    id: 'wall_segment',
    label: 'Wall Segment',
    config: createBase('wall_segment', 180, 20, { label: 'Wall' }),
  },
  {
    id: 'kitchen_block',
    label: 'Kitchen Block',
    config: createBase('kitchen_block', 180, 140, { label: 'Kitchen' }),
  },
  {
    id: 'toilet_icon',
    label: 'Toilet',
    config: createBase('toilet_icon', 80, 80, { label: 'WC' }),
  },
  {
    id: 'custom_rectangle',
    label: 'Custom Rectangle',
    config: createBase('custom_rectangle', 120, 80, { label: 'Custom' }),
  },
]

export const getObjectPreset = (presetId) => {
  return OBJECT_LIBRARY.find((item) => item.id === presetId)
}
