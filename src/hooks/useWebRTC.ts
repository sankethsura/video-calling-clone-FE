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
  const remoteStreamRef = useRef<MediaStream | null>(null)
  const remotePeerIdRef = useRef<string | null>(null)
  const pendingOfferRef = useRef<string | null>(null)
  
  const [isConnected, setIsConnected] = useState(false)
  const [isMuted, setIsMuted] = useState(false)
  const [isVideoOff, setIsVideoOff] = useState(false)
  const [isScreenSharing, setIsScreenSharing] = useState(false)
  const [isLocalStreamReady, setIsLocalStreamReady] = useState(false)
  const [hasPeerJoined, setHasPeerJoined] = useState(false)

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
      console.log('Received remote track:', event.streams[0])
      if (event.streams[0]) {
        remoteStreamRef.current = event.streams[0]
        if (remoteVideoRef.current) {
          remoteVideoRef.current.srcObject = event.streams[0]
          console.log('Remote video element src set:', remoteVideoRef.current.srcObject)
        }
        console.log('Setting isConnected to true')
        setIsConnected(true)
      } else {
        console.warn('No remote stream received')
      }
    }
    
    peerConnection.onconnectionstatechange = () => {
      console.log('Peer connection state changed to:', peerConnection.connectionState)
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
        console.log('Local video element src set:', localVideoRef.current.srcObject)
      } else {
        console.warn('Local video ref is null')
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
      console.log('Adding stream to peer connection with tracks:', stream.getTracks().length)
      stream.getTracks().forEach(track => {
        console.log('Adding track:', track.kind, 'enabled:', track.enabled)
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
    if (!socket || !socket.connected) {
      console.log('Socket not available or not connected, waiting...')
      return
    }

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
      console.log('Received offer from:', data.from)
      if (!peerConnectionRef.current) return
      
      remotePeerIdRef.current = data.from
      await peerConnectionRef.current.setRemoteDescription(data.offer)
      console.log('Set remote description (offer)')
      
      const answer = await peerConnectionRef.current.createAnswer()
      await peerConnectionRef.current.setLocalDescription(answer)
      console.log('Created and set local description (answer)')
      
      socket.emit('answer', { answer, target: data.from })
      console.log('Sent answer to:', data.from)
    }

    const handleAnswer = async (data: { answer: RTCSessionDescriptionInit }) => {
      console.log('Received answer')
      if (!peerConnectionRef.current) return
      
      await peerConnectionRef.current.setRemoteDescription(data.answer)
      console.log('Set remote description (answer)')
    }

    const handleIceCandidate = async (data: { candidate: RTCIceCandidateInit }) => {
      console.log('Received ICE candidate')
      if (!peerConnectionRef.current) return
      
      await peerConnectionRef.current.addIceCandidate(data.candidate)
      console.log('Added ICE candidate')
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
      console.log('Created and set local description (offer)')
      
      socket.emit('offer', { offer, target: peerId })
      console.log('Sent offer to:', peerId)
      pendingOfferRef.current = null
    }

    const handlePeerJoined = async (data: { peerId: string }) => {
      console.log('Peer joined event received:', data.peerId)
      setHasPeerJoined(true)
      remotePeerIdRef.current = data.peerId
      await createOfferForPeer(data.peerId)
    }

    const handleRoomCreated = (data: any) => {
      console.log('Room created:', data)
    }

    const handleRoomJoined = (data: any) => {
      console.log('Room joined:', data)
    }

    const handleRoomFull = (data: any) => {
      console.log('Room full:', data)
    }

    socket.on('offer', handleOffer)
    socket.on('answer', handleAnswer)
    socket.on('ice-candidate', handleIceCandidate)
    socket.on('peer-joined', handlePeerJoined)
    socket.on('peer-left', () => setIsConnected(false))
    socket.on('room-created', handleRoomCreated)
    socket.on('room-joined', handleRoomJoined)
    socket.on('room-full', handleRoomFull)

    initializeCall()

    return () => {
      socket.off('offer', handleOffer)
      socket.off('answer', handleAnswer)
      socket.off('ice-candidate', handleIceCandidate)
      socket.off('peer-joined', handlePeerJoined)
      socket.off('peer-left')
      socket.off('room-created', handleRoomCreated)
      socket.off('room-joined', handleRoomJoined)
      socket.off('room-full', handleRoomFull)
      
      leaveCall()
    }
  }, [socket, roomId, createPeerConnection, startLocalStream, addStreamToPeerConnection, leaveCall])

  // Handle creating offer when local stream becomes ready and peer has joined
  useEffect(() => {
    console.log('Offer creation check:', { 
      isLocalStreamReady, 
      hasPeerJoined, 
      remotePeerId: remotePeerIdRef.current,
      hasSocket: !!socket,
      hasPeerConnection: !!peerConnectionRef.current
    })
    
    if (isLocalStreamReady && hasPeerJoined && remotePeerIdRef.current && socket && peerConnectionRef.current) {
      console.log('Creating offer for peer:', remotePeerIdRef.current)
      
      const createOfferForPeer = async () => {
        if (!peerConnectionRef.current || !remotePeerIdRef.current) return
        
        try {
          const offer = await peerConnectionRef.current.createOffer()
          await peerConnectionRef.current.setLocalDescription(offer)
          console.log('Created and set local description (offer)')
          
          socket.emit('offer', { offer, target: remotePeerIdRef.current })
          console.log('Sent offer to:', remotePeerIdRef.current)
          setHasPeerJoined(false) // Reset to avoid duplicate offers
        } catch (error) {
          console.error('Error creating offer:', error)
        }
      }
      
      createOfferForPeer()
    }
  }, [isLocalStreamReady, hasPeerJoined, socket])

  // Re-assign video streams when isConnected changes (layout switch)
  useEffect(() => {
    if (isConnected) {
      console.log('Re-assigning video streams after connection')
      // Re-assign local video
      if (localVideoRef.current && localStreamRef.current) {
        localVideoRef.current.srcObject = localStreamRef.current
        console.log('Re-assigned local video stream')
      }
      // Re-assign remote video
      if (remoteVideoRef.current && remoteStreamRef.current) {
        remoteVideoRef.current.srcObject = remoteStreamRef.current
        console.log('Re-assigned remote video stream')
      } else if (remoteVideoRef.current && !remoteStreamRef.current) {
        console.warn('Remote video ref exists but no remote stream stored')
      } else if (!remoteVideoRef.current) {
        console.warn('Remote video ref is null')
      }
    }
  }, [isConnected])

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