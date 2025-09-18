import { useEffect, useRef } from 'react'
import { io, Socket } from 'socket.io-client'

export const useSocket = (roomId: string) => {
  const socketRef = useRef<Socket | null>(null)

  useEffect(() => {
    if (!roomId) return

    const socketUrl = process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:8000'
    console.log('Connecting to socket:', socketUrl)
    
    socketRef.current = io(socketUrl, {
      transports: ['polling', 'websocket']
    })

    const socket = socketRef.current

    socket.on('connect', () => {
      console.log('Socket connected:', socket.id)
      socket.emit('join-room', roomId)
    })

    socket.on('disconnect', () => {
      console.log('Socket disconnected')
    })

    socket.on('connect_error', (error) => {
      console.error('Socket connection error:', error)
    })

    return () => {
      if (socket) {
        socket.disconnect()
      }
    }
  }, [roomId])

  return socketRef.current
}