import { describe, it, expect } from 'vitest'
import {
  uiSlice,
  toggleSidebar,
  setSidebarCollapsed,
  toggleDrawer,
  openDrawer,
  closeDrawer,
} from '../shared/store/uiSlice'

const { reducer } = uiSlice

const base = { sidebarCollapsed: false, drawerOpen: false }

describe('uiSlice', () => {
  it('has correct initial state', () => {
    const state = reducer(undefined, { type: '@@INIT' })
    expect(state.sidebarCollapsed).toBe(false)
    expect(state.drawerOpen).toBe(false)
  })

  it('toggleSidebar sets collapsed to true when false', () => {
    const state = reducer(base, toggleSidebar())
    expect(state.sidebarCollapsed).toBe(true)
  })

  it('toggleSidebar sets collapsed to false when true', () => {
    const state = reducer({ ...base, sidebarCollapsed: true }, toggleSidebar())
    expect(state.sidebarCollapsed).toBe(false)
  })

  it('setSidebarCollapsed sets to true', () => {
    const state = reducer(base, setSidebarCollapsed(true))
    expect(state.sidebarCollapsed).toBe(true)
  })

  it('setSidebarCollapsed sets to false', () => {
    const state = reducer({ ...base, sidebarCollapsed: true }, setSidebarCollapsed(false))
    expect(state.sidebarCollapsed).toBe(false)
  })

  it('openDrawer sets drawerOpen to true', () => {
    const state = reducer(base, openDrawer())
    expect(state.drawerOpen).toBe(true)
  })

  it('closeDrawer sets drawerOpen to false', () => {
    const state = reducer({ ...base, drawerOpen: true }, closeDrawer())
    expect(state.drawerOpen).toBe(false)
  })

  it('toggleDrawer flips drawerOpen', () => {
    const opened = reducer(base, toggleDrawer())
    expect(opened.drawerOpen).toBe(true)
    const closed = reducer(opened, toggleDrawer())
    expect(closed.drawerOpen).toBe(false)
  })
})
