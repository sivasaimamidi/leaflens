import React, { useState } from 'react'
import { HomeHero } from './components/HomeHero'
import { Scanner } from './components/Scanner'

export const App: React.FC = () => {
  const [currentView, setCurrentView] = useState<'home' | 'scanner'>('home')

  return (
    <main className="app-main">
      {currentView === 'home' ? (
        <HomeHero onStartScan={() => setCurrentView('scanner')} />
      ) : (
        <Scanner onBack={() => setCurrentView('home')} />
      )}
    </main>
  )
}

export default App
