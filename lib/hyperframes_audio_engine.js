/**
 * =============================================================================
 * HYPERFRAMES AUDIO ENGINE (WEB AUDIO GRAPH + FX CHAIN & AUTOMATION RUNTIME)
 * =============================================================================
 * Interpreta nativamente los atributos:
 *   - data-fx-chain: Cadena de efectos DSP (highpass, peaking, compressor, limiter, gain)
 *   - data-automation: Curvas de automatización de parámetros en el tiempo
 * Diseñado para voz directa, nítida y con presencia, sin fade-in ni fade-out abruptos.
 */

class HyperFramesAudioEngine {
  constructor() {
    this.ctx = null;
    this.nodes = new Map();
    this.isInitialized = false;
  }

  init() {
    if (this.isInitialized) return;
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return;
    this.ctx = new AudioContextClass();
    this.isInitialized = true;
  }

  attachAudioElement(audioEl) {
    if (!this.ctx) this.init();
    if (!this.ctx || this.nodes.has(audioEl)) return;

    try {
      const source = this.ctx.createMediaElementSource(audioEl);
      let lastNode = source;
      const chainData = audioEl.getAttribute('data-fx-chain');
      const automationData = audioEl.getAttribute('data-automation');

      const effectNodes = [];

      if (chainData) {
        const effects = JSON.parse(chainData);
        effects.forEach(fx => {
          let node = null;
          if (fx.type === 'highpass' || fx.type === 'lowpass' || fx.type === 'peaking' || fx.type === 'notch') {
            node = this.ctx.createBiquadFilter();
            node.type = fx.type;
            if (fx.frequency) node.frequency.value = fx.frequency;
            if (fx.gain && node.gain) node.gain.value = fx.gain;
            if (fx.q && node.Q) node.Q.value = fx.q;
          } else if (fx.type === 'gain') {
            node = this.ctx.createGain();
            node.gain.value = fx.gain !== undefined ? fx.gain : 1.0;
          } else if (fx.type === 'compressor') {
            node = this.ctx.createDynamicsCompressor();
            if (fx.threshold !== undefined) node.threshold.value = fx.threshold;
            if (fx.ratio !== undefined) node.ratio.value = fx.ratio;
            if (fx.attack !== undefined) node.attack.value = fx.attack;
            if (fx.release !== undefined) node.release.value = fx.release;
          } else if (fx.type === 'limiter') {
            node = this.ctx.createDynamicsCompressor();
            node.threshold.value = fx.ceiling !== undefined ? fx.ceiling : -1.0;
            node.ratio.value = 20.0; // Hard limiting
            node.attack.value = 0.003;
            node.release.value = 0.050;
          }

          if (node) {
            lastNode.connect(node);
            lastNode = node;
            effectNodes.push({ type: fx.type, node });
          }
        });
      }

      // Conectar al destino final
      lastNode.connect(this.ctx.destination);

      // Aplicar automatización si existe
      if (automationData) {
        const autoConfig = JSON.parse(automationData);
        audioEl.addEventListener('play', () => {
          const startTime = this.ctx.currentTime;
          Object.keys(autoConfig).forEach(param => {
            const points = autoConfig[param];
            // Buscar el nodo gain
            const gainFx = effectNodes.find(e => e.type === 'gain');
            if (gainFx && param === 'gain') {
              const gainParam = gainFx.node.gain;
              gainParam.cancelScheduledValues(startTime);
              points.forEach(pt => {
                gainParam.linearRampToValueAtTime(pt.value, startTime + pt.time);
              });
            }
          });
        });
      }

      this.nodes.set(audioEl, { source, effectNodes, lastNode });
    } catch (e) {
      console.warn('[HyperFrames Audio] No fue posible enlazar Web Audio graph:', e);
    }
  }

  scanAndAttach() {
    document.querySelectorAll('audio[data-fx-chain], video[data-fx-chain]').forEach(el => {
      this.attachAudioElement(el);
    });
  }
}

// Exportar para navegador o módulo
if (typeof window !== 'undefined') {
  window.HyperFramesAudio = new HyperFramesAudioEngine();
  document.addEventListener('DOMContentLoaded', () => {
    // Escuchar el primer clic del usuario para desbloquear el AudioContext
    const unlockAudio = () => {
      window.HyperFramesAudio.init();
      window.HyperFramesAudio.scanAndAttach();
      window.removeEventListener('click', unlockAudio);
      window.removeEventListener('keydown', unlockAudio);
    };
    window.addEventListener('click', unlockAudio);
    window.addEventListener('keydown', unlockAudio);
  });
}

export default HyperFramesAudioEngine;
