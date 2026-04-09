const FRONTEND_ORDER_LINE_STATUSES = [
  'pending',
  'inProgress',
  'inPrep',
  'readyForServer',
  'served',
  'void',
]

const FRONTEND_TO_BACKEND_ORDER_LINE_STATUS = {
  pending: 'PENDING',
  inProgress: 'IN_PROGRESS',
  inPrep: 'IN_PREP',
  readyForServer: 'READY_FOR_SERVER',
  served: 'SERVED',
  void: 'VOID',
}

const BACKEND_TO_FRONTEND_ORDER_LINE_STATUS = {
  PENDING: 'pending',
  IN_PROGRESS: 'inProgress',
  IN_PREP: 'inPrep',
  READY_FOR_SERVER: 'readyForServer',
  SERVED: 'served',
  VOID: 'void',
}

const ORDER_LINE_STATUS_LABELS = {
  pending: 'Incoming',
  inProgress: 'In Progress',
  inPrep: 'In Prep',
  readyForServer: 'Ready, Waiting For Server',
  served: 'Served',
  void: 'Void',
}

const normalizeFrontendOrderLineStatus = (status) => {
  const normalized = String(status ?? '').trim()
  if (FRONTEND_ORDER_LINE_STATUSES.includes(normalized)) return normalized
  return 'pending'
}

const orderLineStatusToFrontend = (status) => {
  const normalized = String(status ?? '').trim().toUpperCase()
  return BACKEND_TO_FRONTEND_ORDER_LINE_STATUS[normalized] ?? 'pending'
}

const orderLineStatusToBackend = (status) => {
  const normalized = normalizeFrontendOrderLineStatus(status)
  return FRONTEND_TO_BACKEND_ORDER_LINE_STATUS[normalized] ?? 'PENDING'
}

const orderLineStatusLabel = (status) => {
  const normalized = normalizeFrontendOrderLineStatus(status)
  return ORDER_LINE_STATUS_LABELS[normalized] ?? ORDER_LINE_STATUS_LABELS.pending
}

const isKitchenVisibleStatus = (status) => {
  const normalized = normalizeFrontendOrderLineStatus(status)
  return normalized !== 'served' && normalized !== 'void'
}

export {
  FRONTEND_ORDER_LINE_STATUSES,
  normalizeFrontendOrderLineStatus,
  orderLineStatusToBackend,
  orderLineStatusToFrontend,
  orderLineStatusLabel,
  isKitchenVisibleStatus,
}
