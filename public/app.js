// ==========================================
// KÈO NHẬU VOTE - CLIENT APPLICATION
// Real-time WebSocket + Optimized Concurrency
// ==========================================

const DAYS_CONFIG = [
  { id: '2026-10-19', label: 'Thứ Hai', dateStr: '19/10/2026', subtitle: 'Khởi động tuần mới', isWeekend: false },
  { id: '2026-10-20', label: 'Thứ Ba', dateStr: '20/10/2026', subtitle: 'Giải tỏa áp lực', isWeekend: false },
  { id: '2026-10-21', label: 'Thứ Tư', dateStr: '21/10/2026', subtitle: 'Giữa tuần lai rai', isWeekend: false },
  { id: '2026-10-22', label: 'Thứ Năm', dateStr: '22/10/2026', subtitle: 'Chuẩn bị cuối tuần', isWeekend: false },
  { id: '2026-10-23', label: 'Thứ Sáu', dateStr: '23/10/2026', subtitle: 'Quẩy hết nấc (TGIF) 🔥', isWeekend: true },
  { id: '2026-10-24', label: 'Thứ Bảy', dateStr: '24/10/2026', subtitle: 'Uống không say không về 🍻', isWeekend: true },
  { id: '2026-10-25', label: 'Chủ Nhật', dateStr: '25/10/2026', subtitle: 'Nghỉ dưỡng nạp năng lượng', isWeekend: true }
];

// App State
let state = {
  days: DAYS_CONFIG,
  votes: [],
  onlineCount: 1,
  selectedAvatar: '🍺',
  selectedDays: new Set(),
  myVoteId: localStorage.getItem('keo_nhau_my_vote_id') || null,
  activeView: 'cards' // 'cards' | 'matrix'
};

// DOM Elements
const userNameInput = document.getElementById('userNameInput');
const userNoteInput = document.getElementById('userNoteInput');
const daysCheckboxesList = document.getElementById('daysCheckboxesList');
const btnSubmitVote = document.getElementById('btnSubmitVote');
const submitBtnText = document.getElementById('submitBtnText');
const userVoteStatus = document.getElementById('userVoteStatus');
const votedNameTag = document.getElementById('votedNameTag');
const btnEditMyVote = document.getElementById('btnEditMyVote');
const btnNewVote = document.getElementById('btnNewVote');
const btnDeleteNicknameTag = document.getElementById('btnDeleteNicknameTag');
const btnDeleteNicknameBtn = document.getElementById('btnDeleteNicknameBtn');

const totalVotersCount = document.getElementById('totalVotersCount');
const topDayName = document.getElementById('topDayName');
const topDayVotes = document.getElementById('topDayVotes');
const onlineCountText = document.getElementById('onlineCountText');

const cardsViewContainer = document.getElementById('cardsViewContainer');
const matrixViewContainer = document.getElementById('matrixViewContainer');
const matrixTableBody = document.getElementById('matrixTableBody');
const feedList = document.getElementById('feedList');

const btnViewCards = document.getElementById('btnViewCards');
const btnViewMatrix = document.getElementById('btnViewMatrix');

// Share & QR
const btnShareLink = document.getElementById('btnShareLink');
const btnShowQr = document.getElementById('btnShowQr');
const qrModal = document.getElementById('qrModal');
const btnCloseQr = document.getElementById('btnCloseQr');
const qrImage = document.getElementById('qrImage');
const qrUrlDisplay = document.getElementById('qrUrlDisplay');
const btnCopyFromModal = document.getElementById('btnCopyFromModal');
const btnCopySummary = document.getElementById('btnCopySummary');
const btnExportCsv = document.getElementById('btnExportCsv');

// Quick Select
const btnSelectAll = document.getElementById('btnSelectAll');
const btnSelectWeekend = document.getElementById('btnSelectWeekend');
const btnClearDays = document.getElementById('btnClearDays');

// Avatar Dropdown
const selectedAvatarBtn = document.getElementById('selectedAvatarBtn');
const currentAvatarEmoji = document.getElementById('currentAvatarEmoji');
const avatarMenu = document.getElementById('avatarMenu');
const avatarOptions = document.querySelectorAll('.avatar-opt');

