import { Suspense } from 'react'
import { Route, Routes } from 'react-router-dom'
import { Spin } from 'antd'

export default function AppRoutes() {
  return (
    <Suspense fallback={<Spin spinning fullscreen />}>
      <Routes>
        {/* Route definitions go here. Lazy-load pages with React.lazy(). */}
        <Route path="*" element={null} />
      </Routes>
    </Suspense>
  )
}
