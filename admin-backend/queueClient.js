// ============================================================================
// queueClient.js - Module giao tiếp tuần tự giữa Node.js Backend và C++ Engine
// Phụ trách: TV5 (kiêm nhiệm phần lõi tích hợp Backend-C++ của TV6)
// ============================================================================

const { spawn } = require('child_process');
const readline = require('readline');
const { AsyncLocalStorage } = require('async_hooks');

// Ngữ cảnh phân biệt lệnh khôi phục nội bộ với request người dùng bên ngoài
const recoveryContext = new AsyncLocalStorage();

class QueueEngineClient {
  constructor(binaryPath) {
    this.binaryPath = binaryPath;
    this.process = null;
    this.rl = null;
    this.isReady = false;
    this.isRecovering = false;   // Cờ khóa request bên ngoài khi đang nạp lại hàng chờ
    this.commandQueue = [];      // Hàng đợi tuần tự hóa các lệnh gửi qua pipe
    this.isProcessing = false;
    this.onRecoverCallback = null;
  }

  /**
   * Khởi động tiến trình C++ thường trực và đợi tín hiệu "READY"
   */
  start() {
    return new Promise((resolve, reject) => {
      console.log(`[TV6-PIPE] Đang khởi động C++ Queue Engine tại: ${this.binaryPath}`);
      this.process = spawn(this.binaryPath);
      this.rl = readline.createInterface({ input: this.process.stdout });

      let initialized = false;

      // Lắng nghe từng dòng phản hồi từ stdout của C++
      this.rl.on('line', (line) => {
        const response = line.trim();

        // Bước 1: Đợi tín hiệu sẵn sàng đầu tiên từ chương trình C++
        if (!initialized) {
          if (response === 'READY') {
            initialized = true;
            this.isReady = true;
            console.log('[TV6-PIPE] C++ Queue Engine đã sẵn sàng (READY).');
            resolve();
          } else {
            reject(new Error(`[TV6-PIPE] Tín hiệu khởi động sai giao thức: ${response}`));
          }
          return;
        }

        // Bước 2: Trả kết quả về đúng request đang đứng đầu hàng đợi lệnh
        const currentTask = this.commandQueue.shift();
        this.isProcessing = false;
        if (currentTask) {
          clearTimeout(currentTask.timer);
          console.log(`[TV6-PIPE] Lệnh "${currentTask.cmd}" -> Phản hồi "${response}"`);
          currentTask.resolve(response);
        }
        this._processNextCommand();
      });

      // Xử lý sự cố: Tiến trình C++ bị tắt hoặc sập giữa chừng
      this.process.on('exit', async (code) => {
        this.isReady = false;

        // Nếu thoát ngay lúc chưa kịp in READY thì báo lỗi khởi động
        if (!initialized) {
          return reject(new Error(`[TV6-PIPE] Queue Engine thoát sớm khi chưa sẵn sàng (mã: ${code})`));
        }

        console.error(`[TV6-PIPE] CẢNH BÁO: Queue Engine đã dừng (mã thoát: ${code})`);

        // Hủy các lệnh đang kẹt giữa chừng để tránh treo API
        while (this.commandQueue.length > 0) {
          const task = this.commandQueue.shift();
          clearTimeout(task.timer);
          task.reject(new Error('Queue Engine dừng đột ngột khi đang xử lý lệnh'));
        }
        this.isProcessing = false;

        // Tự động khởi động lại và khôi phục dữ liệu từ Database trong ngữ cảnh nội bộ
        if (this.onRecoverCallback && !this.isRecovering) {
          this.isRecovering = true;
          try {
            await recoveryContext.run(true, async () => {
              console.log('[TV6-PIPE] Đang tự động khởi động lại và khôi phục hàng chờ...');
              await this.start();
              await this.onRecoverCallback();
              console.log('[TV6-PIPE] Khôi phục hàng chờ từ Database thành công!');
            });
          } catch (err) {
            console.error('[TV6-PIPE] Lỗi nghiêm trọng khi khôi phục Engine:', err.message);
          } finally {
            this.isRecovering = false;
          }
        }
      });

      this.process.on('error', (err) => {
        console.error('[TV6-PIPE] Không thể chạy file thực thi C++ (kiểm tra đã biên dịch g++ chưa):', err.message);
        reject(err);
      });
    });
  }

  /**
   * Đưa một lệnh vào hàng đợi tuần tự hóa để gửi sang C++
   */
  sendCommand(cmd, timeoutMs = 3000) {
    return new Promise((resolve, reject) => {
      const isInternalRecovery = recoveryContext.getStore() === true;

      if (this.isRecovering && !isInternalRecovery) {
        return reject(new Error('Hệ thống đang khôi phục hàng chờ, vui lòng thử lại sau vài giây.'));
      }
      if (!this.isReady || !this.process) {
        return reject(new Error('Queue Engine chưa sẵn sàng hoạt động.'));
      }
      this.commandQueue.push({ cmd, resolve, reject, timeoutMs });
      this._processNextCommand();
    });
  }

  /**
   * Lấy lần lượt từng lệnh trong commandQueue ghi vào stdin của C++
   */
  _processNextCommand() {
    if (this.isProcessing || this.commandQueue.length === 0) return;
    this.isProcessing = true;
    const currentTask = this.commandQueue[0];

    // Nếu quá timeoutMs mà C++ không phản hồi -> ép tắt tiến trình để cơ chế exit tự khôi phục lại sạch sẽ
    currentTask.timer = setTimeout(() => {
      console.error(`[TV6-PIPE] Timeout lệnh "${currentTask.cmd}" -> Ép khởi động lại Engine.`);
      if (this.process) this.process.kill();
    }, currentTask.timeoutMs);

    this.process.stdin.write(`${currentTask.cmd}\n`);
  }

  // ==========================================================================
  // CÁC HÀM GIAO TIẾP CÔNG KHAI CHO BACKEND (TV3 & TV5 GỌI SỬ DỤNG)
  // ==========================================================================

  async enq(orderId) {
    const res = await this.sendCommand(`ENQ ${orderId}`);
    if (res !== 'OK') throw new Error(`Lỗi ENQ đơn #${orderId}: ${res}`);
    return true;
  }

  async deq() {
    const res = await this.sendCommand('DEQ');
    if (res === 'EMPTY') return null;
    if (res.startsWith('ID ')) {
      return parseInt(res.slice(3), 10);
    }
    throw new Error(`Phản hồi DEQ không hợp lệ từ Engine: ${res}`);
  }

  async clear() {
    const res = await this.sendCommand('CLEAR');
    if (res !== 'OK') throw new Error(`Lỗi CLEAR hàng chờ: ${res}`);
    return true;
  }
}

module.exports = QueueEngineClient;