// ==========================================
// 1. INITIALIZATION & WEBSOCKET SYNC
// ==========================================

let socket = null;
let reconnectTimer = null;

function initWebSocket() {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const wsUrl = `${protocol}//${window.location.host}/ws`;

  try {
    socket = new WebSocket(wsUrl);

    socket.onopen = () => {
      console.log('⚡ Connected to real-time vote server');
    };

    socket.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        handleServerMessage(message);
      } catch (err) {
        console.error('Failed to parse WS message:', err);
      }
    };

    socket.onclose = () => {
      console.warn('⚠️ WebSocket disconnected. Reconnecting in 2s...');
      if (!reconnectTimer) {
        reconnectTimer = setTimeout(() => {
          reconnectTimer = null;
          initWebSocket();
        }, 2000);
      }
    };

    socket.onerror = (err) => {
      console.error('WebSocket error:', err);
    };
  } catch (err) {
    console.error('Cannot create WebSocket:', err);
  }
}

function handleServerMessage(message) {
  switch (message.type) {
    case 'INIT':
      state.votes = message.data.pollState.votes || [];
      state.onlineCount = message.data.onlineCount || 1;
      updateAllUI();
      checkExistingUserVote();
      break;

    case 'ONLINE_COUNT':
      state.onlineCount = message.data.onlineCount || 1;
      onlineCountText.textContent = state.onlineCount;
      break;

    case 'VOTE_UPDATE':
      state.votes = message.data.allVotes;
      updateAllUI();
      if (message.data.actor) {
        addFeedItem(`🍻 <strong>${escapeHtml(message.data.actor)}</strong> vừa cập nhật phiếu vote!`);
        showToast(`🍻 ${message.data.actor} vừa bình chọn`, 'info');
      }
      break;

    case 'VOTE_DELETED':
      state.votes = message.data.allVotes;
      updateAllUI();
      if (message.data.actor) {
        addFeedItem(`❌ <strong>${escapeHtml(message.data.actor)}</strong> đã hủy phiếu.`);
      }
      break;

    case 'VOTE_RESET':
      state.votes = message.data.allVotes;
      updateAllUI();
      showToast('🔄 Dữ liệu vote đã được cập nhật', 'info');
      break;
  }
}

// Fallback fetch REST API
async function fetchPollData() {
  try {
    const res = await fetch('/api/poll');
    const json = await res.json();
    if (json.success) {
      state.votes = json.data.votes || [];
      state.onlineCount = json.onlineCount || 1;
      updateAllUI();
      checkExistingUserVote();
    }
  } catch (err) {
    console.error('Error fetching poll data:', err);
  }
}

// ==========================================
// 2. RENDER FORMS & DAYS CHECKBOXES (19/10 - 25/10/2026)
// ==========================================

function renderDaysCheckboxes() {
  daysCheckboxesList.innerHTML = '';

  state.days.forEach((day) => {
    const isSelected = state.selectedDays.has(day.id);
    const dayVotes = state.votes.filter(v => v.selectedDays && v.selectedDays.includes(day.id)).length;

    const card = document.createElement('div');
    card.className = `day-select-card ${isSelected ? 'selected' : ''} ${day.isWeekend ? 'is-weekend' : ''}`;
    card.setAttribute('data-day-id', day.id);

    card.innerHTML = `
      <div class="custom-checkbox">
        <svg class="check-svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="3">
          <polyline points="20 6 9 17 4 12"></polyline>
        </svg>
      </div>
      <div class="day-card-body">
        <div class="day-card-title-row">
          <span class="day-card-name">${day.label}</span>
          <span class="day-card-date">${day.dateStr}</span>
        </div>
        <div class="day-card-sub">${day.subtitle}</div>
        <div class="day-card-live-count">
          <span>👥</span> <span class="card-voters-count">${dayVotes}</span> anh em chọn
        </div>
      </div>
    `;

    card.addEventListener('click', () => {
      toggleDaySelection(day.id);
    });

    daysCheckboxesList.appendChild(card);
  });
}

function toggleDaySelection(dayId) {
  if (state.selectedDays.has(dayId)) {
    state.selectedDays.delete(dayId);
  } else {
    state.selectedDays.add(dayId);
  }
  updateDayCheckboxesVisuals();
}

