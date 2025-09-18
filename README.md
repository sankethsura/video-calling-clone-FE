# Video Call App

A 1:1 video calling application built with Next.js, WebRTC, and Socket.io, similar to WhatsApp video calls.

## Features

- 🎥 **1:1 Video Calling**: High-quality peer-to-peer video calls
- 🔊 **Audio/Video Controls**: Mute/unmute audio and toggle video
- 🖥️ **Screen Sharing**: Share your screen during calls
- 🏠 **Room-based**: Join calls using room names
- 📱 **Responsive UI**: Works on desktop and mobile devices
- 🔌 **Real-time Signaling**: Socket.io for WebRTC signaling

## Technology Stack

- **Frontend**: Next.js 15 with TypeScript
- **Styling**: Tailwind CSS
- **Real-time Communication**: Socket.io-client
- **Video/Audio**: WebRTC (getUserMedia, getDisplayMedia, RTCPeerConnection)
- **State Management**: React hooks

## Getting Started

### Prerequisites

- Node.js 18+ 
- npm or yarn
- A WebRTC signaling server (Socket.io backend)

### Installation

1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```

3. Copy environment variables:
   ```bash
   cp .env.local.example .env.local
   ```

4. Update the socket server URL in `.env.local`:
   ```
   NEXT_PUBLIC_SOCKET_URL=http://localhost:3001
   ```

5. Start the development server:
   ```bash
   npm run dev
   ```

6. Open [http://localhost:3000](http://localhost:3000) in your browser

## Usage

1. **Join a Room**: Enter a room name on the landing page and click "Join Room"
2. **Start Calling**: Share the room name with someone else to start a 1:1 call
3. **Control Your Call**:
   - 🎤 Toggle microphone on/off
   - 📹 Toggle camera on/off  
   - 🖥️ Share your screen
   - ☎️ Leave the call

## WebRTC Signaling Events

The app handles these Socket.io events for WebRTC signaling:

- `join-room`: Join a specific room
- `offer`: Send WebRTC offer to peer
- `answer`: Send WebRTC answer to peer
- `ice-candidate`: Exchange ICE candidates
- `user-joined`: Notify when a user joins
- `user-left`: Notify when a user leaves

## Browser Support

- Chrome 60+
- Firefox 60+
- Safari 12+
- Edge 79+

## Architecture

```
src/
├── app/
│   ├── layout.tsx          # Root layout
│   ├── page.tsx            # Landing page
│   └── room/[id]/
│       └── page.tsx        # Video call room
├── components/
│   └── VideoCall.tsx       # Main video call component
└── hooks/
    ├── useSocket.ts        # Socket.io connection hook
    └── useWebRTC.ts        # WebRTC logic hook
```

## Signaling Server

This frontend requires a Socket.io signaling server. The server should handle:

- Room management
- WebRTC offer/answer exchange
- ICE candidate relay
- User join/leave notifications

## Development

```bash
npm run dev      # Start development server
npm run build    # Build for production  
npm run start    # Start production server
npm run lint     # Run ESLint
```

## License

MIT License