# HGUARD Elite — Feature Reference
**Version 2.5.1** | Elite Mesh Intelligence Platform
> [!NOTE]
> A stylized PDF version of this document is available at: [HGUARD_Elite_Features.pdf](file:///home/sunny/Documents/camera/HGUARD_Elite_Features.pdf)

---

## 🔐 Authentication & Access Control
- **Google Sign-In** — One-tap login via Google OAuth popup with Drive scope
- **Email/Password** — Standard sign-up and login with Firebase Auth
- **Persistent Sessions** — `browserLocalPersistence` keeps you logged in across reloads
- **Force Logout All Devices** — Admin can remotely invalidate all active sessions instantly
- **4-Digit Security PIN** — Required for destructive actions (e.g. deleting recordings)
- **Admin Role** — Primary admin email (`successpartner10@gmail.com`) gets elevated privileges
- **Approval Gate** — New users require admin approval before accessing the system
- **Force Re-auth Detection** — Firestore-triggered global logout propagates to all listeners in real time

---

## 📷 Camera & Live Monitoring
- **Multi-Camera Mesh** — Monitor and switch between multiple cameras from one dashboard
- **720p HD Recording** — Streams at 1280×720 (environment-facing camera, VP8/WebM)
- **Night Vision Mode** — Auto brightness/contrast boost when ambient light drops below threshold
- **Live Video Feed** — Direct browser-to-browser P2P stream via camera feed
- **Snapshot Capture** — Canvas-based frame extraction for AI analysis and thumbnails
- **WebRTC Fallback** — Graceful degradation if HD fails (standard → any available camera)

---

## 🤖 AI Intelligence (Gemini 2.5 Flash)
- **Real-Time Object Detection** — Identifies people, animals, vehicles, and objects every 10 seconds
- **Bounding Boxes** — Visual overlays drawn on detected objects with labels and confidence scores
- **Risk Level Classification** — Each scan returns `low`, `medium`, or `high` risk rating
- **AI Narrative** — Descriptive one-sentence scene summary generated per scan
- **AI Brain Selection** — Choose between Local-Edge (Gemma) or Cloud Neural (Gemini) providers
- **Adaptive Model Routing** — Auto-upgrade toggle routes to the most efficient available model
- **Reference Image Matching** — Upload a reference photo; AI flags if that person appears in frame
- **15s Overlay Persistence** — Bounding boxes remain visible for 15s between 10s scan intervals
- **AI Toggle (Side HUD)** — One-tap enable/disable from the camera view right panel
- **Quota Fallback** — Auto-falls back to `gemini-2.5-flash-lite` if primary model is rate-limited

---

## 🎬 Smart Recording & Google Drive
- **Motion-Triggered Recording** — Starts automatically when pixel-diff motion is detected
- **30-Second Base Clip** — Records up to 30s from the moment motion is detected
- **AI Gate at 5s** — Mid-clip AI analysis; discards clip if nothing relevant is found (saves Drive storage)
- **Dynamic Extension** — If person/vehicle/high-risk confirmed, idle timer resets (+30s per event)
- **Audio Extension** — Sound alert during a clip resets the idle timer and extends recording
- **5-Minute Hard Cap** — Clips never exceed 5 minutes regardless of continued activity
- **WebM/VP8 Format** — Compressed, browser-native format compatible with all major players
- **Google Drive Sync** — Clips auto-uploaded to a `camera files` folder in your linked Drive
- **Auto Quota Enforcement** — Older non-starred clips are purged when Drive approaches limit
- **FIFO Buffer** — Configurable storage limit (2–50 GB slider); oldest clips deleted first
- **Drive Usage Bar** — Real-time usage meter in Settings with warning at 90% capacity
- **Folder Auto-Creation** — `ensureFolder()` creates the Drive folder on first save automatically

---

## 🔔 Alerts & Notifications
- **Motion Alerts** — Logged to Firestore with timestamp, device, AI summary, and risk level
- **Sound Alerts** — Detected audio classes (speech, glass break, alarm) trigger separate alerts
- **Offline Queue** — Alerts queued in `localStorage` when offline and flushed on reconnect
- **Webhook Integration** — Real-time POST to a custom URL on every alert event
- **Alert History** — Full paginated history in the Alerts page with playback from Drive
- **Alert Playback** — Tap any alert to stream the associated Drive clip inline
- **Bulk Delete** — Select and delete multiple alerts with PIN verification
- **Starred Clips** — Mark clips as important; starred clips are exempt from auto-purge

---

## 🗓️ Scheduling & Filters
- **Focus Hours** — Set start/end times; detection only activates during those hours
- **Schedule Toggle** — Enable/disable time-based monitoring with a single switch
- **Smart Drive-Saver (Pet Filter)** — If only pets detected (no person), recording is discarded
- **Ignore Pets Toggle** — Saves Drive storage by skipping pet-only events

---

## 📊 Dashboard & Device Management
- **Device Grid** — All cameras displayed as cards with online/offline status indicators
- **Live Status Pulse** — Animated indicator shows real-time camera heartbeat
- **Ghost Device Cleanup** — Admin auto-purges stale devices offline for >2 minutes on login
- **Nuclear Mesh Reset** — One-click delete of all device records for a clean restart
- **Device Naming** — Custom name per camera device stored in Firestore
- **Deep Sleep HUD** — Pitch-black power-saving overlay with animated pulse
- **Smart Wake Logic** — Instant return to live feed on motion/sound detection
- **Remote Viewer Wake** — Auto-restores camera feed when a remote viewer connects
- **Command Wake** — Wakes device instantly upon receiving any remote command
- **Camera Health HUD** — Real-time battery %, unread alert count, and total clip stats
- **Bidirectional Naming** — Rename cameras from either the camera node or any viewer
- **AI Zoom Enhance** — Intelligent digital sharpening and contrast boosting during zoom
- **Audio Clarity+** — Active noise cancellation and speech isolation for two-way talk
- **Tactical AI Night Vision** — Automatic low-light switching with "High Sensitivity" AI processing
- **Movie Aesthetics** — Professional-grade green IR filter with film grain and noise isolation

---

## ⚙️ Settings
- **Alert Preferences** — Mute / Vibrate / Ring mode selection
- **Display Name** — Editable user profile name synced to Firestore
- **AI Brain Selector** — Toggle between Gemma (edge) and Gemini (cloud) AI providers
- **Archive Limit Slider** — Set Drive FIFO buffer between 2–50 GB
- **Google Drive Connect** — Link/manage Drive OAuth token directly from Settings
- **Security PIN** — Set or update 4-digit deletion guard PIN
- **Session Control** — Force logout all devices with one confirmation dialog
- **System Purge** — Nuclear reset of entire camera mesh
- **Deep Sleep Mode** — Low-power UI with motion-activated auto-wake
- **Automation Webhook** — Save a custom webhook URL for external integrations

---

## 🌐 Deployment & Infrastructure
- **Firebase Hosting** — Deployed at `hguard-elite.web.app` with global CDN
- **Firestore Database** — Real-time NoSQL for devices, profiles, and alerts
- **No-Cache Headers** — `Cache-Control: no-cache, must-revalidate` on all assets
- **COOP Header** — `Cross-Origin-Opener-Policy: same-origin-allow-popups` for popup auth
- **PWA Support** — Service worker with cache-busting on version change
- **Offline Resilience** — Pending alerts, session detection, and local fallback throughout
- **Version Display** — `v2.5.1` shown on login screen and build metadata

---

*Generated: April 2026 | HGUARD Elite Protocol v2.5.1*