function updateDayCheckboxesVisuals() {
  const cards = daysCheckboxesList.querySelectorAll('.day-select-card');
  cards.forEach(card => {
    const dayId = card.getAttribute('data-day-id');
    const isSelected = state.selectedDays.has(dayId);
    card.classList.toggle('selected', isSelected);

    // Update live count on card
    const countSpan = card.querySelector('.card-voters-count');
    if (countSpan) {
      const dayVotes = state.votes.filter(v => v.selectedDays && v.selectedDays.includes(dayId)).length;
      countSpan.textContent = dayVotes;
    }
  });
}

// ==========================================
// 3. STATS & RESULTS RENDERING
// ==========================================

function updateAllUI() {
  onlineCountText.textContent = state.onlineCount;
  totalVotersCount.textContent = state.votes.length;

  // Calculate top voted day
  let maxVotes = 0;
  let bestDay = null;

  state.days.forEach(day => {
    const count = state.votes.filter(v => v.selectedDays && v.selectedDays.includes(day.id)).length;
    if (count > maxVotes) {
      maxVotes = count;
      bestDay = day;
    }
  });

  if (bestDay && maxVotes > 0) {
    topDayName.textContent = `${bestDay.label} (${bestDay.dateStr.slice(0, 5)})`;
    topDayVotes.textContent = `${maxVotes} phiếu`;
  } else {
    topDayName.textContent = 'Chưa chốt';
    topDayVotes.textContent = '0 phiếu';
  }

  updateDayCheckboxesVisuals();
  renderResultsCards(maxVotes);
  renderMatrixTable();
}

// View 1: Cards View
function renderResultsCards(maxVotes) {
  cardsViewContainer.innerHTML = '';
  const totalVoters = state.votes.length;

  state.days.forEach(day => {
    const votersForDay = state.votes.filter(v => v.selectedDays && v.selectedDays.includes(day.id));
    const count = votersForDay.length;
    const percent = totalVoters > 0 ? Math.round((count / totalVoters) * 100) : 0;
    const isWinner = maxVotes > 0 && count === maxVotes;

    const row = document.createElement('div');
    row.className = `result-day-row ${isWinner ? 'is-winner' : ''}`;

    let votersHtml = '';
    if (votersForDay.length === 0) {
      votersHtml = '<span class="voters-empty">Chưa có ai chọn ngày này</span>';
    } else {
      votersHtml = votersForDay.map(v => `
        <span class="voter-chip" title="${escapeHtml(v.name)}: ${escapeHtml(v.note || 'Không có ghi chú')}">
          <span class="voter-chip-avatar">${v.avatar || '🍺'}</span>
          <span class="voter-chip-name">${escapeHtml(v.name)}</span>
        </span>
      `).join('');
    }

    row.innerHTML = `
      <div class="result-header-line">
        <div class="result-date-info">
          <span class="result-day-title">${day.label} (${day.dateStr})</span>
          ${isWinner ? '<span class="winner-crown">🔥 DẪN ĐẦU</span>' : ''}
        </div>
        <div class="result-badge-count">
          <span>${count} phiếu</span>
          <span class="result-percent">(${percent}%)</span>
        </div>
      </div>
      <div class="progress-bar-track">
        <div class="progress-bar-fill" style="width: ${percent}%;"></div>
      </div>
      <div class="voters-avatars-row">
        ${votersHtml}
      </div>
    `;

    cardsViewContainer.appendChild(row);
  });
}

