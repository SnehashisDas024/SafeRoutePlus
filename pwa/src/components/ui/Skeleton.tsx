function Skeleton({ variant = 'text', width = '100%', height, count = 1 }: { variant?: string; width?: string | number; height?: string | number; count?: number }) {
  const items = Array.from({ length: count }, (_, i) => (
    <div key={i} style={{
      ...baseStyle,
      ...(variant === 'circular' ? circularStyle : {}),
      ...(variant === 'rectangular' ? rectangularStyle : {}),
      width: typeof width === 'number' ? `${width}px` : width,
      height: height || (variant === 'text' ? '16px' : variant === 'circular' ? '48px' : '120px'),
    }} />
  ))

  return <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>{items}</div>
}

const baseStyle = {
  background: 'linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%)',
  backgroundSize: '200% 100%',
  animation: 'shimmer 1.5s infinite',
  borderRadius: '8px',
}

const circularStyle = {
  borderRadius: '50%',
  aspectRatio: '1 / 1',
}

const rectangularStyle = {
  borderRadius: '12px',
}

export default Skeleton