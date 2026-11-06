import { createSlice } from '@reduxjs/toolkit'
import type { PayloadAction } from '@reduxjs/toolkit'

interface UIState {
  sidebarCollapsed: boolean
  drawerOpen: boolean
}

const initialState: UIState = {
  sidebarCollapsed: false,
  drawerOpen: false,
}

export const uiSlice = createSlice({
  name: 'ui',
  initialState,
  reducers: {
    toggleSidebar: (state) => {
      state.sidebarCollapsed = !state.sidebarCollapsed
    },
    setSidebarCollapsed: (state, action: PayloadAction<boolean>) => {
      state.sidebarCollapsed = action.payload
    },
    openDrawer: (state) => {
      state.drawerOpen = true
    },
    closeDrawer: (state) => {
      state.drawerOpen = false
    },
    toggleDrawer: (state) => {
      state.drawerOpen = !state.drawerOpen
    },
  },
})

export const { toggleSidebar, setSidebarCollapsed, openDrawer, closeDrawer, toggleDrawer } =
  uiSlice.actions