// View 2: Matrix Table (Doodle style)
function renderMatrixTable() {
  matrixTableBody.innerHTML = '';

  if (state.votes.length === 0) {
    matrixTableBody.innerHTML = `
      <tr>
        <td colspan="9" style="text-align: center; color: var(--text-muted); padding: 30px;">
          Chưa có anh em nào biểu quyết. Hãy là người đầu tiên!
        </td>
      </tr>
    `;
    return;
  }

  const myId = state.myVoteId || localStorage.getItem('keo_nhau_my_vote_id');
  const myName = (localStorage.getItem('keo_nhau_my_name') || userNameInput.value.trim()).toLowerCase();

  state.votes.forEach(vote => {
    const tr = document.createElement('tr');
    const isMe = (myId && vote.id === myId) || (myName && vote.name.toLowerCase() === myName);

    const dayCells = state.days.map(day => {
      const checked = vote.selectedDays && vote.selectedDays.includes(day.id);
      return `<td>${checked ? '<span class="check-yes">✓</span>' : '<span class="check-no">-</span>'}</td>`;
    }).join('');

    tr.innerHTML = `
      <td>
        <div class="matrix-user">
          <span>${vote.avatar || '🍺'}</span>
          <span>${escapeHtml(vote.name)}</span>
          ${isMe ? `<button type="button" class="btn-text btn-del-row" style="color:#ef4444; margin-left:6px; font-size:0.75rem; text-decoration:none;" title="Xóa biệt danh của bạn" onclick="deleteMyVote()">[Xóa]</button>` : ''}
        </div>
      </td>
      ${dayCells}
      <td>
        <div class="matrix-note" title="${escapeHtml(vote.note || '')}">${escapeHtml(vote.note || '-')}</div>
      </td>
    `;

    matrixTableBody.appendChild(tr);
  });
}

// Feed Activity
function addFeedItem(text) {
  const item = document.createElement('div');
  item.className = 'feed-item';
  const timeStr = new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

  item.innerHTML = `
    <span class="feed-item-text">${text}</span>
    <span class="feed-item-time">${timeStr}</span>
  `;

  // Remove empty placeholder if any
  const empty = feedList.querySelector('.feed-empty');
  if (empty) empty.remove();

  feedList.prepend(item);

  // Keep max 15 items
  while (feedList.children.length > 15) {
    feedList.removeChild(feedList.lastChild);
  }
}

// ==========================================
// 4. FORM SUBMISSION & LOCAL VOTE SYNC
// ==========================================

