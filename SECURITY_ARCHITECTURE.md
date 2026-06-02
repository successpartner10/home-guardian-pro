# HGUARD Elite Security Architecture

Securing the platform against hackers, cloning, and unauthorized API usage relies on four core pillars.

## 1. Preventing App/API Cloning (Firebase App Check)
To prevent malicious actors from extracting your Firebase API keys and using them on a cloned app or a raw script:
- **Firebase App Check** must be enabled on the production Firebase project. 
- It uses **Play Integrity (Android)**, **DeviceCheck/App Attest (iOS)**, and **reCAPTCHA Enterprise (Web)**.
- **How it works:** When the app requests data from Firestore or attempts to sign in, App Check verifies that the request is coming from an authentic, untampered version of the HGUARD binary on a legitimate device. If a hacker tries to hit the API from a script or a cloned APK, the backend rejects it.

## 2. Locking Down the Database (Firestore Rules)
The database structure is protected by strict `firestore.rules`.
- Users can **only** read and write documents where the `user_id` matches their own Firebase Authentication UID.
- Admins (like `successpartner10@gmail.com`) are granted elevated read permissions to handle the Civic Mesh and quota tracking, but standard users are completely isolated.
- The `system_metrics` and `profiles` collections restrict unauthorized edits (e.g., standard users cannot flip their own `isAdmin` or `totp_enabled` flags arbitrarily without passing through validated secure endpoints).

## 3. End-to-End Encrypted Video (WebRTC)
- **Zero-Knowledge Video:** Firebase is **only** used for the initial signaling handshake (exchanging connection IPs). 
- Once the connection is established, the video stream operates entirely Peer-to-Peer (P2P) using WebRTC.
- WebRTC natively enforces **DTLS (Datagram Transport Layer Security)** and **SRTP (Secure Real-time Transport Protocol)**. The video/audio data is end-to-end encrypted; even if someone intercepted the network traffic, they could not view the footage.

## 4. BYOS Data Isolation
- HGUARD utilizes a **Bring Your Own Storage (BYOS)** model. 
- Recorded clips are saved directly into the user's personal Google Drive via their OAuth token. 
- Because video files never pass through or rest on a centralized HGUARD server, a central database breach would yield zero recorded footage to a hacker. They would have to breach Google's infrastructure to access the user's Drive.

## 5. Multi-Factor Authentication (TOTP 2FA)
- Implemented via the `TwoFactorSetup` component.
- Protects against credential stuffing or stolen passwords. Even if an attacker knows the user's email and password, they cannot access the camera feeds without the physical device generating the 30-second rotating TOTP code.
