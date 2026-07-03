const { spawn } = require('child_process');
const readline = require('readline');

let ngrokProcess = null;

// Menjalankan `ngrok http <port> --log=stdout --log-format=json` sebagai child process
// dari backend (bukan window terminal terpisah). Output JSON di-parse untuk ambil
// public URL, lalu di-print ke console backend yang sama.
function startNgrok(port) {
  return new Promise((resolve, reject) => {
    const domain = (process.env.NGROK_DOMAIN || '').trim();
    const region = (process.env.NGROK_REGION || '').trim();

    const args = ['http', String(port), '--log=stdout', '--log-format=json'];
    if (domain) args.push(`--domain=${domain}`);
    if (region) args.push(`--region=${region}`);

    ngrokProcess = spawn('ngrok', args);

    const rl = readline.createInterface({ input: ngrokProcess.stdout });
    let resolved = false;

    rl.on('line', (line) => {
      let entry;
      try {
        entry = JSON.parse(line);
      } catch {
        return; // baris non-JSON, abaikan
      }

      if (entry.msg === 'started tunnel' && entry.url) {
        if (!resolved) {
          resolved = true;
          resolve(entry.url);
        }
      }

      if (entry.lvl === 'eror' || entry.err) {
        console.error('[NGROK ERROR]', entry.msg || entry.err);
        if (!resolved) {
          resolved = true;
          reject(new Error(entry.msg || entry.err || 'ngrok failed to start'));
        }
      }
    });

    ngrokProcess.stderr.on('data', (data) => {
      console.error('[NGROK STDERR]', data.toString().trim());
    });

    ngrokProcess.on('error', (err) => {
      if (!resolved) {
        resolved = true;
        reject(err);
      }
    });

    ngrokProcess.on('exit', (code) => {
      if (code !== 0 && code !== null) {
        console.warn(`[NGROK] Process exited with code ${code}`);
      }
      ngrokProcess = null;
    });

    // Timeout jaga-jaga jika ngrok tidak merespon dalam 20s
    setTimeout(() => {
      if (!resolved) {
        resolved = true;
        reject(new Error('ngrok timeout: tidak ada tunnel URL dalam 20 detik'));
      }
    }, 20000);
  });
}

function stopNgrok() {
  if (ngrokProcess) {
    ngrokProcess.kill();
    ngrokProcess = null;
  }
}

module.exports = { startNgrok, stopNgrok };