btnSubmitVote.addEventListener('click', async (e) => {
  e.preventDefault();
  const name = userNameInput.value.trim();

  if (!name) {
    showToast('⚠️ Vui lòng nhập tên của bạn ở ô trên!', 'info');
    userNameInput.focus();
    return;
  }

  if (state.selectedDays.size === 0) {
    showToast('⚠️ Vui lòng tick chọn ít nhất 1 ngày bạn có thể tham gia!', 'info');
    return;
  }

  const payload = {
    id: state.myVoteId || undefined,
    name: name,
    avatar: state.selectedAvatar,
    selectedDays: Array.from(state.selectedDays),
    note: userNoteInput.value.trim()
  };

  btnSubmitVote.disabled = true;
  submitBtnText.textContent = 'Đang chốt...';

  try {
    const res = await fetch('/api/vote', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const data = await res.json();
    if (data.success) {
      state.myVoteId = data.data.id;
      localStorage.setItem('keo_nhau_my_vote_id', state.myVoteId);
      localStorage.setItem('keo_nhau_my_name', name);
      localStorage.setItem('keo_nhau_my_avatar', state.selectedAvatar);
      localStorage.setItem('keo_nhau_my_note', userNoteInput.value.trim());
      localStorage.setItem('keo_nhau_my_days', JSON.stringify(Array.from(state.selectedDays)));

      showToast(`🎉 Chúc mừng ${name}! Phiếu vote đã được lưu thành công!`, 'success');
      triggerConfetti();
      checkExistingUserVote();
    } else {
      showToast(`Lỗi: ${data.error}`, 'info');
    }
  } catch (err) {
    console.error('Error submitting vote:', err);
    showToast('Không thể kết nối máy chủ. Vui lòng thử lại!', 'info');
  } finally {
    btnSubmitVote.disabled = false;
  }
});

// KHÔI PHỤC VÀ HIỂN THỊ ĐÚNG THÔNG TIN CŨ KHI VÀO LẠI LINK
function checkExistingUserVote() {
  const savedId = localStorage.getItem('keo_nhau_my_vote_id');
  const savedName = localStorage.getItem('keo_nhau_my_name');

  if (!state.votes || state.votes.length === 0) return;

  // Tìm phiếu cũ theo ID hoặc Tên
  const found = state.votes.find(v => 
    (savedId && v.id === savedId) || 
    (savedName && v.name.toLowerCase() === savedName.toLowerCase())
  );

  if (found) {
    state.myVoteId = found.id;
    localStorage.setItem('keo_nhau_my_vote_id', found.id);
    localStorage.setItem('keo_nhau_my_name', found.name);
    localStorage.setItem('keo_nhau_my_avatar', found.avatar || '🍺');
    localStorage.setItem('keo_nhau_my_note', found.note || '');
    localStorage.setItem('keo_nhau_my_days', JSON.stringify(found.selectedDays || []));

    // 1. Điền lại đúng tên cũ
    userNameInput.value = found.name;

    // 2. Điền lại đúng ghi chú cũ
    userNoteInput.value = found.note || '';

    // 3. Khôi phục đúng avatar cũ
    state.selectedAvatar = found.avatar || '🍺';
    currentAvatarEmoji.textContent = state.selectedAvatar;

    // 4. Tick đúng lại các ngày cũ đã chọn
    state.selectedDays = new Set(found.selectedDays || []);
    updateDayCheckboxesVisuals();

    // 5. Hiển thị thông báo trạng thái & đổi tên nút thành cập nhật
    userVoteStatus.classList.remove('hidden');
    if (btnDeleteNicknameBtn) btnDeleteNicknameBtn.classList.remove('hidden');
    votedNameTag.textContent = `${found.avatar || '🍺'} ${found.name} (${state.selectedDays.size} ngày đã chọn)`;
    submitBtnText.textContent = '💾 Cập Nhật Phiếu Của Tôi';
  }
}

// Bấm nút "Nạp lại" phiếu cũ
btnEditMyVote.addEventListener('click', () => {
  checkExistingUserVote();
  userNameInput.scrollIntoView({ behavior: 'smooth' });
  showToast('✏️ Đã nạp lại chính xác thông tin phiếu của bạn!', 'info');
});

// TÍNH NĂNG XÓA BIỆT DANH / HỦY VOTE
async function deleteMyVote() {
  const currentName = (userNameInput.value.trim() || localStorage.getItem('keo_nhau_my_name') || '').trim();
  const targetId = state.myVoteId || localStorage.getItem('keo_nhau_my_vote_id');

  const record = state.votes ? state.votes.find(v => (targetId && v.id === targetId) || (currentName && v.name.toLowerCase() === currentName.toLowerCase())) : null;
  const displayName = record ? record.name : (currentName || 'này');

  if (!record && !targetId && !currentName) {
    showToast('⚠️ Không tìm thấy biệt danh cần xóa!', 'info');
    return;
  }

  const confirmDelete = window.confirm(`❓ Bạn có chắc chắn muốn xóa biệt danh "${displayName}" và rút khỏi danh sách đi nhậu không?`);
  if (!confirmDelete) return;

  const identifier = record ? record.id : (targetId || encodeURIComponent(currentName));

  try {
    const res = await fetch(`/api/vote/${identifier}`, {
      method: 'DELETE'
    });
    const result = await res.json();

    if (result.success) {
      state.myVoteId = null;
      localStorage.removeItem('keo_nhau_my_vote_id');
      localStorage.removeItem('keo_nhau_my_name');
      localStorage.removeItem('keo_nhau_my_avatar');
      localStorage.removeItem('keo_nhau_my_note');
      localStorage.removeItem('keo_nhau_my_days');

      userNameInput.value = '';
      userNoteInput.value = '';
      state.selectedAvatar = '🍺';
      currentAvatarEmoji.textContent = '🍺';
      state.selectedDays.clear();
      updateDayCheckboxesVisuals();

      userVoteStatus.classList.add('hidden');
      if (btnDeleteNicknameBtn) btnDeleteNicknameBtn.classList.add('hidden');
      submitBtnText.textContent = 'Xác Nhận Chốt Kèo';

      showToast(`🗑️ Đã xóa biệt danh "${displayName}" và rút khỏi kèo thành công!`, 'success');
    } else {
      showToast(`Lỗi: ${result.error || 'Không thể xóa'}`, 'info');
    }
  } catch (err) {
    console.error('Error deleting vote:', err);
    showToast('Không thể kết nối máy chủ để xóa. Vui lòng thử lại!', 'info');
  }
}
window.deleteMyVote = deleteMyVote;

if (btnDeleteNicknameTag) {
  btnDeleteNicknameTag.addEventListener('click', deleteMyVote);
}
if (btnDeleteNicknameBtn) {
  btnDeleteNicknameBtn.addEventListener('click', deleteMyVote);
}

// Bấm nút "Đổi người khác" / "Tạo phiếu mới"
if (btnNewVote) {
  btnNewVote.addEventListener('click', () => {
    state.myVoteId = null;
    localStorage.removeItem('keo_nhau_my_vote_id');
    localStorage.removeItem('keo_nhau_my_name');
    localStorage.removeItem('keo_nhau_my_avatar');
    localStorage.removeItem('keo_nhau_my_note');
    localStorage.removeItem('keo_nhau_my_days');

    userNameInput.value = '';
    userNoteInput.value = '';
    state.selectedAvatar = '🍺';
    currentAvatarEmoji.textContent = '🍺';
    state.selectedDays.clear();
    updateDayCheckboxesVisuals();

    userVoteStatus.classList.add('hidden');
    if (btnDeleteNicknameBtn) btnDeleteNicknameBtn.classList.add('hidden');
    submitBtnText.textContent = 'Xác Nhận Chốt Kèo';
    userNameInput.focus();
    showToast('👋 Đã chuyển sang chế độ bỏ phiếu cho người mới!', 'info');
  });
}

// TỰ ĐỘNG TÌM VÀ KHÔI PHỤC KHI NGƯỜI DÙNG NHẬP LẠI TÊN (Kể cả vào từ thiết bị khác)
let nameLookupTimer = null;
userNameInput.addEventListener('input', () => {
  clearTimeout(nameLookupTimer);
  nameLookupTimer = setTimeout(() => {
    const inputVal = userNameInput.value.trim().toLowerCase();
    if (!inputVal || !state.votes) return;

    // Kiểm tra tên này đã từng vote chưa
    const match = state.votes.find(v => v.name.toLowerCase() === inputVal);
    if (match && match.id !== state.myVoteId) {
      state.myVoteId = match.id;
      localStorage.setItem('keo_nhau_my_vote_id', match.id);
      localStorage.setItem('keo_nhau_my_name', match.name);
      localStorage.setItem('keo_nhau_my_avatar', match.avatar || '🍺');
      localStorage.setItem('keo_nhau_my_note', match.note || '');
      localStorage.setItem('keo_nhau_my_days', JSON.stringify(match.selectedDays || []));

      userNoteInput.value = match.note || '';
      state.selectedAvatar = match.avatar || '🍺';
      currentAvatarEmoji.textContent = state.selectedAvatar;
      state.selectedDays = new Set(match.selectedDays || []);
      updateDayCheckboxesVisuals();

      userVoteStatus.classList.remove('hidden');
      votedNameTag.textContent = `${match.avatar || '🍺'} ${match.name} (${state.selectedDays.size} ngày)`;
      submitBtnText.textContent = '💾 Cập Nhật Phiếu Của Tôi';

      showToast(`👋 Chào ${match.name}! Hệ thống đã nhận diện và tự động tick lại các ngày bạn đã chọn trước đó!`, 'info');
    }
  }, 400);
});

// Quick Selection Buttons
btnSelectAll.addEventListener('click', () => {
  state.days.forEach(d => state.selectedDays.add(d.id));
  updateDayCheckboxesVisuals();
});

btnSelectWeekend.addEventListener('click', () => {
  state.selectedDays.clear();
  state.days.filter(d => d.isWeekend).forEach(d => state.selectedDays.add(d.id));
  updateDayCheckboxesVisuals();
});

btnClearDays.addEventListener('click', () => {
  state.selectedDays.clear();
  updateDayCheckboxesVisuals();
});

// ==========================================
// 5. AVATAR PICKER
// ==========================================

selectedAvatarBtn.addEventListener('click', (e) => {
  e.stopPropagation();
  avatarMenu.classList.toggle('hidden');
});

document.addEventListener('click', () => {
  avatarMenu.classList.add('hidden');
});

avatarOptions.forEach(opt => {
  opt.addEventListener('click', (e) => {
    e.stopPropagation();
    avatarOptions.forEach(o => o.classList.remove('active'));
    opt.classList.add('active');
    state.selectedAvatar = opt.getAttribute('data-emoji');
    currentAvatarEmoji.textContent = state.selectedAvatar;
    avatarMenu.classList.add('hidden');
  });
});

// ==========================================
// 6. TOGGLE VIEWS (Cards vs Matrix)
// ==========================================

btnViewCards.addEventListener('click', () => {
  btnViewCards.classList.add('active');
  btnViewMatrix.classList.remove('active');
  cardsViewContainer.classList.remove('hidden');
  matrixViewContainer.classList.add('hidden');
});

btnViewMatrix.addEventListener('click', () => {
  btnViewMatrix.classList.add('active');
  btnViewCards.classList.remove('active');
  cardsViewContainer.classList.add('hidden');
  matrixViewContainer.classList.remove('hidden');
});

// ==========================================
// 7. SHARING & QR CODE MODAL
// ==========================================

function copyCurrentLink() {
  const url = window.location.href;
  navigator.clipboard.writeText(url).then(() => {
    showToast('📋 Đã sao chép link! Hãy dán gửi cho anh em!', 'success');
  }).catch(() => {
    prompt('Sao chép đường link này:', url);
  });
}

btnShareLink.addEventListener('click', copyCurrentLink);
btnCopyFromModal.addEventListener('click', copyCurrentLink);

btnShowQr.addEventListener('click', () => {
  const currentUrl = window.location.href;
  qrUrlDisplay.textContent = currentUrl;
  qrImage.src = `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(currentUrl)}`;
  qrModal.classList.remove('hidden');
});

btnCloseQr.addEventListener('click', () => {
  qrModal.classList.add('hidden');
});

qrModal.addEventListener('click', (e) => {
  if (e.target === qrModal) qrModal.classList.add('hidden');
});

// Copy Summary text for Zalo
btnCopySummary.addEventListener('click', () => {
  const total = state.votes.length;
  let summary = `🍻 KÈO NHẬU TUẦN 19/10 - 25/10/2026\n`;
  summary += `👥 Đã có ${total} anh em tham gia biểu quyết!\n\n`;

  state.days.forEach(day => {
    const votes = state.votes.filter(v => v.selectedDays && v.selectedDays.includes(day.id));
    const names = votes.map(v => v.name).join(', ');
    summary += `👉 ${day.label} (${day.dateStr}): ${votes.length} người ${names ? `[${names}]` : ''}\n`;
  });

  summary += `\n🔗 Bấm vào link này để vào vote ngay: ${window.location.href}`;

  navigator.clipboard.writeText(summary).then(() => {
    showToast('📋 Đã sao chép tóm tắt kèo nhậu! Gửi Zalo/Messenger ngay!', 'success');
  }).catch(() => {
    prompt('Nội dung tóm tắt:', summary);
  });
});

// Export attendance to CSV / Excel
if (btnExportCsv) {
  btnExportCsv.addEventListener('click', () => {
    if (state.votes.length === 0) {
      showToast('⚠️ Hiện chưa có ai vote để xuất danh sách!', 'info');
      return;
    }
    let csv = '\uFEFFHọ và tên,Biểu tượng,Lời nhắn / Quán gợi ý,Thứ Hai (19/10),Thứ Ba (20/10),Thứ Tư (21/10),Thứ Năm (22/10),Thứ Sáu (23/10),Thứ Bảy (24/10),Chủ Nhật (25/10),Thời gian cập nhật\n';
    state.votes.forEach(v => {
      const dayStatus = state.days.map(d => (v.selectedDays && v.selectedDays.includes(d.id)) ? 'Có' : 'Không');
      const cleanNote = (v.note || '').replace(/"/g, '""');
      csv += `"${v.name}","${v.avatar || '🍺'}","${cleanNote}",${dayStatus.map(s => `"${s}"`).join(',')},"${v.updatedAt || ''}"\n`;
    });
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `danh_sach_keo_nhau_19_25_10_2026.csv`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('📊 Đã tải file danh sách Excel thành công!', 'success');
  });
}

// ==========================================
// 8. TOAST & CONFETTI UTILITIES
// ==========================================

function showToast(message, type = 'info') {
  const container = document.getElementById('toastContainer');
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = `<span>${message}</span>`;
  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(10px)';
    toast.style.transition = 'all 0.3s ease';
    setTimeout(() => toast.remove(), 300);
  }, 3500);
}

