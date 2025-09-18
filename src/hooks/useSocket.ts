import { useEffect, useRef, useState } from 'react'
import { io, Socket } from 'socket.io-client'

export const useSocket = (roomId: string) => {
  const socketRef = useRef<Socket | null>(null)
  const [isConnected, setIsConnected] = useState(false)

  useEffect(() => {
    if (!roomId) return

    // Don't create a new socket if one already exists
    if (socketRef.current && socketRef.current.connected) {
      console.log('Using existing socket connection:', socketRef.current.id)
      socketRef.current.emit('join-room', roomId)
      return
    }

    const socketUrl = process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:8000'
    console.log('Creating new socket connection to:', socketUrl)
    
    // Clean up any existing socket first
    if (socketRef.current) {
      socketRef.current.disconnect()
    }
    
    socketRef.current = io(socketUrl, {
      transports: ['polling', 'websocket'],
      forceNew: false,
      autoConnect: true
    })

    const socket = socketRef.current

    socket.on('connect', () => {
      console.log('Socket connected with ID:', socket.id)
      setIsConnected(true)
      console.log('Emitting join-room event for room:', roomId)
      socket.emit('join-room', roomId)
    })

    socket.on('disconnect', () => {
      console.log('Socket disconnected')
      setIsConnected(false)
    })

    socket.on('connect_error', (error) => {
      console.error('Socket connection error:', error)
      setIsConnected(false)
    })

    return () => {
      if (socket && socket.connected) {
        console.log('Cleaning up socket connection')
        socket.disconnect()
        setIsConnected(false)
      }
    }
  }, [roomId])

  return socketRef.current
}