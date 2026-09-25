/**
 * =============================================================================
 * PRODUCCIÓN MASTER VIDEO 2 (CUSTOM AGENTS) CON LA VOZ OFICIAL DEL VIDEO 1
 * =============================================================================
 * - Misma voz ejecutiva de Video 1:
 *   * Español: es-US-AlonsoNeural (+2% rate)
 *   * Inglés: en-US-AndrewMultilingualNeural (+2% rate)
 * - Mismo procesamiento limpio sin ruidos ni compresión artificial
 * - Sincronización orgánica escena por escena (+0.8s respiración natural)
 * - Color grading cinematográfico 16:9 cálido (ámbar / ISO 1500)
 * - Logo Corporativo Dorado ('B / A' Boltech Group) en esquina superior izquierda
 * =============================================================================
 */

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

const WORK_DIR = path.resolve('video-exec/video2_master_voice1');
if (!fs.existsSync(WORK_DIR)) fs.mkdirSync(WORK_DIR, { recursive: true });

const SCENES_DIR = path.resolve('assets/videos/scenes');
const OUTPUT_DIR = path.resolve('assets/videos');
const LOGO_PATH = path.resolve('assets/brand/boltech_logo_emblem_gold.png');

// Guiones optimizados con fonética calibrada para Video 2
const SCENES_ES = [
  {
    id: 1,
    file: 'scene1_intro_logo.jpg',
    text: "Boltech Group presenta: Agentes a la Medida."
  },
  {
    id: 2,
    file: 'scene2_manager_bottleneck.jpg',
    text: "Medianoche en la oficina. Cientos de consultas comerciales sin responder y cotizaciones varadas por procesos manuales lentos."
  },
  {
    id: 3,
    file: 'scene3_team_overwhelmed.jpg',
    text: "Estos cuellos de botella queman miles de dólares cada semana. Contratar más personal infla la nómina; no hacer nada destruye el flujo de caja."
  },
  {
    id: 4,
    file: 'scene4_agent_deployment.jpg',
    text: "La solución: desplegar Agentes a la Medida de Boltech Group. Conectados a tus herramientas, transforman tareas lentas en automatización continua de alta precisión."
  },
  {
    id: 5,
    file: 'scene5_deal_closed_handshake.jpg',
    text: "A la mañana siguiente: respuestas en ocho segundos, cotizaciones automáticas y operaciones fluidas las veinticuatro horas sin nómina humana."
  },
  {
    id: 6,
    file: 'scene6_outro_cta.jpg',
    text: "Erradica los cuellos de botella de tu empresa hoy mismo. Activa tu agente en la nube con nuestra garantía incondicional de siete días en boltech guión group punto vercel punto app. Boltech Group."
  }
];

const SCENES_EN = [
  {
    id: 1,
    file: 'scene1_intro_logo.jpg',
    text: "Boltech Group presents: Custom Tailored AI Agents."
  },
  {
    id: 2,
    file: 'scene2_manager_bottleneck.jpg',
    text: "Midnight at the office. Hundreds of unanswered customer chats and delayed quotes trapped in slow manual procedures."
  },
  {
    id: 3,
    file: 'scene3_team_overwhelmed.jpg',
    text: "These bottlenecks burn thousands of dollars every week. Hiring more staff inflates payroll; doing nothing drains bottom-line cash flow."
  },
  {
    id: 4,
    file: 'scene4_agent_deployment.jpg',
    text: "The solution: deploy Boltech Group's Custom Tailored Agents. Connected to your tools, they turn slow tasks into high-precision automated workflows."
  },
  {
    id: 5,
    file: 'scene5_deal_closed_handshake.jpg',
    text: "Next morning: eight-second replies, instant precision quotes, and seamless operations running 24/7 with zero human toil."
  },
  {
    id: 6,
    file: 'scene6_outro_cta.jpg',
    text: "Eradicate office bottlenecks today. Launch your cloud agent with our unconditional seven-day guarantee at boltech dash group dot vercel dot app. Boltech Group."
  }
];

async function generateAllVoices() {
  console.log('🎙️ [AUDIO]: Generando locuciones con la voz oficial del Video 1...');

  for (const s of SCENES_ES) {
    const outFile = path.join(WORK_DIR, `audio_es_${s.id}.mp3`);
    console.log(`  - Locución ES (Voz Video 1: es-US-AlonsoNeural) Escena ${s.id}...`);
    execSync(`edge-tts --voice es-US-AlonsoNeural --rate=+2% --text "${s.text}" --write-media "${outFile}"`, { stdio: 'inherit' });
  }

  for (const s of SCENES_EN) {
    const outFile = path.join(WORK_DIR, `audio_en_${s.id}.mp3`);
    console.log(`  - Locución EN (Voz Video 1: en-US-AndrewMultilingualNeural) Escena ${s.id}...`);
    execSync(`edge-tts --voice en-US-AndrewMultilingualNeural --rate=+2% --text "${s.text}" --write-media "${outFile}"`, { stdio: 'inherit' });
  }
}

