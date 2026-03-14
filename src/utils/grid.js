export const GRID_SIZE = 20

export const snapToGrid = (value, size = GRID_SIZE) => {
  return Math.round(value / size) * size
}

export const clamp = (value, min, max) => {
  return Math.max(min, Math.min(max, value))
}

export const toWorldPoint = (clientX, clientY, canvasRect, pan, zoom) => {
  return {
    x: (clientX - canvasRect.left - pan.x) / zoom,
    y: (clientY - canvasRect.top - pan.y) / zoom,
  }
}

export const getAnchorOrigin = (anchor = 'top-left') => {
  const map = {
    'top-left': 'top left',
    'top-right': 'top right',
    'bottom-left': 'bottom left',
    'bottom-right': 'bottom right',
    center: 'center center',
  }

  return map[anchor] ?? map['top-left']
}
