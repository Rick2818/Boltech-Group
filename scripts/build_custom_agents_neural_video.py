import asyncio
import os
import sys
import subprocess
import edge_tts

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')

WORK_DIR = os.path.abspath("video-exec/custom_agents_neural_75s")
os.makedirs(WORK_DIR, exist_ok=True)
OUTPUT_DIR = os.path.abspath("assets/videos")
SCENES_DIR = os.path.abspath("assets/videos/scenes")

# =========================================================================
# 1. GUIONES Y DEFINICIÓN DE ESCENAS (75 SEGUNDOS TOTAL)
# =========================================================================
SCENES_ES = [
    {
        "id": 1,
        "duration": 6,
        "delay": 0.5,
        "text": "Boltech Group presenta: Agentes a la Medida.",
        "bgImg": os.path.join(SCENES_DIR, "scene1_intro_logo.jpg")
    },
    {
        "id": 2,
        "duration": 12,
        "delay": 6.5,
        "text": "Medianoche en la oficina. Cientos de consultas comerciales sin responder y cotizaciones varadas por procesos manuales lentos.",
        "bgImg": os.path.join(SCENES_DIR, "scene2_manager_bottleneck.jpg")
    },
    {
        "id": 3,
        "duration": 12,
        "delay": 18.5,
        "text": "Estos cuellos de botella queman miles de dólares cada semana. Contratar más personal infla la nómina; no hacer nada destruye el flujo de caja.",
        "bgImg": os.path.join(SCENES_DIR, "scene3_team_overwhelmed.jpg")
    },
    {
        "id": 4,
        "duration": 15,
        "delay": 30.5,
        "text": "La solución: desplegar Agentes a la Medida de Boltech Group. Conectados a tus herramientas, transforman tareas lentas en automatización continua de alta precisión.",
        "bgImg": os.path.join(SCENES_DIR, "scene4_agent_deployment.jpg")
    },
    {
        "id": 5,
        "duration": 15,
        "delay": 45.5,
        "text": "A la mañana siguiente: respuestas en ocho segundos, cotizaciones automáticas y operaciones fluidas las veinticuatro horas sin nómina humana.",
        "bgImg": os.path.join(SCENES_DIR, "scene5_deal_closed_handshake.jpg")
    },
    {
        "id": 6,
        "duration": 15,
        "delay": 60.5,
        "text": "Erradica los cuellos de botella de tu empresa hoy mismo. Activa tu agente en la nube con nuestra garantía incondicional de siete días en boltech guión group punto vercel punto app. Boltech Group.",
        "bgImg": os.path.join(SCENES_DIR, "scene6_outro_cta.jpg")
    }
]

SCENES_EN = [
    {
        "id": 1,
        "duration": 6,
        "delay": 0.5,
        "text": "Boltech Group presents: Custom Tailored AI Agents.",
        "bgImg": os.path.join(SCENES_DIR, "scene1_intro_logo.jpg")
    },
    {
        "id": 2,
        "duration": 12,
        "delay": 6.5,
        "text": "Midnight at the office. Hundreds of unanswered customer chats and delayed quotes trapped in slow manual procedures.",
        "bgImg": os.path.join(SCENES_DIR, "scene2_manager_bottleneck.jpg")
    },
    {
        "id": 3,
        "duration": 12,
        "delay": 18.5,
        "text": "These bottlenecks burn thousands of dollars every week. Hiring more staff inflates payroll; doing nothing drains bottom-line cash flow.",
        "bgImg": os.path.join(SCENES_DIR, "scene3_team_overwhelmed.jpg")
    },
    {
        "id": 4,
        "duration": 15,
        "delay": 30.5,
        "text": "The solution: deploy Boltech Group's Custom Tailored Agents. Connected to your tools, they turn slow tasks into high-precision automated workflows.",
        "bgImg": os.path.join(SCENES_DIR, "scene4_agent_deployment.jpg")
    },
    {
        "id": 5,
        "duration": 15,
        "delay": 45.5,
        "text": "Next morning: eight-second replies, instant precision quotes, and seamless operations running 24/7 with zero human toil.",
        "bgImg": os.path.join(SCENES_DIR, "scene5_deal_closed_handshake.jpg")
    },
    {
        "id": 6,
        "duration": 15,
        "delay": 60.5,
        "text": "Eradicate office bottlenecks today. Launch your cloud agent with our unconditional seven-day guarantee at boltech dash group dot vercel dot app. Boltech Group.",
        "bgImg": os.path.join(SCENES_DIR, "scene6_outro_cta.jpg")
    }
]

