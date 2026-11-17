'use strict';

/**
 * queueEngineClient.js - TV6: tích hợp Backend (Node.js) với C++ Queue Engine.
 *
 * - Khởi động Engine MỘT lần, giữ pipe stdin/stdout suốt thời gian chạy.
 * - Đợi dòng "READY" rồi mới gửi lệnh.
 * - Tuần tự hóa: mỗi thời điểm chỉ một lệnh đang chờ phản hồi.
 * - Xác thực mọi phản hồi theo đặc tả; timeout / phản hồi lạ / Engine thoát
 *   đều coi là sự cố.
 * - Khi có sự cố: khởi động lại Engine, CLEAR, nạp lại các đơn PENDING
 *   (đã sắp xếp created_at ASC, id ASC) bằng getPendingIds() do TV3 cung cấp.
 */

const { spawn } = require('child_process');
const readline = require('readline');

const MAX_ID = 2147483647;

// Dạng phản hồi hợp lệ cho từng lệnh (theo mục 2.4 / README của TV4).
const RESPONSES = {
  ENQ: /^(OK|ERR BAD_ID)$/,
  DEQ: /^(ID [1-9]\d*|EMPTY)$/,
  PEEK: /^(ID [1-9]\d*|EMPTY)$/,
  SIZE: /^SIZE \d+$/,
  CLEAR: /^OK$/,
};

class EngineError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'EngineError';
    this.code = code; // TIMEOUT | ENGINE_EXIT | BAD_RESPONSE | BAD_ID | RECOVERY_FAILED | ...
  }
}

