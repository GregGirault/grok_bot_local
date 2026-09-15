const { contextBridge } = require('electron');
const os = require('os');

contextBridge.exposeInMainWorld('gbHost', {
  probe() {
    const cpus = os.cpus();
    return {
      platform: os.platform(),
      arch: os.arch(),
      hostname: os.hostname(),
      cpuModel: cpus[0] ? cpus[0].model : '',
      cpuCount: cpus.length,
      totalMemGb: Math.round((os.totalmem() / 1024 ** 3) * 10) / 10,
    };
  },
});
