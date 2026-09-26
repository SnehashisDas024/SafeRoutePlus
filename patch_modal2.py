import codecs
import re

path = r'C:\Users\sneha\Desktop\SafeRoutePlus\frontend\src\components\ui.tsx'
with codecs.open(path, 'r', 'utf-8') as f:
    content = f.read()

# Replace the Modal function
content = re.sub(
    r'export function Modal.*?return \(\s*<div className="modal-overlay" onClick=\{onClose\}>.*?</div>\s*\)\s*\}',
    '''export function Modal({ open, onClose, title, children }: {
  open: boolean
  onClose: () => void
  title: string
  children: React.ReactNode
}) {
  if (!open) return null
  return createPortal(
    <div className="modal-overlay" onClick={onClose}>
      <div className="clay modal" onClick={e => e.stopPropagation()}>
        <div className="row-between mb-2">
          <h3 style={{ fontSize: 18, fontWeight: 900 }}>{title}</h3>
          <button className="clay-btn ghost" style={{ padding: '6px 12px' }} onClick={onClose} aria-label="Close">
            <IconClose size={15} />
          </button>
        </div>
        {children}
      </div>
    </div>,
    document.body
  )
}''',
    content,
    flags=re.DOTALL
)

with codecs.open(path, 'w', 'utf-8') as f:
    f.write(content)
print("Updated Modal with regex in ui.tsx")