function toId(id) {
  const n = Number(id);
  if (!Number.isInteger(n) || n < 1 || n > MAX_ID) {
    throw new EngineError('BAD_ID', `orderId không hợp lệ: ${id}`);
  }
  return n;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

class QueueEngineClient {
  /**
   * @param {object}   opts
   * @param {string}   opts.enginePath      đường dẫn file chạy (vd ./queue_engine hoặc ./queue_engine.exe)
   * @param {Function} opts.getPendingIds   async () => number[]  (đơn PENDING, đúng thứ tự) - TV3
   * @param {number}   [opts.timeoutMs]     thời gian chờ mỗi phản hồi
   * @param {number}   [opts.startupTimeoutMs] thời gian chờ dòng READY
   * @param {number}   [opts.maxRecoveryAttempts]
   */
  constructor({
    enginePath,
    getPendingIds,
    timeoutMs = 3000,
    startupTimeoutMs = 5000,
    maxRecoveryAttempts = 3,
    logger = console,
  }) {
    if (!enginePath) throw new Error('Thiếu enginePath');
    if (typeof getPendingIds !== 'function') throw new Error('Thiếu getPendingIds');
    this.enginePath = enginePath;
    this.getPendingIds = getPendingIds;
    this.timeoutMs = timeoutMs;
    this.startupTimeoutMs = startupTimeoutMs;
    this.maxRecoveryAttempts = maxRecoveryAttempts;
    this.logger = logger;

    this._proc = null;
    this._waiter = null; // { resolve, reject, timer }: đúng một lệnh chờ phản hồi
    this._tail = Promise.resolve(); // chuỗi Promise để tuần tự hóa lệnh
    this._ready = null;
    this._recovering = false;
    this._stopping = false;
  }

  // ---------- Vòng đời ----------

  /** Gọi một lần khi server khởi động. Spawn Engine, CLEAR, nạp lại đơn PENDING. */
  start() {
    return this._beginRecovery();
  }

  async stop() {
    this._stopping = true;
    const proc = this._proc;
    this._proc = null;
    if (!proc || proc.exitCode !== null) return;
    await new Promise((resolve) => {
      const killer = setTimeout(() => proc.kill(), 2000);
      proc.once('exit', () => {
        clearTimeout(killer);
        resolve();
      });
      proc.stdin.end(); // Engine thấy EOF sẽ tự giải phóng bộ nhớ và thoát mã 0
    });
  }

  // ---------- API cấp cao ----------

  async enqueue(id) {
    const res = await this.send(`ENQ ${toId(id)}`);
    if (res !== 'OK') throw new EngineError('BAD_ID', `Engine từ chối ENQ ${id}: ${res}`);
  }

  /** @returns {Promise<number|null>} id đầu hàng, hoặc null nếu hàng rỗng */
  async dequeue() {
    const res = await this.send('DEQ');
    return res === 'EMPTY' ? null : Number(res.slice(3));
  }

  async peek() {
    const res = await this.send('PEEK');
    return res === 'EMPTY' ? null : Number(res.slice(3));
  }

  async size() {
    const res = await this.send('SIZE');
    return Number(res.slice(5));
  }

  async clear() {
    await this.send('CLEAR');
  }

  /**
   * Xử lý đơn tiếp theo (lazy deletion).
   * tryApprove(id) phải chạy: UPDATE ... SET status='APPROVED' WHERE id=? AND status='PENDING'
   * và trả true khi đúng 1 dòng bị thay đổi (affectedRows === 1).
   * @returns {Promise<number|null>} id đã duyệt, hoặc null nếu không còn đơn hợp lệ
   */
  async approveNext(tryApprove) {
    for (;;) {
      const id = await this.dequeue();
      if (id === null) return null;
      if (await tryApprove(id)) return id;
      // đơn đã hủy / đã xử lý: bỏ qua, lấy đơn kế tiếp
    }
  }

  // ---------- Gửi lệnh (đã tuần tự hóa) ----------

  /** Gửi một dòng lệnh, trả về đúng một dòng phản hồi đã được xác thực. */
  send(command) {
    const task = async () => {
      try {
        await this._ready;
      } catch (_) {
        await this._beginRecovery(); // lần khôi phục trước thất bại -> thử lại
      }
      return this._exchange(command);
    };
    const result = this._tail.then(task);
    this._tail = result.catch(() => {}); // chuỗi không bao giờ bị reject
    return result;
  }

  // ---------- Nội bộ ----------

  async _exchange(command) {
    if (!this._proc) throw new EngineError('ENGINE_EXIT', 'Engine không chạy');
    const name = command.split(' ')[0];
    const rule = RESPONSES[name];
    const waiting = this._waitLine(this.timeoutMs);
    this._proc.stdin.write(`${command}\n`);
    const line = await waiting;
    if (!rule || !rule.test(line)) {
      const err = new EngineError('BAD_RESPONSE', `Phản hồi lạ cho "${command}": "${line}"`);
      this._onFault(this._proc, err); // lệch pha với Engine -> khôi phục cho chắc
      throw err;
    }
    return line;
  }

  _waitLine(ms) {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this._onFault(
          this._proc,
          new EngineError('TIMEOUT', `Engine không trả lời sau ${ms}ms`)
        );
      }, ms);
      this._waiter = { resolve, reject, timer };
    });
  }

  _onLine(proc, line) {
    if (proc !== this._proc) return;
    const w = this._waiter;
    if (!w) {
      this._onFault(proc, new EngineError('BAD_RESPONSE', `Engine tự in dòng ngoài lệnh: "${line}"`));
      return;
    }
    this._waiter = null;
    clearTimeout(w.timer);
    w.resolve(line);
  }

  /** Mọi sự cố (thoát, lỗi pipe, timeout, phản hồi lạ) đi qua đây. */
  _onFault(proc, err) {
    if (!proc || proc !== this._proc) return; // tiến trình cũ, bỏ qua
    this._proc = null;
    try {
      proc.kill();
    } catch (_) {}
    const w = this._waiter;
    if (w) {
      this._waiter = null;
      clearTimeout(w.timer);
      w.reject(err);
    }
    this.logger.error(`[queue] sự cố Engine: ${err.message}`);
    if (!this._stopping && !this._recovering) this._beginRecovery();
  }

  _beginRecovery() {
    if (this._recovering) return this._ready;
    this._recovering = true;
    this._ready = this._recover().finally(() => {
      this._recovering = false;
    });
    this._ready.catch(() => {}); // tránh unhandled rejection; send() sẽ tự xử lý
    return this._ready;
  }

  async _recover() {
    let lastErr;
    for (let attempt = 1; attempt <= this.maxRecoveryAttempts; attempt++) {
      try {
        await this._spawnEngine();
        await this._exchange('CLEAR');
        const ids = await this.getPendingIds(); // đã ORDER BY created_at ASC, id ASC
        for (const id of ids) {
          const res = await this._exchange(`ENQ ${toId(id)}`);
          if (res !== 'OK') throw new EngineError('BAD_RESPONSE', `ENQ ${id} -> ${res}`);
        }
        this.logger.log(`[queue] sẵn sàng, đã nạp ${ids.length} đơn PENDING`);
        return;
      } catch (err) {
        lastErr = err;
        this.logger.error(`[queue] khôi phục lần ${attempt} thất bại: ${err.message}`);
        this._killEngine();
        await sleep(500 * attempt);
      }
    }
    throw new EngineError('RECOVERY_FAILED', `Không khôi phục được Engine: ${lastErr && lastErr.message}`);
  }

  _killEngine() {
    const proc = this._proc;
    this._proc = null;
    if (proc) {
      try {
        proc.kill();
      } catch (_) {}
    }
    if (this._waiter) {
      clearTimeout(this._waiter.timer);
      this._waiter = null;
    }
  }

  _spawnEngine() {
    return new Promise((resolve, reject) => {
      const proc = spawn(this.enginePath, [], { stdio: ['pipe', 'pipe', 'inherit'] });
      this._proc = proc;

      const rl = readline.createInterface({ input: proc.stdout });
      rl.on('line', (line) => this._onLine(proc, line.trim()));
      proc.stdin.on('error', (err) => this._onFault(proc, err));
      proc.on('error', (err) => this._onFault(proc, err)); // không spawn được
      proc.on('exit', (code, sig) =>
        this._onFault(proc, new EngineError('ENGINE_EXIT', `Engine thoát (code=${code}, signal=${sig})`))
      );

      this._waitLine(this.startupTimeoutMs)
        .then((line) => {
          if (line !== 'READY') throw new EngineError('BAD_RESPONSE', `Mong đợi READY, nhận "${line}"`);
        })
        .then(resolve, reject);
    });
  }
}

module.exports = { QueueEngineClient, EngineError };

