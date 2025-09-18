import { useEffect, useRef, useState, useCallback } from 'react'
import { Socket } from 'socket.io-client'

interface UseWebRTCProps {
  socket: Socket | null
  roomId: string
}

const ICE_SERVERS = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
  ]
}

export const useWebRTC = ({ socket, roomId }: UseWebRTCProps) => {
  const localVideoRef = useRef<HTMLVideoElement>(null)
  const remoteVideoRef = useRef<HTMLVideoElement>(null)
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null)
  const localStreamRef = useRef<MediaStream | null>(null)
  const remotePeerIdRef = useRef<string | null>(null)
  const pendingOfferRef = useRef<string | null>(null)
  
  const [isConnected, setIsConnected] = useState(false)
  const [isMuted, setIsMuted] = useState(false)
  const [isVideoOff, setIsVideoOff] = useState(false)
  const [isScreenSharing, setIsScreenSharing] = useState(false)
  const [isLocalStreamReady, setIsLocalStreamReady] = useState(false)

  const createPeerConnection = useCallback(() => {
    const peerConnection = new RTCPeerConnection(ICE_SERVERS)
    
    peerConnection.onicecandidate = (event) => {
      if (event.candidate && socket && remotePeerIdRef.current) {
        socket.emit('ice-candidate', {
          candidate: event.candidate,
          target: remotePeerIdRef.current
        })
      }
    }
    
    peerConnection.ontrack = (event) => {
      if (remoteVideoRef.current && event.streams[0]) {
        remoteVideoRef.current.srcObject = event.streams[0]
        setIsConnected(true)
      }
    }
    
    peerConnection.onconnectionstatechange = () => {
      if (peerConnection.connectionState === 'connected') {
        setIsConnected(true)
      } else if (peerConnection.connectionState === 'disconnected') {
        setIsConnected(false)
      }
    }
    
    return peerConnection
  }, [socket, roomId])

  const startLocalStream = useCallback(async () => {
    try {
      console.log('Requesting camera access...')
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true
      })
      
      console.log('Camera access granted, setting up local video')
      localStreamRef.current = stream
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream
      }
      
      setIsLocalStreamReady(true)
      console.log('Local stream ready')
      return stream
    } catch (error) {
      console.error('Error accessing media devices:', error)
      throw error
    }
  }, [])

  const addStreamToPeerConnection = useCallback((stream: MediaStream) => {
    if (peerConnectionRef.current) {
      stream.getTracks().forEach(track => {
        peerConnectionRef.current?.addTrack(track, stream)
      })
    }
  }, [])

  const toggleMute = useCallback(() => {
    if (localStreamRef.current) {
      const audioTrack = localStreamRef.current.getAudioTracks()[0]
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled
        setIsMuted(!audioTrack.enabled)
      }
    }
  }, [])

  const toggleVideo = useCallback(() => {
    if (localStreamRef.current) {
      const videoTrack = localStreamRef.current.getVideoTracks()[0]
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled
        setIsVideoOff(!videoTrack.enabled)
      }
    }
  }, [])

  const shareScreen = useCallback(async () => {
    try {
      const screenStream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: true
      })
      
      if (peerConnectionRef.current && localStreamRef.current) {
        const videoTrack = localStreamRef.current.getVideoTracks()[0]
        const sender = peerConnectionRef.current.getSenders().find(s => 
          s.track === videoTrack
        )
        
        if (sender) {
          await sender.replaceTrack(screenStream.getVideoTracks()[0])
        }
        
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = screenStream
        }
        
        setIsScreenSharing(true)
        
        screenStream.getVideoTracks()[0].onended = async () => {
          const cameraStream = await navigator.mediaDevices.getUserMedia({
            video: true,
            audio: true
          })
          
          if (sender) {
            await sender.replaceTrack(cameraStream.getVideoTracks()[0])
          }
          
          if (localVideoRef.current) {
            localVideoRef.current.srcObject = cameraStream
          }
          
          setIsScreenSharing(false)
        }
      }
    } catch (error) {
      console.error('Error sharing screen:', error)
    }
  }, [])

  const leaveCall = useCallback(() => {
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => track.stop())
    }
    
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close()
    }
    
    if (socket) {
      socket.emit('leave')
    }
    
    setIsConnected(false)
  }, [socket, roomId])

  useEffect(() => {
    if (!socket) return

    const initializeCall = async () => {
      try {
        peerConnectionRef.current = createPeerConnection()
        const localStream = await startLocalStream()
        addStreamToPeerConnection(localStream)
      } catch (error) {
        console.error('Failed to initialize call:', error)
      }
    }

    const handleOffer = async (data: { offer: RTCSessionDescriptionInit, from: string }) => {
      if (!peerConnectionRef.current) return
      
      remotePeerIdRef.current = data.from
      await peerConnectionRef.current.setRemoteDescription(data.offer)
      const answer = await peerConnectionRef.current.createAnswer()
      await peerConnectionRef.current.setLocalDescription(answer)
      
      socket.emit('answer', { answer, target: data.from })
    }

    const handleAnswer = async (data: { answer: RTCSessionDescriptionInit }) => {
      if (!peerConnectionRef.current) return
      
      await peerConnectionRef.current.setRemoteDescription(data.answer)
    }

    const handleIceCandidate = async (data: { candidate: RTCIceCandidateInit }) => {
      if (!peerConnectionRef.current) return
      
      await peerConnectionRef.current.addIceCandidate(data.candidate)
    }

    const createOfferForPeer = async (peerId: string) => {
      if (!peerConnectionRef.current || !isLocalStreamReady) {
        console.log('Waiting for local stream before creating offer...')
        pendingOfferRef.current = peerId
        return
      }
      
      console.log('Creating offer for peer:', peerId)
      remotePeerIdRef.current = peerId
      const offer = await peerConnectionRef.current.createOffer()
      await peerConnectionRef.current.setLocalDescription(offer)
      
      socket.emit('offer', { offer, target: peerId })
      pendingOfferRef.current = null
    }

    const handlePeerJoined = async (data: { peerId: string }) => {
      await createOfferForPeer(data.peerId)
    }

    socket.on('offer', handleOffer)
    socket.on('answer', handleAnswer)
    socket.on('ice-candidate', handleIceCandidate)
    socket.on('peer-joined', handlePeerJoined)
    socket.on('peer-left', () => setIsConnected(false))
    socket.on('room-created', (data) => console.log('Room created:', data))
    socket.on('room-joined', (data) => console.log('Room joined:', data))
    socket.on('room-full', (data) => console.log('Room full:', data))

    initializeCall()

    return () => {
      socket.off('offer', handleOffer)
      socket.off('answer', handleAnswer)
      socket.off('ice-candidate', handleIceCandidate)
      socket.off('peer-joined', handlePeerJoined)
      socket.off('peer-left')
      socket.off('room-created')
      socket.off('room-joined')
      socket.off('room-full')
      
      leaveCall()
    }
  }, [socket, roomId, createPeerConnection, startLocalStream, addStreamToPeerConnection, leaveCall])

  // Handle pending offers when local stream becomes ready
  useEffect(() => {
    if (isLocalStreamReady && pendingOfferRef.current && socket) {
      console.log('Local stream ready, creating pending offer for:', pendingOfferRef.current)
      const createOfferForPeer = async (peerId: string) => {
        if (!peerConnectionRef.current) return
        
        remotePeerIdRef.current = peerId
        const offer = await peerConnectionRef.current.createOffer()
        await peerConnectionRef.current.setLocalDescription(offer)
        
        socket.emit('offer', { offer, target: peerId })
        pendingOfferRef.current = null
      }
      
      createOfferForPeer(pendingOfferRef.current)
    }
  }, [isLocalStreamReady, socket])

  return {
    localVideoRef,
    remoteVideoRef,
    isConnected,
    isMuted,
    isVideoOff,
    isScreenSharing,
    isLocalStreamReady,
    toggleMute,
    toggleVideo,
    shareScreen,
    leaveCall
  }
}