'use client'

import React, { createContext, useContext, useEffect, useRef, useState } from 'react'
import { io, Socket } from 'socket.io-client'

interface SocketContextType {
  socket: Socket | null
  isConnected: boolean
  joinRoom: (roomId: string) => void
  leaveRoom: () => void
  currentRoom: string | null
}

const SocketContext = createContext<SocketContextType | undefined>(undefined)

export const useSocketContext = () => {
  const context = useContext(SocketContext)
  if (context === undefined) {
    throw new Error('useSocketContext must be used within a SocketProvider')
  }
  return context
}

interface SocketProviderProps {
  children: React.ReactNode
}

export const SocketProvider: React.FC<SocketProviderProps> = ({ children }) => {
  const socketRef = useRef<Socket | null>(null)
  const [isConnected, setIsConnected] = useState(false)
  const [currentRoom, setCurrentRoom] = useState<string | null>(null)

  useEffect(() => {
    const socketUrl = process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:8000'
    console.log('Creating global socket connection to:', socketUrl)
    
    // Check if we're connecting to Vercel backend (which doesn't support WebSocket)
    const isVercelBackend = socketUrl.includes('vercel.app')
    
    socketRef.current = io(socketUrl, {
      transports: isVercelBackend ? ['polling'] : ['websocket', 'polling'],
      upgrade: !isVercelBackend,
      rememberUpgrade: !isVercelBackend,
      timeout: 60000,
      forceNew: false,
      autoConnect: true,
      reconnection: true,
      reconnectionAttempts: 3,
      reconnectionDelay: 3000,
      reconnectionDelayMax: 10000,
      randomizationFactor: 0.5,
      withCredentials: false,
      closeOnBeforeunload: false,
      // Polling-specific options for serverless
      ...(isVercelBackend && {
        pollingTimeout: 30000,
        forceBase64: false
      })
    })

    const socket = socketRef.current

    socket.on('connect', () => {
      console.log('Global socket connected with ID:', socket.id)
      setIsConnected(true)
      
      // Rejoin room if we were in one before disconnection
      if (currentRoom) {
        console.log('Rejoining room after reconnection:', currentRoom)
        socket.emit('join-room', currentRoom)
      }
    })

    socket.on('disconnect', (reason) => {
      console.log('Global socket disconnected, reason:', reason)
      setIsConnected(false)
      
      // Handle different disconnect reasons
      if (reason === 'io server disconnect') {
        console.log('Server disconnected, attempting to reconnect...')
        setTimeout(() => socket.connect(), 1000)
      } else if (reason === 'transport error') {
        console.error('❌ Transport error - likely backend issue or timeout')
        console.log('Retrying connection in 5 seconds...')
        setTimeout(() => socket.connect(), 5000)
      }
    })

    socket.on('reconnect', (attemptNumber) => {
      console.log('Socket reconnected after', attemptNumber, 'attempts')
      setIsConnected(true)
    })

    socket.on('connect_error', (error) => {
      console.error('Global socket connection error:', error)
      setIsConnected(false)
      
      // If CORS error, suggest backend update
      if (error.message.includes('400') || error.message.includes('CORS')) {
        console.error('❌ CORS Error: Backend needs to allow frontend domain in CORS settings')
        console.error('Frontend URL:', window.location.origin)
        console.error('Backend URL:', socketUrl)
      }
    })

    socket.on('reconnect_failed', () => {
      console.error('❌ Socket reconnection failed completely')
    })

    socket.on('reconnect_error', (error) => {
      console.error('Socket reconnection error:', error)
    })

    return () => {
      console.log('Cleaning up global socket connection')
      if (socket && socket.connected) {
        socket.disconnect()
      }
      setIsConnected(false)
      setCurrentRoom(null)
    }
  }, [])

  const joinRoom = (roomId: string) => {
    if (socketRef.current && isConnected) {
      console.log('Joining room:', roomId)
      socketRef.current.emit('join-room', roomId)
      setCurrentRoom(roomId)
    } else {
      console.warn('Cannot join room: socket not connected')
    }
  }

  const leaveRoom = () => {
    if (socketRef.current && currentRoom) {
      console.log('Leaving room:', currentRoom)
      socketRef.current.emit('leave')
      setCurrentRoom(null)
    }
  }

  const value: SocketContextType = {
    socket: socketRef.current,
    isConnected,
    joinRoom,
    leaveRoom,
    currentRoom
  }

  return (
    <SocketContext.Provider value={value}>
      {children}
    </SocketContext.Provider>
  )
}