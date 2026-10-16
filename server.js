const express = require('express');
const http = require('http');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { WebSocketServer, WebSocket } = require('ws');

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server, path: '/ws' });

const PORT = process.env.PORT || 3000;
const DATA_DIR = path.join(__dirname, 'data');
const DATA_FILE = path.join(DATA_DIR, 'poll_data.json');

// Ensure data folder exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// 7 days definition: 19/10/2026 -> 25/10/2026
const DEFAULT_DAYS = [
  { id: '2026-10-19', label: 'Thứ Hai', dateStr: '19/10/2026', subtitle: 'Khởi động tuần mới' },
  { id: '2026-10-20', label: 'Thứ Ba', dateStr: '20/10/2026', subtitle: 'Giải tỏa áp lực' },
  { id: '2026-10-21', label: 'Thứ Tư', dateStr: '21/10/2026', subtitle: 'Giữa tuần lai rai' },
  { id: '2026-10-22', label: 'Thứ Năm', dateStr: '22/10/2026', subtitle: 'Chuẩn bị cuối tuần' },
  { id: '2026-10-23', label: 'Thứ Sáu', dateStr: '23/10/2026', subtitle: 'Quẩy hết nấc (TGIF) 🔥' },
  { id: '2026-10-24', label: 'Thứ Bảy', dateStr: '24/10/2026', subtitle: 'Uống không say không về 🍻' },
  { id: '2026-10-25', label: 'Chủ Nhật', dateStr: '25/10/2026', subtitle: 'Nghỉ dưỡng nạp năng lượng' }
];

// In-memory poll store for ultra-fast zero-latency operations
let pollState = {
  title: 'Kèo Nhậu Bất Diệt - Tuần 19/10 đến 25/10/2026 🍻',
  description: 'Anh em chọn ngày rảnh để ban tổ chức chốt quán và đặt bàn!',
  days: DEFAULT_DAYS,
  votes: [] // array of { id, name, avatar, selectedDays: [], note, createdAt, updatedAt }
};

// Load saved data if present
try {
  if (fs.existsSync(DATA_FILE)) {
    const raw = fs.readFileSync(DATA_FILE, 'utf-8');
    const parsed = JSON.parse(raw);
    if (parsed && Array.isArray(parsed.votes)) {
      pollState.votes = parsed.votes;
      if (parsed.title) pollState.title = parsed.title;
      if (parsed.description) pollState.description = parsed.description;
    }
  }
} catch (err) {
  console.error('Error loading data file:', err.message);
}

// Debounced save to file to protect I/O while handling 100+ concurrent requests
let saveTimeout = null;
function persistPollState() {
  if (saveTimeout) clearTimeout(saveTimeout);
  saveTimeout = setTimeout(() => {
    try {
      fs.writeFileSync(DATA_FILE, JSON.stringify(pollState, null, 2), 'utf-8');
    } catch (err) {
      console.error('Failed to persist poll data:', err);
    }
  }, 100);
}

// Helper: broadcast message to all connected WebSocket clients
function broadcast(payload) {
  const data = JSON.stringify(payload);
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      try {
        client.send(data);
      } catch (err) {
        // Ignore dead socket errors
      }
    }
  });
}

function getConnectedClientsCount() {
  let count = 0;
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) count++;
  });
  return count;
}

// WebSocket connection management
wss.on('connection', (ws) => {
  // Send current state and active viewer count immediately on connect
  ws.send(JSON.stringify({
    type: 'INIT',
    data: {
      pollState,
      onlineCount: getConnectedClientsCount()
    }
  }));

  // Broadcast updated count
  broadcast({
    type: 'ONLINE_COUNT',
    data: { onlineCount: getConnectedClientsCount() }
  });

  ws.on('message', (message) => {
    try {
      const msg = JSON.parse(message.toString());
      if (msg.type === 'PING') {
        ws.send(JSON.stringify({ type: 'PONG' }));
      }
    } catch (e) {
      // Ignore
    }
  });

  ws.on('close', () => {
    broadcast({
      type: 'ONLINE_COUNT',
      data: { onlineCount: getConnectedClientsCount() }
    });
  });
});

// Middleware
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public'), {
  maxAge: '1h',
  etag: true
}));

// API Routes
app.get('/api/poll', (req, res) => {
  res.json({
    success: true,
    data: pollState,
    onlineCount: getConnectedClientsCount()
  });
});

