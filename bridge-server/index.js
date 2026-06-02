const Stream = require('node-rtsp-stream');

// Usage: node index.js rtsp://username:password@192.168.1.100:554/stream1 9999
const rtspUrl = process.argv[2];
const wsPort = process.argv[3] || 9999;

if (!rtspUrl) {
    console.error("Please provide an RTSP URL as the first argument.");
    console.log("Example: node index.js rtsp://admin:pass@192.168.1.100/stream1 9999");
    process.exit(1);
}

console.log(`Starting RTSP Bridge...`);
console.log(`Target: ${rtspUrl}`);
console.log(`WebSocket Port: ${wsPort}`);

const stream = new Stream({
  name: 'hguard-bridge',
  streamUrl: rtspUrl,
  wsPort: parseInt(wsPort),
  ffmpegOptions: { // Options for ffmpeg
    '-stats': '', // Print stats
    '-r': 24, // Frame rate
    '-video_size': '1280x720',
    '-c:v': 'mpeg1video',
    '-b:v': '2000k',
    '-bf': '0',
    '-muxdelay': '0.001'
  }
});

console.log(`\n✅ Bridge Active! The HGUARD Web App can now connect to ws://localhost:${wsPort}`);
