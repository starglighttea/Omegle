// Change this to your deployed signaling server URL (e.g., on Render or Railway)
const SIGNALING_SERVER = "https://your-temu-omegle-server.onrender.com";

const socket = io(SIGNALING_SERVER, { autoConnect: false });
let localStream = null;
let peerConnection = null;
let roomName = null;

const configuration = {
  iceServers: [{ urls: "stun:stun.l.google.com:19302" }]
};

const localVideo = document.getElementById("local-video");
const remoteVideo = document.getElementById("remote-video");
const skipBtn = document.getElementById("skip-btn");
const chatInput = document.getElementById("chat-input");
const sendBtn = document.getElementById("send-btn");
const chatLog = document.getElementById("chat-log");
const loader = document.getElementById("loader");
const strangerStatus = document.getElementById("stranger-status");

// Access User Media (Camera & Microphone)
async function startLocalCamera() {
  try {
    localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
    localVideo.srcObject = localStream;
  } catch (err) {
    appendLog("Error accessing camera/microphone.", "msg-system");
  }
}

function appendLog(text, className) {
  const p = document.createElement("p");
  p.className = className;
  p.innerText = text;
  chatLog.appendChild(p);
  chatLog.scrollTop = chatLog.scrollHeight;
}

// Start Pairing
skipBtn.onclick = () => {
  if (!socket.connected) socket.connect();
  
  if (peerConnection) {
    peerConnection.close();
    peerConnection = null;
  }
  
  remoteVideo.srcObject = null;
  loader.classList.remove("hidden");
  strangerStatus.innerText = "CONNECTING...";
  strangerStatus.style.color = "#ffaa00";
  
  socket.emit("find-match");
  appendLog("Searching for a stranger...", "msg-system");
};

// Handle WebRTC Peer Connection
socket.on("matched", async ({ room, initiator }) => {
  roomName = room;
  loader.classList.add("hidden");
  strangerStatus.innerText = "ONLINE";
  strangerStatus.style.color = "#00ffcc";
  appendLog("Connected to a stranger! Say hi.", "msg-system");
  
  chatInput.disabled = false;
  sendBtn.disabled = false;

  peerConnection = new RTCPeerConnection(configuration);

  localStream.getTracks().forEach(track => peerConnection.addTrack(track, localStream));

  peerConnection.ontrack = (event) => {
    remoteVideo.srcObject = event.streams[0];
  };

  peerConnection.onicecandidate = (event) => {
    if (event.candidate) {
      socket.emit("signal", { roomName, signal: { candidate: event.candidate } });
    }
  };

  if (initiator) {
    const offer = await peerConnection.createOffer();
    await peerConnection.setLocalDescription(offer);
    socket.emit("signal", { roomName, signal: { offer } });
  }
});

socket.on("signal", async ({ signal }) => {
  if (signal.offer) {
    await peerConnection.setRemoteDescription(new RTCSessionDescription(signal.offer));
    const answer = await peerConnection.createAnswer();
    await peerConnection.setLocalDescription(answer);
    socket.emit("signal", { roomName, signal: { answer } });
  } else if (signal.answer) {
    await peerConnection.setRemoteDescription(new RTCSessionDescription(signal.answer));
  } else if (signal.candidate) {
    await peerConnection.addIceCandidate(new RTCIceCandidate(signal.candidate));
  }
});

// Chat Messaging
function sendMessage() {
  const text = chatInput.value.trim();
  if (!text || !roomName) return;
  
  appendLog(`You: ${text}`, "msg-you");
  socket.emit("chat-message", { roomName, message: text });
  chatInput.value = "";
}

sendBtn.onclick = sendMessage;
chatInput.onkeydown = (e) => { if (e.key === "Enter") sendMessage(); };

socket.on("chat-message", (msg) => {
  appendLog(`Stranger: ${msg}`, "msg-stranger");
});

socket.on("peer-disconnected", () => {
  appendLog("Stranger disconnected.", "msg-system");
  strangerStatus.innerText = "OFFLINE";
  strangerStatus.style.color = "#ff3b30";
  chatInput.disabled = true;
  sendBtn.disabled = true;
});

startLocalCamera();