function escapeHtml(str) {
  if (!str) return '';
  return str.replace(/[&<>'"]/g, tag => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    "'": '&#39;',
    '"': '&quot;'
  }[tag] || tag));
}

// Background beer bubbles
function initBubbles() {
  const container = document.getElementById('bubblesBg');
  const count = 18;
  for (let i = 0; i < count; i++) {
    const bubble = document.createElement('div');
    bubble.className = 'bubble';
    const size = Math.random() * 22 + 10;
    const left = Math.random() * 100;
    const duration = Math.random() * 8 + 6;
    const delay = Math.random() * 7;

    bubble.style.width = `${size}px`;
    bubble.style.height = `${size}px`;
    bubble.style.left = `${left}%`;
    bubble.style.animationDuration = `${duration}s`;
    bubble.style.animationDelay = `${delay}s`;

    container.appendChild(bubble);
  }
}

// Confetti Particle Explosion
function triggerConfetti() {
  const canvas = document.getElementById('confettiCanvas');
  const ctx = canvas.getContext('2d');
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;

  const pieces = [];
  const colors = ['#f59e0b', '#fbbf24', '#10b981', '#3b82f6', '#ec4899', '#ffffff'];

  for (let i = 0; i < 90; i++) {
    pieces.push({
      x: canvas.width / 2,
      y: canvas.height * 0.45,
      r: Math.random() * 6 + 4,
      d: Math.random() * 360,
      color: colors[Math.floor(Math.random() * colors.length)],
      vx: (Math.random() - 0.5) * 16,
      vy: (Math.random() - 0.7) * 18,
      gravity: 0.35,
      tilt: Math.random() * 10 - 10,
      tiltAngle: 0,
      tiltAngleIncremental: (Math.random() * 0.07) + 0.05
    });
  }

  let animationFrame;
  let opacity = 1;

  function render() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    let alive = false;

    pieces.forEach(p => {
      p.x += p.vx;
      p.y += p.vy;
      p.vy += p.gravity;
      p.tiltAngle += p.tiltAngleIncremental;
      p.tilt = Math.sin(p.tiltAngle) * 15;

      if (p.y < canvas.height) alive = true;

      ctx.beginPath();
      ctx.lineWidth = p.r;
      ctx.strokeStyle = p.color;
      ctx.moveTo(p.x + p.tilt + p.r / 2, p.y);
      ctx.lineTo(p.x + p.tilt, p.y + p.tilt + p.r / 2);
      ctx.stroke();
    });

    if (alive && opacity > 0) {
      animationFrame = requestAnimationFrame(render);
    } else {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      cancelAnimationFrame(animationFrame);
    }
  }

  render();
}

// Pre-fill user inputs and checked days immediately from localStorage if previously voted
window.addEventListener('DOMContentLoaded', () => {
  initBubbles();
  renderDaysCheckboxes();

  const savedName = localStorage.getItem('keo_nhau_my_name');
  if (savedName) {
    userNameInput.value = savedName;
  }
  const savedAvatar = localStorage.getItem('keo_nhau_my_avatar');
  if (savedAvatar) {
    state.selectedAvatar = savedAvatar;
    currentAvatarEmoji.textContent = savedAvatar;
  }
  const savedNote = localStorage.getItem('keo_nhau_my_note');
  if (savedNote) {
    userNoteInput.value = savedNote;
  }
  const savedDays = localStorage.getItem('keo_nhau_my_days');
  if (savedDays) {
    try {
      const parsedDays = JSON.parse(savedDays);
      if (Array.isArray(parsedDays) && parsedDays.length > 0) {
        state.selectedDays = new Set(parsedDays);
        updateDayCheckboxesVisuals();
      }
    } catch (e) {}
  }

  fetchPollData();
  initWebSocket();
});
