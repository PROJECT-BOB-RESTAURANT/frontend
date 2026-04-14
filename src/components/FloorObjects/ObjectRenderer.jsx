import { memo } from 'react'
import clsx from 'clsx'
import { useFloorStore } from '../../store/useFloorStore'
import { isTableReservedNow, toDateMs } from '../../utils/reservations'

const frame =
  'flex h-full w-full items-center justify-center overflow-hidden rounded-md border text-xs font-semibold uppercase tracking-wide'

const ObjectRendererComponent = ({ object }) => {
  const fillColor = object.metadata?.fillColor
  const strokeColor = object.metadata?.strokeColor
  const reservationPreviewAt = useFloorStore((state) => state.reservationPreviewAt)
  const referenceTimeMs = toDateMs(reservationPreviewAt) ?? Date.now()
  const reservedNow = isTableReservedNow(object.metadata, referenceTimeMs)

  const colorStyle =
    fillColor || strokeColor
      ? {
          backgroundColor: fillColor ?? undefined,
          borderColor: strokeColor ?? undefined,
        }
      : undefined

  if (object.type === 'round_table') {
    const roundStyle = {
      backgroundColor: reservedNow ? '#fecaca' : '#bbf7d0',
      borderColor: reservedNow ? '#be123c' : '#15803d',
    }

    return (
      <div
        className="relative h-full w-full rounded-full border-2"
        style={roundStyle}
      />
    )
  }

  if (object.type === 'square_table' || object.type === 'large_table') {
    return (
      <div
        className="flex h-full w-full items-center justify-center overflow-hidden rounded-md border text-xs font-semibold uppercase tracking-wide"
        style={{
          backgroundColor: reservedNow ? '#fecaca' : '#bbf7d0',
          borderColor: reservedNow ? '#be123c' : '#15803d',
          color: reservedNow ? '#881337' : '#166534',
        }}
      />
    )
  }

  if (object.type === 'door') {
    return (
      <svg className="h-full w-full" viewBox="0 0 100 30" preserveAspectRatio="none">
        <line x1="4" y1="26" x2="96" y2="26" stroke={strokeColor ?? '#0f172a'} strokeWidth="2" />
        <path d="M8 26 A18 18 0 0 1 26 8" fill="none" stroke={strokeColor ?? '#0284c7'} strokeWidth="2" />
        <line x1="8" y1="26" x2="26" y2="8" stroke={strokeColor ?? '#0284c7'} strokeWidth="2" />
      </svg>
    )
  }

  if (object.type === 'stairs') {
    return (
      <svg className="h-full w-full" viewBox="0 0 100 80" preserveAspectRatio="none">
        <rect x="2" y="2" width="96" height="76" fill={fillColor ?? '#e2e8f0'} stroke={strokeColor ?? '#334155'} strokeWidth="2" />
        {Array.from({ length: 7 }).map((_, i) => (
          <line
            key={i}
            x1={8 + i * 12}
            y1="8"
            x2={8 + i * 12}
            y2="72"
            stroke={strokeColor ?? '#475569'}
            strokeWidth="2"
          />
        ))}
      </svg>
    )
  }

  if (object.type === 'toilet_icon') {
    return (
      <div
        className="grid h-full w-full place-items-center rounded-xl border-2 border-sky-700 bg-sky-100 text-sky-900"
        style={colorStyle}
      />
    )
  }

  if (object.type === 'wall_segment') {
    return <div className="h-full w-full rounded-sm bg-slate-700" style={{ backgroundColor: fillColor ?? '#334155' }} />
  }

  return (
    <div
      className={clsx(frame, {
        'border-amber-700 bg-amber-100 text-amber-900': object.type === 'bar_desk',
        'border-slate-700 bg-slate-200 text-slate-700': object.type === 'kitchen_block',
        'border-rose-700 bg-rose-100 text-rose-900': object.type === 'custom_rectangle',
      })}
      style={colorStyle}
    />
  )
}

export const ObjectRenderer = memo(ObjectRendererComponent)
