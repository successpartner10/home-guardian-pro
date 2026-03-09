

# SecureCam PWA — Alfred Camera Clone

## Overview
A Progressive Web App that turns old smartphones into security cameras with real-time WebRTC streaming, motion detection, and push notifications. Dark-themed, touch-friendly, and installable.

## Backend (Lovable Cloud / Supabase)

### Authentication
- Email/password signup & login with profile storage (device name preferences, settings)
- Password reset flow

### Database Tables
- **profiles** — user display name, avatar, preferences
- **devices** — id, user_id, name, type (camera/viewer), pairing_code, status (online/offline), last_seen
- **user_roles** — role-based access (standard security pattern)
- **alerts** — id, device_id, user_id, timestamp, thumbnail_url, type (motion), viewed status
- **recordings** — id, device_id, user_id, file_url, duration, created_at

### Storage Buckets
- **snapshots** — captured images from cameras
- **recordings** — short video clips

### Edge Functions
- **webrtc-signal** — WebRTC signaling server for offer/answer/ICE candidate exchange between paired devices
- **send-push-notification** — sends push notifications on motion detection

## Pages & Features

### 1. Auth Pages (Login / Signup / Reset Password)
- Clean dark-themed forms with email/password
- Redirect to dashboard after login

### 2. Dashboard (Viewer Mode)
- Grid/list of paired camera devices with status indicators (online/offline/recording)
- Thumbnail preview from last snapshot
- Quick-tap to open live feed
- Alert badge showing unread motion alerts

### 3. Live Feed View
- Full-screen real-time video stream via WebRTC peer-to-peer connection
- Overlay controls: mute/unmute audio, toggle flashlight (via camera device), take snapshot, start/stop recording
- Connection quality indicator
- Pinch-to-zoom support

### 4. Camera Mode
- Activates device camera using getUserMedia API
- Registers as a "camera" device in the database
- Runs motion detection using canvas frame comparison
- Sends WebRTC stream to connected viewer devices
- Background keep-alive to prevent sleep

### 5. Device Pairing Flow
- Camera device generates a pairing code (displayed as QR code + text code)
- Viewer device scans QR or enters code manually
- Devices link to the same user account in the database
- Animated success confirmation

### 6. Alert History & Timeline
- Chronological list of motion detection events
- Each alert shows timestamp, thumbnail, and device name
- Tap to view the recorded clip or snapshot
- Mark as read / delete functionality
- Cached for offline viewing

### 7. Settings Panel
- **Motion sensitivity** — slider (low/medium/high) controlling frame-difference threshold
- **Alert schedule** — set quiet hours when alerts are suppressed
- **Device management** — rename devices, remove paired devices
- **Notification preferences** — toggle push notifications
- **Account settings** — change password, logout

## Technical Approach

### WebRTC Streaming
- Camera device captures video via `getUserMedia`
- Signaling via Supabase Realtime channels (offer/answer/ICE exchange)
- Peer-to-peer connection for low-latency video
- Fallback status messaging if connection fails

### Motion Detection
- Canvas-based frame comparison on the camera device
- Configurable sensitivity threshold
- Triggers snapshot capture + alert creation + push notification

### PWA Setup
- Service worker with vite-plugin-pwa
- App manifest with dark theme colors and security camera icons
- Offline access to cached alerts and snapshots
- Install prompt page at `/install`

## Design
- **Dark theme** throughout — deep grays and blacks to reduce glare
- **Accent color** — security blue/green for status indicators and active states
- **Large touch targets** — minimum 48px tap areas for all controls
- **Status indicators** — pulsing green dot for online, red for recording, gray for offline
- **Subtle animations** — slide-in alerts, fade transitions, pulse on motion detection
- **Responsive** — optimized for both phone and tablet layouts

