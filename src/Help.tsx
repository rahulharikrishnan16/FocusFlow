import { useEffect, useRef } from 'react'

const SHORTCUTS: [string, string][] = [
  ['N', 'New task'],
  ['/', 'Jump to the subject filter'],
  ['D', 'Dashboard view'],
  ['B', 'Priority board view'],
  ['C', 'Clear filters'],
  ['T', 'Toggle theme'],
  ['?', 'This help'],
  ['Esc', 'Close a dialog or cancel a drag'],
]

interface Props { enabled: boolean; onToggle: (on: boolean) => void; onClose: () => void }

export function Help({ enabled, onToggle, onClose }: Props) {
  const dlg = useRef<HTMLDialogElement>(null)
  const close = useRef<HTMLButtonElement>(null)
  // Focus after showModal(); React's autoFocus would run while the dialog is still closed
  useEffect(() => {
    if (!dlg.current!.open) dlg.current!.showModal()
    close.current?.focus()
  }, [])
  return (
    <dialog ref={dlg} onCancel={e => { e.preventDefault(); onClose() }} aria-labelledby="help-title">
      <h2 id="help-title">Keyboard shortcuts</h2>
      <table className="keys">
        <tbody>{SHORTCUTS.map(([k, d]) => <tr key={k}><th scope="row"><kbd>{k}</kbd></th><td>{d}</td></tr>)}</tbody>
      </table>
      <p className="hint">On the board, focus a card's ⠿ handle, press Space to pick it up, arrow keys to move it between columns, Space to drop. Every card also has a priority dropdown.</p>
      <label className="switch">
        <input type="checkbox" checked={enabled} onChange={e => onToggle(e.target.checked)} /> Enable single-key shortcuts
      </label>
      <div className="row end"><button ref={close} type="button" className="primary" onClick={onClose}>Close</button></div>
    </dialog>
  )
}
