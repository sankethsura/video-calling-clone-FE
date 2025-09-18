import { useEffect, useRef } from 'react'
import { io, Socket } from 'socket.io-client'

export const useSocket = (roomId: string) => {
  const socketRef = useRef<Socket | null>(null)

  useEffect(() => {
    if (!roomId) return

    socketRef.current = io(process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:3001', {
      transports: ['websocket']
    })

    const socket = socketRef.current

    socket.emit('join-room', roomId)

    return () => {
      if (socket) {
        socket.disconnect()
      }
    }
  }, [roomId])

  return socketRef.current
}