# =========================================================================
# 2. GENERACIÓN DE AUDIO NEURAL CON LOCUCIÓN MASTERIZADA & ECUALIZADA
# =========================================================================
async def generate_speech_clips(scenes, lang, voice, rate="+2%"):
    print(f"🎙️ [LOCUCIÓN NEURAL]: Generando clips {lang.upper()} con voz {voice}...")
    clip_files = []
    for s in scenes:
        out_raw_mp3 = os.path.join(WORK_DIR, f"scene_{s['id']}_{lang}_raw.mp3")
        out_master_wav = os.path.join(WORK_DIR, f"scene_{s['id']}_{lang}_master.wav")
        
        # 1. Síntesis Neural
        comm = edge_tts.Communicate(s['text'], voice, rate=rate)
        await comm.save(out_raw_mp3)
        
        # 2. Masterización y Ecualización Broadcast Stereo 48kHz
        # (Highpass 80Hz, EQ presencia 3.2kHz +2.5dB, compand con compresión dinámica profesional, salida estéreo 48kHz)
        eq_filter = (
            "aformat=sample_fmts=fltp:sample_rates=48000:channel_layouts=stereo,"
            "highpass=f=80,equalizer=f=3200:t=q:w=1.2:g=2.8,"
            "compand=attacks=0.03:decays=0.15:points=-80/-80|-45/-30|-20/-8|0/-1.5:soft-knee=6,"
            "volume=1.45"
        )
        subprocess.run([
            "ffmpeg", "-y", "-i", out_raw_mp3,
            "-af", eq_filter,
            "-ar", "48000", "-ac", "2",
            out_master_wav
        ], check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        
        # Medir duración exacta
        dur = float(subprocess.check_output([
            "ffprobe", "-v", "error", "-show_entries", "format=duration",
            "-of", "default=noprint_wrappers=1:nokey=1", out_master_wav
        ]).decode().strip())
        
        clip_files.append({"path": out_master_wav, "duration": dur})
        print(f"  ✓ Escena {s['id']} ({lang}) generada: {dur:.2f}s (Inicia en {s['delay']}s)")
        
    return clip_files

def mix_master_audio(scenes, clip_files, lang, out_audio_path):
    print(f"🎛️ [MEZCLA MASTER]: Ensamblando pista de audio estéreo cinematográfica {lang.upper()} (75s)...")
    bg_bed = os.path.join(WORK_DIR, "ambient_bed_master_stereo_75s.wav")
    
    # Cama musical cinematográfica cálida con acordes mayores, reverb estéreo y calidez
    if not os.path.exists(bg_bed):
        synth_cmd = [
            "ffmpeg", "-y",
            "-f", "lavfi", "-i", "sine=frequency=110:duration=75",
            "-f", "lavfi", "-i", "sine=frequency=220:duration=75",
            "-f", "lavfi", "-i", "sine=frequency=329.63:duration=75",
            "-f", "lavfi", "-i", "sine=frequency=440:duration=75",
            "-filter_complex",
            "[0:a]volume=0.20[a0];[1:a]volume=0.12[a1];[2:a]volume=0.09[a2];[3:a]volume=0.05[a3];"
            "[a0][a1][a2][a3]amix=inputs=4,aformat=sample_rates=48000:channel_layouts=stereo,lowpass=f=750,aecho=0.8:0.88:60:0.4,volume=0.15,"
            "afade=t=in:ss=0:d=2.5,afade=t=out:st=71.5:d=3.5[out]",
            "-map", "[out]",
            "-ar", "48000", "-ac", "2",
            bg_bed
        ]
        subprocess.run(synth_cmd, check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)

    inputs = ["-i", bg_bed]
    filter_parts = ["[0:a]volume=0.15[bg]"]
    mix_inputs = ["[bg]"]

    for idx, s in enumerate(scenes):
        clip = clip_files[idx]
        inputs.extend(["-i", clip["path"]])
        in_idx = idx + 1
        delay_ms = int(round(s["delay"] * 1000))
        # Fade in sutil al inicio de cada frase, delay estéreo y ganancia sólida
        filter_parts.append(f"[{in_idx}:a]afade=t=in:ss=0:d=0.06,adelay={delay_ms}|{delay_ms},volume=2.0[v{s['id']}]")
        mix_inputs.append(f"[v{s['id']}]")

    filter_complex = f"{';'.join(filter_parts)};{''.join(mix_inputs)}amix=inputs={len(scenes) + 1}:dropout_transition=0:normalize=0,alimiter=limit=0.98[out]"
    mix_cmd = ["ffmpeg", "-y"] + inputs + [
        "-filter_complex", filter_complex,
        "-map", "[out]",
        "-t", "75",
        "-ar", "48000",
        "-ac", "2",
        out_audio_path
    ]
    subprocess.run(mix_cmd, check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    print(f"  ✓ Audio final {lang.upper()} masterizado en Estéreo 48kHz.")

# =========================================================================
# 3. RENDERIZADO VISUAL CINEMATOGRÁFICO 1080P (KEN BURNS SUAVE)
# =========================================================================
def render_scene_clip(img_path, duration, out_clip_path, zoom_direction="in"):
    total_frames = int(duration * 25)
    if zoom_direction == "in":
        zoom_expr = "min(zoom+0.00035,1.08)"
    else:
        zoom_expr = "if(eq(on,1),1.08,max(1.0,zoom-0.00035))"
        
    vf = (
        f"scale=1920:1080:force_original_aspect_ratio=increase,crop=1920:1080,"
        f"zoompan=z='{zoom_expr}':d={total_frames}:s=1920x1080:fps=25"
    )
    cmd = [
        "ffmpeg", "-y",
        "-loop", "1",
        "-t", str(duration),
        "-i", img_path,
        "-vf", vf,
        "-c:v", "libx264",
        "-pix_fmt", "yuv420p",
        "-r", "25",
        "-preset", "faster",
        "-crf", "18",
        "-t", str(duration),
        out_clip_path
    ]
    subprocess.run(cmd, check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)

def render_full_visual_video(scenes, out_video_path):
    print("🎬 [VIDEO]: Renderizando 6 escenas visuales en alta definición 1080p...")
    scene_clips = []
    directions = ["in", "out", "in", "out", "in", "out"]
    
    for idx, s in enumerate(scenes):
        clip_path = os.path.join(WORK_DIR, f"scene_clip_{s['id']}.mp4")
        print(f"  - Escena {s['id']} ({s['duration']}s): {os.path.basename(s['bgImg'])}...")
        render_scene_clip(s['bgImg'], s['duration'], clip_path, directions[idx])
        scene_clips.append(clip_path)

    concat_txt = os.path.join(WORK_DIR, "scenes_list.txt")
    with open(concat_txt, "w", encoding="utf-8") as f:
        for c in scene_clips:
            f.write(f"file '{c.replace(os.sep, '/')}'\n")

    print("🎞️ [ENSAMBLE]: Concatenando secuencia visual pura (75s)...")
    concat_cmd = [
        "ffmpeg", "-y",
        "-f", "concat",
        "-safe", "0",
        "-i", concat_txt,
        "-c", "copy",
        out_video_path
    ]
    subprocess.run(concat_cmd, check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    print("  ✓ Video visual 1080p concatenado.")

# =========================================================================
# 4. PIPELINE MAESTRO
# =========================================================================
async def main():
    print("\n" + "=" * 70)
    print(" 🎬 BOLTECH GROUP • PRODUCCIÓN DEL VIDEO DE AGENTES A LA MEDIDA")
    print("=" * 70 + "\n")

    # 1. Generación de Voces con Dicción Bilingüe y Calidez Ejecutiva
    audio_es = os.path.join(WORK_DIR, "audio_es_master_stereo_75s.wav")
    audio_en = os.path.join(WORK_DIR, "audio_en_master_stereo_75s.wav")
    
    # Voces seleccionadas:
    # - Español: es-US-AlonsoNeural (Voz neural bilingüe ejecutiva, perfecta pronunciación de Boltech Group, Cloud, Enterprise)
    # - Inglés: en-US-BrianMultilingualNeural (Voz ejecutiva de Silicon Valley con dicción impecable)
    voice_es = "es-US-AlonsoNeural"
    voice_en = "en-US-BrianMultilingualNeural"

    clips_es = await generate_speech_clips(SCENES_ES, "es", voice_es, rate="+2%")
    mix_master_audio(SCENES_ES, clips_es, "es", audio_es)

    clips_en = await generate_speech_clips(SCENES_EN, "en", voice_en, rate="+2%")
    mix_master_audio(SCENES_EN, clips_en, "en", audio_en)

    # 2. Render de Video Visual 1080p
    video_visual = os.path.join(WORK_DIR, "visual_6scenes_clean_75s.mp4")
    if not os.path.exists(video_visual):
        render_full_visual_video(SCENES_ES, video_visual)
    else:
        print("🎬 [VIDEO]: Video visual 1080p existente reutilizado.")

    # 3. Multiplexado de Archivos Finales para la Web App (Stereo AAC 48kHz +faststart)
    target_es = os.path.join(OUTPUT_DIR, "gerente_bottleneck_agente_es.mp4")
    target_en = os.path.join(OUTPUT_DIR, "gerente_bottleneck_agente_en.mp4")
    target_master = os.path.join(OUTPUT_DIR, "gerente_bottleneck_agente.mp4")

    print("\n📦 [EXPORTACIÓN]: Muxing y codificación AAC Stereo 48kHz +faststart para web en Español...")
    subprocess.run([
        "ffmpeg", "-y",
        "-i", video_visual,
        "-i", audio_es,
        "-c:v", "copy",
        "-c:a", "aac",
        "-b:a", "192k",
        "-ar", "48000",
        "-ac", "2",
        "-movflags", "+faststart",
        "-shortest",
        target_es
    ], check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)

    subprocess.run(["ffmpeg", "-y", "-i", target_es, "-c", "copy", "-movflags", "+faststart", target_master], check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    print(f"  ✓ Exportado: {target_es}")

    print("📦 [EXPORTACIÓN]: Muxing y codificación AAC Stereo 48kHz +faststart para web en Inglés...")
    subprocess.run([
        "ffmpeg", "-y",
        "-i", video_visual,
        "-i", audio_en,
        "-c:v", "copy",
        "-c:a", "aac",
        "-b:a", "192k",
        "-ar", "48000",
        "-ac", "2",
        "-movflags", "+faststart",
        "-shortest",
        target_en
    ], check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    print(f"  ✓ Exportado: {target_en}")

    print("\n" + "=" * 70)
    print(" ✅ VIDEO 2 MASTERIZADO EN ESTÉREO 48KHZ CON ÉXITO: 100% IMPECABLE")
    print("=" * 70 + "\n")

if __name__ == "__main__":
    asyncio.run(main())
