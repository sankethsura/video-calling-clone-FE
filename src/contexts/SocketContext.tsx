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
    
    socketRef.current = io(socketUrl, {
      transports: ['polling', 'websocket'],
      upgrade: true,
      rememberUpgrade: false,
      timeout: 20000,
      forceNew: false,
      autoConnect: true,
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      randomizationFactor: 0.5,
      withCredentials: false
    })

    const socket = socketRef.current

    socket.on('connect', () => {
      console.log('Global socket connected with ID:', socket.id)
      setIsConnected(true)
    })

    socket.on('disconnect', () => {
      console.log('Global socket disconnected')
      setIsConnected(false)
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