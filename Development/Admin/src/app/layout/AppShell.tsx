import { useEffect } from 'react'
import { Outlet } from 'react-router-dom'
import { Sidebar } from './Sidebar'
import { Topbar } from './Topbar'
import { useAppSelector, useAppDispatch } from '../../shared/store/hooks'
import { closeDrawer } from '../../shared/store/uiSlice'

export function AppShell() {
  const dispatch = useAppDispatch()
  const drawerOpen = useAppSelector((s) => s.ui.drawerOpen)

  // Close drawer on Escape key
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && drawerOpen) dispatch(closeDrawer())
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [drawerOpen, dispatch])

  // Prevent body scroll when mobile drawer is open
  useEffect(() => {
    document.body.style.overflow = drawerOpen ? 'hidden' : ''
    return () => {
      document.body.style.overflow = ''
    }
  }, [drawerOpen])

  return (
    <div className="flex h-screen overflow-hidden bg-[var(--color-page)]">
      {/* ── Desktop sidebar — always in the flex layout at lg+ ── */}
      <div className="hidden lg:flex lg:flex-col shrink-0">
        <Sidebar />
      </div>

      {/* ── Mobile overlay drawer — slides in from left at <lg ── */}
      {drawerOpen && (
        <>
          <div
            className="fixed inset-0 z-40 bg-black/40 lg:hidden"
            onClick={() => dispatch(closeDrawer())}
            aria-hidden="true"
          />
          <div
            className="fixed inset-y-0 left-0 z-50 flex flex-col lg:hidden"
            style={{ width: 280, animation: 'slideInLeft 200ms ease-out' }}
          >
            <Sidebar forDrawer />
          </div>
        </>
      )}

      {/* ── Main column ── */}
      <div className="flex flex-col flex-1 min-w-0">
        <Topbar />
        <main className="flex-1 overflow-y-auto p-8 lg:p-6 md:p-4">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
