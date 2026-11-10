import { getAvatarColor } from './utils'

interface RestaurantCellProps {
  name: string
  cuisine: string
}

export function RestaurantCell({ name, cuisine }: RestaurantCellProps) {
  const { bg, text } = getAvatarColor(name)
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
      <div
        style={{
          width: 32,
          height: 32,
          borderRadius: 12,
          background: bg,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
          fontSize: 13,
          fontWeight: 700,
          color: text,
        }}
      >
        {name.charAt(0).toUpperCase()}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        <span
          style={{
            fontSize: 14,
            fontWeight: 500,
            color: 'var(--color-text)',
            fontFamily: 'Poppins, sans-serif',
          }}
        >
          {name}
        </span>
        <span
          style={{
            fontSize: 12,
            fontWeight: 400,
            color: 'var(--color-text-muted)',
            fontFamily: 'Poppins, sans-serif',
          }}
        >
          {cuisine}
        </span>
      </div>
    </div>
  )
}
