import { useRef, useState, useCallback, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

const ICE_SERVERS: RTCConfiguration = {
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
    { urls: "stun:stun2.l.google.com:19302" },
  ],
  iceCandidatePoolSize: 10,
};

type SignalMessage = {
  type: "offer" | "answer" | "ice-candidate" | "ice-candidates" | "hangup";
  payload: any;
  from: string;
};

interface UseWebRTCOptions {
  deviceId: string;
  role: "camera" | "viewer";
  localStream?: MediaStream | null;
  onRemoteStream?: (stream: MediaStream) => void;
  onConnectionStateChange?: (state: RTCPeerConnectionState) => void;
  onDataMessage?: (data: any) => void;
}

export const useWebRTC = ({
  deviceId,
  role,
  localStream,
  onRemoteStream,
  onConnectionStateChange,
  onDataMessage,
}: UseWebRTCOptions) => {
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const dataChannelRef = useRef<RTCDataChannel | null>(null);
  const [connectionState, setConnectionState] = useState<RTCPeerConnectionState>("new");
  const [isConnected, setIsConnected] = useState(false);
  const pendingCandidatesRef = useRef<RTCIceCandidateInit[]>([]);

  const peerId = useRef(`${role}-${Math.random().toString(36).slice(2, 8)}`).current;
  const signalingChannel = `webrtc-signal-${deviceId}`;

  const createPeerConnection = useCallback(() => {
    const pc = new RTCPeerConnection(ICE_SERVERS);

    pc.onicecandidate = (event) => {
      if (event.candidate && channelRef.current) {
        channelRef.current.send({
          type: "broadcast",
          event: "signal",
          payload: {
            type: "ice-candidate",
            payload: event.candidate.toJSON(),
            from: peerId,
          } as SignalMessage,
        });
      }
    };

    pc.ontrack = (event) => {
      if (event.streams[0]) {
        onRemoteStream?.(event.streams[0]);

        // If we are the camera and we receive an audio track, it's 2-way talk from the viewer!
        if (role === "camera" && event.track.kind === "audio") {
          let audioEl = document.getElementById("incoming-viewer-audio") as HTMLAudioElement;
          if (!audioEl) {
            audioEl = document.createElement("audio");
            audioEl.id = "incoming-viewer-audio";
            audioEl.autoplay = true;
            (audioEl as any).playsInline = true;
            audioEl.style.display = "none";
            document.body.appendChild(audioEl);
          }
          audioEl.srcObject = event.streams[0];
          audioEl.play().catch(e => console.warn("Auto-play blocked, interaction might be needed:", e));
        }
      }
    };

    pc.onconnectionstatechange = () => {
      setConnectionState(pc.connectionState);
      setIsConnected(pc.connectionState === "connected");
      onConnectionStateChange?.(pc.connectionState);
    };

    if (role === "camera") {
      const dc = pc.createDataChannel("ai-telemetry");
      dc.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          onDataMessage?.(data);
        } catch (e) {
          console.error("Error parsing datachannel message", e);
        }
      };
      dataChannelRef.current = dc;
    } else {
      pc.ondatachannel = (event) => {
        const dc = event.channel;
        dc.onmessage = (e) => {
          try {
            const data = JSON.parse(e.data);
            onDataMessage?.(data);
          } catch (e) {
            console.error("Error parsing datachannel message", e);
          }
        };
        dataChannelRef.current = dc;
      };
    }

    // Add local tracks if available
    if (localStream) {
      localStream.getTracks().forEach((track) => {
        pc.addTrack(track, localStream);
      });
    }

    pcRef.current = pc;
    return pc;
  }, [localStream, onRemoteStream, onConnectionStateChange, peerId, role]);

  const handleSignal = useCallback(
    async (message: SignalMessage) => {
      if (message.from === peerId) return; // Ignore own messages

      let pc = pcRef.current;

      switch (message.type) {
        case "offer": {
          if (role !== "camera") return; // Only cameras answer offers
          if (!pc) pc = createPeerConnection();

          await pc.setRemoteDescription(new RTCSessionDescription(message.payload));

          // Apply pending candidates
          for (const candidate of pendingCandidatesRef.current) {
            await pc.addIceCandidate(new RTCIceCandidate(candidate));
          }
          pendingCandidatesRef.current = [];

          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);

          console.log("Sending answer to renegotiated offer");
          channelRef.current?.send({
            type: "broadcast",
            event: "signal",
            payload: {
              type: "answer",
              payload: answer,
              from: peerId,
            } as SignalMessage,
          });
          break;
        }

        case "answer": {
          if (role !== "viewer" || !pc) return;
          await pc.setRemoteDescription(new RTCSessionDescription(message.payload));

          // Apply pending candidates
          for (const candidate of pendingCandidatesRef.current) {
            await pc.addIceCandidate(new RTCIceCandidate(candidate));
          }
          pendingCandidatesRef.current = [];
          break;
        }

        case "ice-candidate": {
          try {
            if (!pc || !pc.remoteDescription) {
              pendingCandidatesRef.current.push(message.payload);
            } else {
              await pc.addIceCandidate(new RTCIceCandidate(message.payload));
            }
          } catch (e) {
            console.warn("Failed to add ICE candidate:", e);
          }
          break;
        }

        case "ice-candidates": {
          const candidates = message.payload as RTCIceCandidateInit[];
          for (const cand of candidates) {
            try {
              if (!pc || !pc.remoteDescription) {
                pendingCandidatesRef.current.push(cand);
              } else {
                await pc.addIceCandidate(new RTCIceCandidate(cand));
              }
            } catch (e) {
              console.warn("Failed to add bundled ICE candidate:", e);
            }
          }
          break;
        }

        case "hangup": {
          pc?.close();
          pcRef.current = null;
          setConnectionState("closed");
          setIsConnected(false);
          break;
        }
      }
    },
    [role, peerId, createPeerConnection]
  );

  const [isChannelReady, setIsChannelReady] = useState(false);
  const hasInitiatedConnection = useRef(false);

  // Set up signaling channel
  useEffect(() => {
    if (!deviceId) return;

    const channel = supabase.channel(signalingChannel, {
      config: { broadcast: { self: false } },
    });

    channel
      .on("broadcast", { event: "signal" }, ({ payload }) => {
        handleSignal(payload as SignalMessage);
      })
      .subscribe((status) => {
        if (status === "SUBSCRIBED") {
          setIsChannelReady(true);
        }
      });

    channelRef.current = channel;

    return () => {
      supabase.removeChannel(channel);
      channelRef.current = null;
      setIsChannelReady(false);
    };
  }, [deviceId, signalingChannel, handleSignal]);

  // Viewer initiates connection by sending an offer
  const connect = useCallback(async () => {
    if (role !== "viewer" || hasInitiatedConnection.current) return;
    hasInitiatedConnection.current = true;
    setConnectionState("connecting");

    try {
      const pc = createPeerConnection();
      // Add transceiver for receiving video/audio even without local stream
      pc.addTransceiver("video", { direction: "recvonly" });
      pc.addTransceiver("audio", { direction: "recvonly" });

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      channelRef.current?.send({
        type: "broadcast",
        event: "signal",
        payload: {
          type: "offer",
          payload: offer,
          from: peerId,
        } as SignalMessage,
      });
    } catch (e) {
      console.error("Error creating connection:", e);
      setConnectionState("failed");
      hasInitiatedConnection.current = false;
    }
  }, [role, createPeerConnection, peerId]);

  const disconnect = useCallback(() => {
    channelRef.current?.send({
      type: "broadcast",
      event: "signal",
      payload: {
        type: "hangup",
        payload: null,
        from: peerId,
      } as SignalMessage,
    });
    pcRef.current?.close();
    pcRef.current = null;
    setConnectionState("closed");
    setIsConnected(false);
    hasInitiatedConnection.current = false;
  }, [peerId]);

  // Two-way audio support for Viewer
  useEffect(() => {
    if (role !== "viewer") return;
    let localAudioStream: MediaStream | null = null;
    let audioSender: RTCRtpSender | null = null;

    (window as any).startTwoWayAudio = async () => {
      try {
        localAudioStream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const track = localAudioStream.getAudioTracks()[0];

        if (pcRef.current) {
          // Find the audio transceiver we added earlier
          const transceivers = pcRef.current.getTransceivers();
          const audioTransceiver = transceivers.find(t => t.receiver.track.kind === 'audio');

          if (audioTransceiver) {
            audioTransceiver.direction = "sendrecv";
            await audioTransceiver.sender.replaceTrack(track);
            audioSender = audioTransceiver.sender;
          } else {
            audioSender = pcRef.current.addTrack(track, localAudioStream);
          }

          // Renegotiate offer when adding track
          const offer = await pcRef.current.createOffer();
          await pcRef.current.setLocalDescription(offer);
          channelRef.current?.send({
            type: "broadcast",
            event: "signal",
            payload: {
              type: "offer",
              payload: offer,
              from: peerId,
            } as SignalMessage,
          });
        }
      } catch (e) {
        console.error("Failed to start two-way audio:", e);
      }
    };

    (window as any).stopTwoWayAudio = () => {
      if (localAudioStream) {
        localAudioStream.getTracks().forEach(t => t.stop());
        localAudioStream = null;
      }

      if (pcRef.current && audioSender) {
        const transceivers = pcRef.current.getTransceivers();
        const audioTransceiver = transceivers.find(t => t.sender === audioSender);
        if (audioTransceiver) {
          // Switch back to receive only
          audioTransceiver.direction = "recvonly";
          audioTransceiver.sender.replaceTrack(null);
        }
        audioSender = null;
      }
    };

    return () => {
      if ((window as any).stopTwoWayAudio) {
        (window as any).stopTwoWayAudio();
      }
      delete (window as any).startTwoWayAudio;
      delete (window as any).stopTwoWayAudio;
    };
  }, [role, peerId]);

  const sendData = useCallback((data: any) => {
    if (dataChannelRef.current?.readyState === "open") {
      dataChannelRef.current.send(JSON.stringify(data));
    }
  }, []);

  return {
    connectionState,
    isConnected,
    isChannelReady,
    connect,
    disconnect,
    sendData,
  };
};
