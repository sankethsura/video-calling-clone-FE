'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'

interface Room {
  id: string
  participants: number
  createdAt: string
}

export default function Home() {
  const [roomName, setRoomName] = useState('')
  const [activeRooms, setActiveRooms] = useState<Room[]>([])
  const [loading, setLoading] = useState(true)
  const router = useRouter()

  const fetchActiveRooms = async () => {
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:3001'}/rooms`)
      if (response.ok) {
        const rooms = await response.json()
        setActiveRooms(rooms)
      }
    } catch (error) {
      console.error('Failed to fetch active rooms:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchActiveRooms()
    const interval = setInterval(fetchActiveRooms, 5000)
    return () => clearInterval(interval)
  }, [])

  const handleJoinRoom = (e: React.FormEvent) => {
    e.preventDefault()
    if (roomName.trim()) {
      router.push(`/room/${encodeURIComponent(roomName.trim())}`)
    }
  }

  const handleJoinExistingRoom = (roomId: string) => {
    router.push(`/room/${encodeURIComponent(roomId)}`)
  }

  const formatTime = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-6">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">Video Call</h1>
          <p className="text-gray-600">Join an existing room or create a new one</p>
        </div>

        <div className="grid md:grid-cols-2 gap-8">
          <div className="bg-white p-8 rounded-lg shadow-lg">
            <h2 className="text-2xl font-semibold text-gray-900 mb-6">Create New Room</h2>
            <form onSubmit={handleJoinRoom} className="space-y-4">
              <div>
                <label htmlFor="roomName" className="block text-sm font-medium text-gray-700 mb-2">
                  Room Name
                </label>
                <input
                  type="text"
                  id="roomName"
                  value={roomName}
                  onChange={(e) => setRoomName(e.target.value)}
                  placeholder="Enter room name..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                />
              </div>
              
              <button
                type="submit"
                className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition duration-200"
              >
                Create & Join Room
              </button>
            </form>
          </div>

          <div className="bg-white p-8 rounded-lg shadow-lg">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-semibold text-gray-900">Active Rooms</h2>
              <button
                onClick={fetchActiveRooms}
                className="text-sm text-blue-600 hover:text-blue-700 focus:outline-none"
              >
                Refresh
              </button>
            </div>

            {loading ? (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
                <p className="text-gray-500 mt-2">Loading rooms...</p>
              </div>
            ) : activeRooms.length === 0 ? (
              <div className="text-center py-8">
                <div className="text-gray-400 mb-2">
                  <svg className="w-12 h-12 mx-auto" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
                  </svg>
                </div>
                <p className="text-gray-500">No active rooms</p>
                <p className="text-sm text-gray-400">Create a new room to get started</p>
              </div>
            ) : (
              <div className="space-y-3">
                {activeRooms.map((room) => (
                  <div
                    key={room.id}
                    className="flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex-1">
                      <h3 className="font-medium text-gray-900 truncate">{room.id}</h3>
                      <div className="flex items-center space-x-4 mt-1">
                        <span className="text-sm text-gray-500">
                          {room.participants}/2 participants
                        </span>
                        <span className="text-sm text-gray-500">
                          Created {formatTime(room.createdAt)}
                        </span>
                      </div>
                    </div>
                    
                    <div className="flex items-center space-x-2">
                      <div className={`w-2 h-2 rounded-full ${room.participants === 1 ? 'bg-yellow-400' : 'bg-red-400'}`} />
                      <button
                        onClick={() => handleJoinExistingRoom(room.id)}
                        disabled={room.participants >= 2}
                        className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                          room.participants >= 2
                            ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                            : 'bg-blue-600 text-white hover:bg-blue-700'
                        }`}
                      >
                        {room.participants >= 2 ? 'Full' : 'Join'}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}