app.post('/api/vote', (req, res) => {
  const { id, name, avatar, selectedDays, note } = req.body;

  if (!name || typeof name !== 'string' || !name.trim()) {
    return res.status(400).json({ success: false, error: 'Vui lòng nhập tên của bạn!' });
  }

  const cleanName = name.trim().slice(0, 50);
  const cleanAvatar = (avatar && typeof avatar === 'string') ? avatar.slice(0, 10) : '🍺';
  const cleanNote = (note && typeof note === 'string') ? note.trim().slice(0, 200) : '';
  const cleanDays = Array.isArray(selectedDays)
    ? selectedDays.filter(dayId => DEFAULT_DAYS.some(d => d.id === dayId))
    : [];

  const now = new Date().toISOString();
  let voteRecord;

  // Check if updating existing vote by ID or by same exact trimmed name (case-insensitive)
  const existingIdx = pollState.votes.findIndex(v =>
    (id && v.id === id) || v.name.toLowerCase() === cleanName.toLowerCase()
  );

  if (existingIdx >= 0) {
    pollState.votes[existingIdx] = {
      ...pollState.votes[existingIdx],
      name: cleanName,
      avatar: cleanAvatar,
      selectedDays: cleanDays,
      note: cleanNote,
      updatedAt: now
    };
    voteRecord = pollState.votes[existingIdx];
  } else {
    voteRecord = {
      id: id || 'v_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6),
      name: cleanName,
      avatar: cleanAvatar,
      selectedDays: cleanDays,
      note: cleanNote,
      createdAt: now,
      updatedAt: now
    };
    pollState.votes.push(voteRecord);
  }

  persistPollState();

  // Instant real-time broadcast to all connected users
  broadcast({
    type: 'VOTE_UPDATE',
    data: {
      vote: voteRecord,
      allVotes: pollState.votes,
      actor: cleanName
    }
  });

  return res.json({
    success: true,
    data: voteRecord,
    allVotes: pollState.votes
  });
});

// Remove a vote
app.delete('/api/vote/:id', (req, res) => {
  const { id } = req.params;
  const idx = pollState.votes.findIndex(v => v.id === id);
  if (idx >= 0) {
    const removed = pollState.votes.splice(idx, 1)[0];
    persistPollState();
    broadcast({
      type: 'VOTE_DELETED',
      data: {
        id,
        allVotes: pollState.votes,
        actor: removed.name
      }
    });
    return res.json({ success: true, message: 'Đã hủy vote' });
  }
  return res.status(404).json({ success: false, error: 'Không tìm thấy phiếu vote' });
});

// Reset demo votes / seed data (optional utility)
app.post('/api/seed', (req, res) => {
  const sampleUsers = [
    { name: 'Tuấn Cận', avatar: '🍺', selectedDays: ['2026-10-23', '2026-10-24'], note: 'Thứ 6 tan làm là quất luôn' },
    { name: 'Huy Ba Gác', avatar: '🍻', selectedDays: ['2026-10-21', '2026-10-23', '2026-10-24'], note: 'Bao nhiêu cữ cũng chiều' },
    { name: 'Linh Răng Khểnh', avatar: '🍹', selectedDays: ['2026-10-23', '2026-10-25'], note: 'Ăn mồi là chính, uống 1 lon' },
    { name: 'Hoàng Trùm Nướng', avatar: '🥩', selectedDays: ['2026-10-22', '2026-10-23', '2026-10-24'], note: 'Gợi ý quán Lẩu Bò Nhà Gỗ' },
    { name: 'Sếp Dũng', avatar: '👑', selectedDays: ['2026-10-24'], note: 'Thứ 7 anh tài trợ 50% bill!' }
  ];

  pollState.votes = sampleUsers.map((u, i) => ({
    id: 'sample_' + (i + 1),
    name: u.name,
    avatar: u.avatar,
    selectedDays: u.selectedDays,
    note: u.note,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  }));

  persistPollState();

  broadcast({
    type: 'VOTE_RESET',
    data: { allVotes: pollState.votes }
  });

  res.json({ success: true, count: pollState.votes.length });
});

// Clear all votes
app.post('/api/clear', (req, res) => {
  pollState.votes = [];
  persistPollState();
  broadcast({
    type: 'VOTE_RESET',
    data: { allVotes: [] }
  });
  res.json({ success: true, message: 'Đã xóa toàn bộ vote' });
});

// Helper to get local network IP address
function getLocalIp() {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const net of interfaces[name]) {
      if (net.family === 'IPv4' && !net.internal) {
        return net.address;
      }
    }
  }
  return 'localhost';
}

server.listen(PORT, '0.0.0.0', () => {
  const localIp = getLocalIp();
  console.log(`=======================================================`);
  console.log(`🍻 KÈO NHẬU VOTE SERVER ĐANG CHẠY!`);
  console.log(`👉 Truy cập cục bộ:    http://localhost:${PORT}`);
  console.log(`👉 Link chia sẻ mạng:  http://${localIp}:${PORT}`);
  console.log(`⚡ Sẵn sàng phục vụ 100+ người dùng đồng thời không giật lag!`);
  console.log(`=======================================================`);
});
