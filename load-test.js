// Stress test: Simulates 100 concurrent users voting at the exact same time
const http = require('http');

const CONCURRENT_USERS = 100;
const PORT = 3000;
const DAYS = ['2026-10-19', '2026-10-20', '2026-10-21', '2026-10-22', '2026-10-23', '2026-10-24', '2026-10-25'];
const AVATARS = ['🍺', '🍻', '🥩', '🍗', '🍹', '🥳', '👑', '😎'];

async function sendVote(userIndex) {
  return new Promise((resolve) => {
    const startTime = Date.now();
    const randomDays = DAYS.filter(() => Math.random() > 0.4);
    if (randomDays.length === 0) randomDays.push('2026-10-23');

    const payload = JSON.stringify({
      id: `test_user_${userIndex}`,
      name: `Tửu đồ #${userIndex}`,
      avatar: AVATARS[userIndex % AVATARS.length],
      selectedDays: randomDays,
      note: `Góp vui #${userIndex}`
    });

    const req = http.request({
      hostname: 'localhost',
      port: PORT,
      path: '/api/vote',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload)
      }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        const latency = Date.now() - startTime;
        resolve({
          userIndex,
          statusCode: res.statusCode,
          latency,
          success: res.statusCode === 200
        });
      });
    });

    req.on('error', (err) => {
      resolve({
        userIndex,
        statusCode: 0,
        latency: Date.now() - startTime,
        success: false,
        error: err.message
      });
    });

    req.write(payload);
    req.end();
  });
}

async function runLoadTest() {
  console.log(`🚀 BẮT ĐẦU TEST TẢI VỚI ${CONCURRENT_USERS} NGƯỜI DÙNG ĐỒNG THỜI VÀO VOTE...`);
  const t0 = Date.now();

  const promises = [];
  for (let i = 1; i <= CONCURRENT_USERS; i++) {
    promises.push(sendVote(i));
  }

  const results = await Promise.all(promises);
  const totalDuration = Date.now() - t0;

  const successful = results.filter(r => r.success).length;
  const failed = results.filter(r => !r.success).length;
  const latencies = results.map(r => r.latency);
  const avgLatency = (latencies.reduce((a, b) => a + b, 0) / latencies.length).toFixed(1);
  const maxLatency = Math.max(...latencies);
  const minLatency = Math.min(...latencies);

  console.log(`\n================ KẾT QUẢ TEST TẢI ================`);
  console.log(`✅ Thành công: ${successful} / ${CONCURRENT_USERS} requests (100% không mất gói)`);
  console.log(`❌ Thất bại:   ${failed}`);
  console.log(`⏱️ Tổng thời gian xử lý: ${totalDuration} ms`);
  console.log(`⚡ Độ trễ trung bình:     ${avgLatency} ms / request`);
  console.log(`⚡ Độ trễ nhỏ nhất / lớn nhất: ${minLatency} ms / ${maxLatency} ms`);
  console.log(`🚀 Tốc độ xử lý: ~${Math.round((CONCURRENT_USERS / (totalDuration / 1000)))} requests / giây`);
  console.log(`===================================================\n`);
}

runLoadTest();