function getAudioDuration(filePath) {
  try {
    const out = execSync(`ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${filePath}"`, { encoding: 'utf8' });
    return parseFloat(out.trim()) || 12.0;
  } catch (e) {
    return 12.0;
  }
}

async function renderVideo2(lang = 'es') {
  console.log(`\n🎬 [VIDEO 2]: Renderizando (${lang.toUpperCase()}) en Calidad Cinematográfica 16:9 con Logo...`);
  const scenes = lang === 'es' ? SCENES_ES : SCENES_EN;
  const clipFiles = [];

  for (let i = 0; i < scenes.length; i++) {
    const s = scenes[i];
    const imgPath = path.join(SCENES_DIR, s.file);
    const audioPath = path.join(WORK_DIR, `audio_${lang}_${s.id}.mp3`);
    const audioDuration = getAudioDuration(audioPath);
    const clipDuration = audioDuration + 0.8; // Time frame orgánico con respiro
    const clipOut = path.join(WORK_DIR, `clip_${lang}_${s.id}.mp4`);

    console.log(`  > Escena ${s.id}: Audio ${audioDuration.toFixed(2)}s | Clip ${clipDuration.toFixed(2)}s...`);
    
    // Filtro cinematográfico 1080p idéntico a Video 1
    const vf = `scale=1920:1080:force_original_aspect_ratio=increase,crop=1920:1080,eq=contrast=1.06:brightness=0.01:saturation=1.12,format=yuv420p`;

    const cmd = `ffmpeg -y -loop 1 -i "${imgPath}" -i "${audioPath}" -c:v libx264 -preset medium -crf 18 -tune stillimage -c:a aac -b:a 192k -pix_fmt yuv420p -t ${clipDuration} -vf "${vf}" -shortest "${clipOut}"`;
    execSync(cmd, { stdio: 'inherit' });
    clipFiles.push(clipOut);
  }

  // Concatenación de clips
  const concatTxt = path.join(WORK_DIR, `concat_${lang}.txt`);
  fs.writeFileSync(concatTxt, clipFiles.map(f => `file '${f.replace(/\\/g, '/')}'`).join('\n'), 'utf8');

  const rawVideo = path.join(WORK_DIR, `raw_${lang}.mp4`);
  execSync(`ffmpeg -y -f concat -safe 0 -i "${concatTxt}" -c copy "${rawVideo}"`, { stdio: 'inherit' });

  // Estampar el Logo Corporativo Dorado en la esquina superior izquierda
  console.log(`  🌟 Aplicando Logo Corporativo Dorado en la esquina superior izquierda (overlay=40:40)...`);
  const brandedWorkOut = path.join(WORK_DIR, `branded_${lang}.mp4`);
  
  const stampCmd = `ffmpeg -y -i "${rawVideo}" -i "${LOGO_PATH}" -filter_complex "[0:v]format=yuv420p[base];[1:v]scale=240:-1[logo];[base][logo]overlay=40:40,format=yuv420p[out]" -map "[out]" -map 0:a? -c:v libx264 -preset medium -crf 18 -pix_fmt yuv420p -movflags +faststart -c:a aac -b:a 192k "${brandedWorkOut}"`;
  execSync(stampCmd, { stdio: 'inherit' });

  // Copias de destino para la aplicación
  if (lang === 'es') {
    const targetEs = path.join(OUTPUT_DIR, 'gerente_bottleneck_agente_es.mp4');
    const targetMaster = path.join(OUTPUT_DIR, 'gerente_bottleneck_agente.mp4');
    fs.copyFileSync(brandedWorkOut, targetEs);
    fs.copyFileSync(brandedWorkOut, targetMaster);
    console.log(`  ✅ Video 2 (ES) exportado a: ${targetEs} y ${targetMaster}`);
  } else {
    const targetEn = path.join(OUTPUT_DIR, 'gerente_bottleneck_agente_en.mp4');
    fs.copyFileSync(brandedWorkOut, targetEn);
    console.log(`  ✅ Video 2 (EN) exportado a: ${targetEn}`);
  }
}

async function main() {
  console.log('================================================================');
  console.log('  SINCRONIZACIÓN VOCAL MASTER: VIDEO 2 CON LA VOZ DEL VIDEO 1');
  console.log('================================================================\n');

  await generateAllVoices();
  await renderVideo2('es');
  await renderVideo2('en');

  console.log('\n🎉 [PROCESO COMPLETADO AL 100%: VIDEO 2 CON VOZ Y CALIDAD DE VIDEO 1]');
}

main().catch(err => {
  console.error('❌ Error durante la renderización:', err);
  process.exit(1);
});
