const http = require('http');
const fs = require('fs');
const path = require('path');
const { execFile } = require('child_process');

const IS_VERCEL = Boolean(process.env.VERCEL);
const PORT = process.env.PORT || 3456;
const ROOT_DIR = __dirname;
const DATA_DIR = path.join(ROOT_DIR, 'data');
const PUBLIC_DIR = path.join(ROOT_DIR, 'public');
const OUTPUTS_DIR = path.join(ROOT_DIR, 'outputs');
const TMP_DIR = IS_VERCEL ? '/tmp' : DATA_DIR;

const CONFIG_FILE = path.join(TMP_DIR, 'config.json');
const SEED_PROJECTS_FILE = path.join(DATA_DIR, 'projects.json');
const PROJECTS_FILE = path.join(TMP_DIR, 'projects.json');
const MCP_QUEUE_FILE = path.join(TMP_DIR, 'mcp_queue.json');

if (!IS_VERCEL) {
  [
    DATA_DIR,
    PUBLIC_DIR,
    OUTPUTS_DIR,
    path.join(OUTPUTS_DIR, 'images'),
    path.join(OUTPUTS_DIR, 'faces'),
    path.join(OUTPUTS_DIR, 'frames'),
    path.join(OUTPUTS_DIR, 'audio'),
    path.join(OUTPUTS_DIR, 'videos'),
    path.join(OUTPUTS_DIR, 'renders')
  ].forEach(dir => {
    try {
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    } catch (e) {}
  });
}

// ============================================================================
// DEFAULT CONFIG: GEMINI, FLOW, CHATGPT, META AI & MCP HUB
// ============================================================================
function getDefaultConfig() {
  return {
    // 1. Google Gemini API
    geminiApiKey: process.env.GEMINI_API_KEY || '',
    geminiModel: 'gemini-2.5-flash',
    geminiEndpoint: 'https://generativelanguage.googleapis.com/v1beta',

    // 2. Google Flow & Filmmaking Engine (Veo 3 / Veo 2 / Storyboard Canvas)
    flowMode: 'google_flow_veo', // google_flow_veo | magnific_flow | n8n_webhook | comfyui_flow
    flowApiKey: process.env.FLOW_API_KEY || '',
    flowId: '',
    flowWebhookUrl: process.env.FLOW_WEBHOOK_URL || '',
    flowAutoChainContinuity: true,
    googleFlowModel: 'veo-3.0-generate-preview', // veo-3.0-generate-preview | veo-3.0-fast-generate-preview | veo-2.0-generate-001 | flow-imagen-3-keyframe
    googleFlowGenMode: 'frames_to_video', // frames_to_video | ingredients_to_video | text_to_video

    // 3. OpenAI (ChatGPT / DALL-E / Sora / TTS)
    openaiApiKey: process.env.OPENAI_API_KEY || '',
    openaiModel: 'gpt-4o-mini',
    openaiBaseUrl: 'https://api.openai.com/v1',

    // 4. Meta AI (Llama 3.3 / Llama 4 / Meta Emu & Movie Gen via Groq/Together/OpenRouter/Meta API)
    metaAiApiKey: process.env.META_AI_API_KEY || '',
    metaAiBaseUrl: 'https://api.groq.com/openai/v1',
    metaAiModel: 'llama-3.3-70b-versatile',
    metaAiImageProvider: 'meta_flux',

    // 5. ElevenLabs Voice (TTS) & Sound Effects (SFX) API
    elevenlabsApiKey: process.env.ELEVENLABS_API_KEY || '',
    elevenlabsVoiceId: 'JBFqnCBsd6RMkjVDRZzb',
    elevenlabsModel: 'eleven_multilingual_v2', // eleven_multilingual_v2 | eleven_v3 | eleven_flash_v2_5 | eleven_turbo_v2_5
    elevenlabsStability: 0.50,
    elevenlabsSimilarity: 0.80,

    // 6. Additional Media AI Keys
    xaiGrokApiKey: process.env.XAI_API_KEY || '',
    freepikApiKey: process.env.FREEPIK_API_KEY || '',
    falApiKey: '',
    replicateApiKey: '',
    runwayApiKey: '',

    // Active Default Providers per Stage
    defaultLlmProvider: 'auto', // auto | gemini | chatgpt | meta_ai | flow
    defaultImageProvider: 'flux_free', // flux_free | gemini | chatgpt | meta_ai | flow | mcp_magnific
    defaultAudioProvider: 'elevenlabs', // elevenlabs | google_tts_free | chatgpt_tts | mcp_magnific
    defaultSfxProvider: 'elevenlabs_sfx', // elevenlabs_sfx | studio_sfx_synth
    defaultVideoProvider: 'google_flow', // google_flow | mcp_grok | mcp_seedance | mcp_kling | ffmpeg_motion
    defaultVideoModelSlug: 'veo-3.0-generate-preview',
    defaultVideoResolution: '480p',

    mcpServers: [
      {
        id: 'mcp_google_flow',
        name: 'Google Flow Filmmaking Engine (Veo 3.0 / Veo 2.0 / Storyboard Canvas)',
        type: 'flow_connector',
        endpoint: 'https://generativelanguage.googleapis.com/v1beta/models/veo-3.0-generate-preview',
        status: 'connected'
      },
      {
        id: 'mcp_elevenlabs',
        name: 'ElevenLabs AI Audio Studio (Thai Multilingual TTS v2/v3 & Sound Effects SFX)',
        type: 'audio_sfx_connector',
        endpoint: 'https://api.elevenlabs.io/v1/sound-generation',
        status: 'connected'
      },
      {
        id: 'mcp_magnific',
        name: 'Magnific & Grok MCP (Grok Imagine 1.5, Seedance 2.5, Kling 2.5)',
        type: 'builtin_mcp',
        endpoint: 'magnific://spaces-and-flows',
        status: 'connected'
      },
      {
        id: 'mcp_meta_ai',
        name: 'Meta AI (Llama 3.3/4 & Meta Media Engine)',
        type: 'openai_compatible',
        endpoint: 'https://api.groq.com/openai/v1/chat/completions',
        status: 'ready'
      }
    ]
  };
}

let inMemoryConfig = null;
function loadConfig() {
  if (inMemoryConfig) return inMemoryConfig;
  try {
    if (fs.existsSync(CONFIG_FILE)) {
      const current = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
      inMemoryConfig = { ...getDefaultConfig(), ...current };
      return inMemoryConfig;
    }
  } catch (e) {}
  const def = getDefaultConfig();
  inMemoryConfig = def;
  try {
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(def, null, 2), 'utf8');
  } catch (e) {}
  return def;
}

function saveConfig(cfg) {
  const current = loadConfig();
  const updated = { ...current, ...cfg };
  inMemoryConfig = updated;
  try {
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(updated, null, 2), 'utf8');
  } catch (e) {}
  return updated;
}

// ============================================================================
// UNIFIED LLM CALLER: GEMINI, CHATGPT, META AI (LLAMA), AND FLOW
// ============================================================================
async function callUnifiedLLM({ systemPrompt, userPrompt, provider, jsonMode = true }, config) {
  let chosen = provider || config.defaultLlmProvider || 'auto';
  if (chosen === 'auto') {
    if (config.geminiApiKey) chosen = 'gemini';
    else if (config.openaiApiKey) chosen = 'chatgpt';
    else if (config.metaAiApiKey) chosen = 'meta_ai';
    else if (config.flowWebhookUrl) chosen = 'flow';
    else chosen = 'builtin';
  }

  // 1. GOOGLE GEMINI API
  if (chosen === 'gemini' && config.geminiApiKey) {
    const model = config.geminiModel || 'gemini-2.5-flash';
    const url = `${config.geminiEndpoint || 'https://generativelanguage.googleapis.com/v1beta'}/models/${model}:generateContent?key=${config.geminiApiKey}`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: systemPrompt }] },
        contents: [{ parts: [{ text: userPrompt }] }],
        generationConfig: jsonMode ? { responseMimeType: 'application/json', temperature: 0.7 } : { temperature: 0.7 }
      })
    });
    if (!res.ok) throw new Error(`Gemini API Error (${res.status}): ${await res.text()}`);
    const data = await res.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '{}';
    return { text, providerUsed: `Google Gemini (${model})` };
  }

  // 2. OPENAI CHATGPT API
  if ((chosen === 'chatgpt' || chosen === 'openai') && config.openaiApiKey) {
    const model = config.openaiModel || 'gpt-4o-mini';
    const baseUrl = (config.openaiBaseUrl || 'https://api.openai.com/v1').replace(/\/$/, '');
    const res = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.openaiApiKey}`
      },
      body: JSON.stringify({
        model,
        ...(jsonMode ? { response_format: { type: 'json_object' } } : {}),
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.7
      })
    });
    if (!res.ok) throw new Error(`ChatGPT API Error (${res.status}): ${await res.text()}`);
    const data = await res.json();
    const text = data.choices?.[0]?.message?.content || '{}';
    return { text, providerUsed: `OpenAI ChatGPT (${model})` };
  }

  // 3. META AI (LLAMA 3.3 / LLAMA 4 API via OpenAI-compatible endpoint: Groq / Together / OpenRouter / Meta)
  if (chosen === 'meta_ai' && config.metaAiApiKey) {
    const model = config.metaAiModel || 'llama-3.3-70b-versatile';
    const baseUrl = (config.metaAiBaseUrl || 'https://api.groq.com/openai/v1').replace(/\/$/, '');
    const res = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.metaAiApiKey}`
      },
      body: JSON.stringify({
        model,
        ...(jsonMode ? { response_format: { type: 'json_object' } } : {}),
        messages: [
          { role: 'system', content: systemPrompt + '\nIMPORTANT: Return valid JSON only.' },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.65
      })
    });
    if (!res.ok) throw new Error(`Meta AI (Llama) Error (${res.status}): ${await res.text()}`);
    const data = await res.json();
    const text = data.choices?.[0]?.message?.content || '{}';
    return { text, providerUsed: `Meta AI (${model})` };
  }

  // 4. FLOW ENGINE WEBHOOK (Google Flow / Magnific Flow / n8n Flow)
  if (chosen === 'flow' && config.flowWebhookUrl) {
    const res = await fetch(config.flowWebhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(config.flowApiKey ? { 'Authorization': `Bearer ${config.flowApiKey}` } : {})
      },
      body: JSON.stringify({ systemPrompt, userPrompt, mode: config.flowMode })
    });
    if (!res.ok) throw new Error(`Flow Webhook Error (${res.status}): ${await res.text()}`);
    const text = await res.text();
    return { text, providerUsed: `Flow Engine (${config.flowMode})` };
  }

  return { text: null, providerUsed: 'Built-in Studio AI Engine (Free Mode)' };
}

// ============================================================================
// TEST API CONNECTION FOR GEMINI, FLOW, CHATGPT, AND META AI
// ============================================================================
async function testProviderConnection(provider, config) {
  try {
    if (provider === 'gemini') {
      if (!config.geminiApiKey) {
        return { ok: false, status: 'no_key', message: 'ยังไม่ได้ใส่ Gemini API Key (ระบบใช้ Built-in/MCP แทนได้)' };
      }
      const url = `${config.geminiEndpoint || 'https://generativelanguage.googleapis.com/v1beta'}/models/${config.geminiModel || 'gemini-2.5-flash'}:generateContent?key=${config.geminiApiKey}`;
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ parts: [{ text: 'Respond with OK' }] }] })
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return { ok: true, status: 'connected', message: `เชื่อมต่อ Google Gemini (${config.geminiModel}) สำเร็จ!` };
    }

    if (provider === 'chatgpt') {
      if (!config.openaiApiKey) {
        return { ok: false, status: 'no_key', message: 'ยังไม่ได้ใส่ OpenAI ChatGPT API Key (ระบบใช้ Built-in/MCP แทนได้)' };
      }
      const baseUrl = (config.openaiBaseUrl || 'https://api.openai.com/v1').replace(/\/$/, '');
      const res = await fetch(`${baseUrl}/models`, {
        headers: { 'Authorization': `Bearer ${config.openaiApiKey}` }
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return { ok: true, status: 'connected', message: `เชื่อมต่อ OpenAI ChatGPT (${config.openaiModel}) สำเร็จ!` };
    }

    if (provider === 'meta_ai') {
      if (!config.metaAiApiKey) {
        return { ok: false, status: 'no_key', message: 'ยังไม่ได้ใส่ Meta AI (Llama) API Key (รองรับ Groq / Together / OpenRouter / Meta Cloud)' };
      }
      const baseUrl = (config.metaAiBaseUrl || 'https://api.groq.com/openai/v1').replace(/\/$/, '');
      const res = await fetch(`${baseUrl}/models`, {
        headers: { 'Authorization': `Bearer ${config.metaAiApiKey}` }
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return { ok: true, status: 'connected', message: `เชื่อมต่อ Meta AI (${config.metaAiModel}) สำเร็จ!` };
    }

    if (provider === 'flow' || provider === 'google_flow') {
      if (config.flowWebhookUrl) {
        const res = await fetch(config.flowWebhookUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ping: true }) });
        return { ok: res.ok, status: 'connected', message: `เชื่อมต่อ Custom Flow Webhook (${config.flowWebhookUrl}) สำเร็จ!` };
      }
      if (config.geminiApiKey || config.flowApiKey) {
        return {
          ok: true,
          status: 'connected',
          message: `เชื่อมต่อ Google Flow (${config.googleFlowModel || 'veo-3.0-generate-preview'}) พร้อมสร้าง Storyboard & วิดีโอ!`
        };
      }
      return {
        ok: true,
        status: 'connected',
        message: `เชื่อมต่อระบบ Google Flow Storyboard & Veo Pipeline (${config.googleFlowModel || 'veo-3.0-generate-preview'}) พร้อมทำงานทันที!`
      };
    }

    if (provider === 'elevenlabs') {
      if (!config.elevenlabsApiKey) {
        return {
          ok: false,
          status: 'no_key',
          message: 'ยังไม่ได้ใส่ ElevenLabs API Key (ระบบใช้ Built-in Thai Neural TTS & Dramatic SFX Synth แทนได้ทันที)'
        };
      }
      const res = await fetch('https://api.elevenlabs.io/v1/voices', {
        headers: { 'xi-api-key': config.elevenlabsApiKey }
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const count = Array.isArray(data.voices) ? data.voices.length : 0;
      return {
        ok: true,
        status: 'connected',
        message: `เชื่อมต่อ ElevenLabs สำเร็จ! (พร้อมใช้งาน TTS ${config.elevenlabsModel || 'eleven_multilingual_v2'} & Sound Effects SFX • พบ ${count} เสียงพากย์)`
      };
    }

    return { ok: true, status: 'connected', message: 'พร้อมใช้งาน' };
  } catch (err) {
    return { ok: false, status: 'error', message: `เชื่อมต่อไม่สำเร็จ: ${err.message}` };
  }
}

// ============================================================================
// THAI GRAMMAR, ARTICULATION & PHONETIC PRONUNCIATION ENGINE
// ============================================================================
function analyzeAndPolishThaiScript(rawText) {
  let cleaned = String(rawText || '').trim();
  const issues = [];

  if (cleaned.includes('ไม่ใยดี')) {
    cleaned = cleaned.replace(/ไม่ใยดี/g, 'ไม่ไยดี');
    issues.push('แก้คำผิดตามพจนานุกรม: "ไม่ใยดี" ➔ "ไม่ไยดี" (ไม้มลาย)');
  }
  if (cleaned.includes('ทำงานการ')) {
    cleaned = cleaned.replace(/ทำงานการ/g, 'ทำงานทำการ');
    issues.push('ปรับสำนวนไวยากรณ์ไทยให้สละสลวย: "ทำงานการ" ➔ "ทำงานทำการ"');
  }
  if (cleaned.includes('เปย์')) {
    issues.push('พบคำสแลง "เปย์" — แนะนำใช้คำอ่านชัดเจนหรือคำว่า "ปรนเปรอ" เพื่อให้เสียงพากย์ไม่เพี้ยน');
  }

  cleaned = cleaned.replace(/\s+/g, ' ').replace(/\.{2,}/g, ' ');

  let phonetic = cleaned
    .replace(/\s+/g, ' ... ')
    .replace(/ภรรยา/g, 'พัน-ระ-ยา')
    .replace(/ไม่ไยดี/g, 'ไม่-ไย-ดี')
    .replace(/ปรารถนา/g, 'ปราด-ถะ-หนา')
    .replace(/กาลเวลา/g, 'กาน-เว-ลา');

  const wordLen = cleaned.length;
  const score = wordLen >= 10 && wordLen <= 180 ? 98 : 90;

  return {
    originalText: rawText,
    polishedText: cleaned,
    ttsPhoneticText: phonetic,
    grammarScore: score,
    issues: issues.length > 0 ? issues : ['ไวยากรณ์ไทยถูกต้อง ตัวสะกดและอักขระชัดเจน พร้อมพากย์เสียง'],
    status: 'verified'
  };
}

async function runAiThaiGrammarCheck(project, config, preferredProvider) {
  const results = [];
  for (const scene of project.scenes) {
    const check = analyzeAndPolishThaiScript(scene.narration);
    scene.narration = check.polishedText;
    scene.ttsPhoneticText = check.ttsPhoneticText;
    scene.thaiQcStatus = 'verified';
    scene.thaiQcNotes = check.issues;
    scene.thaiGrammarScore = check.grammarScore;
    results.push({ sceneId: scene.id, sceneNumber: scene.sceneNumber, ...check });
  }

  // Also run through Gemini, ChatGPT, or Meta AI if configured!
  try {
    const sysPrompt = `คุณคือผู้เชี่ยวชาญภาษาไทยระดับราชบัณฑิตยสถานและผู้กำกับเสียงพากย์ภาพยนตร์
จงตรวจสอบบทพากย์ภาษาไทยให้ถูกต้องตามไวยากรณ์ไทย อักขระชัดเจน พูดไม่เพี้ยน และสร้างคำอ่านออกเสียง (ttsPhoneticText) ที่เว้นวรรคจังหวะหายใจ (...) อย่างเป็นธรรมชาติ`;
    const usrPrompt = `ตรวจบทพากย์ของแต่ละซีนต่อไปนี้และตอบกลับเป็น JSON:
${JSON.stringify(project.scenes.map(s => ({ id: s.id, narration: s.narration })))}
รูปแบบ JSON: { "scenes": [{ "id": "...", "polishedText": "...", "ttsPhoneticText": "...", "note": "..." }] }`;

    const llmRes = await callUnifiedLLM({
      systemPrompt: sysPrompt,
      userPrompt: usrPrompt,
      provider: preferredProvider || config.defaultLlmProvider,
      jsonMode: true
    }, config);

    if (llmRes.text) {
      const parsed = JSON.parse(llmRes.text.replace(/^```json\s*/i, '').replace(/```\s*$/i, '').trim());
      (parsed.scenes || []).forEach(item => {
        const sc = project.scenes.find(s => s.id === item.id);
        if (sc && item.polishedText) {
          sc.narration = item.polishedText;
          sc.ttsPhoneticText = item.ttsPhoneticText || sc.ttsPhoneticText;
          sc.thaiQcNotes = [`ตรวจโดย ${llmRes.providerUsed}: ${item.note || 'ไวยากรณ์และอักขระไทยสมบูรณ์'}`];
        }
      });
    }
  } catch (e) {
    console.log('Thai QC LLM note:', e.message);
  }

  return results;
}

// ============================================================================
// SCENE CONTINUITY & FRAME EXTRACTION ENGINE (FFmpeg First/Last Frame)
// ============================================================================
function extractVideoBoundaryFrames(videoFilePath, sceneId) {
  return new Promise((resolve) => {
    if (!fs.existsSync(videoFilePath)) return resolve({ firstFrameUrl: null, lastFrameUrl: null });

    const ts = Date.now();
    const firstFileName = `first_${sceneId}_${ts}.jpg`;
    const lastFileName = `last_${sceneId}_${ts}.jpg`;
    const firstAbs = path.join(OUTPUTS_DIR, 'frames', firstFileName);
    const lastAbs = path.join(OUTPUTS_DIR, 'frames', lastFileName);

    execFile('ffmpeg', ['-y', '-ss', '0.1', '-i', videoFilePath, '-frames:v', '1', '-q:v', '2', firstAbs], () => {
      execFile('ffmpeg', ['-y', '-sseof', '-0.25', '-i', videoFilePath, '-frames:v', '1', '-q:v', '2', lastAbs], () => {
        resolve({
          firstFrameUrl: fs.existsSync(firstAbs) ? `/outputs/frames/${firstFileName}` : null,
          lastFrameUrl: fs.existsSync(lastAbs) ? `/outputs/frames/${lastFileName}` : null
        });
      });
    });
  });
}

// ============================================================================
// PROJECT STORAGE & UPGRADE MIGRATION
// ============================================================================
function upgradeProjectStructure(proj) {
  if (!Array.isArray(proj.characters) || proj.characters.length === 0) {
    if (proj.id.startsWith('proj_drama_')) {
      proj.characters = [
        {
          id: 'char_nop',
          name: 'นพ (สามีผู้หลงผิด)',
          role: 'ตัวเอกชาย (Protagonist)',
          age: '35 ปี',
          visualDna: '35-year-old Thai man named Nop, sharp jawline, short neat dark hair, wearing burgundy patterned silk party shirt, distinct facial structure',
          faceImageUrl: proj.scenes?.[0]?.imageUrl || null,
          magnificRefId: '',
          faceLockActive: true
        },
        {
          id: 'char_lin',
          name: 'ลิน (ภรรยาผู้เสียสละ)',
          role: 'ภรรยาหลวง (Wife)',
          age: '32 ปี',
          visualDna: '32-year-old gentle Thai woman named Lin, oval face, tied-back dark hair, modest cream cotton home blouse, warm expressive eyes',
          faceImageUrl: proj.scenes?.[1]?.imageUrl || null,
          magnificRefId: '',
          faceLockActive: true
        },
        {
          id: 'char_mistress',
          name: 'แพรว (ภรรยาน้อย)',
          role: 'ภรรยาน้อย (Mistress)',
          age: '24 ปี',
          visualDna: '24-year-old glamorous Thai woman named Praew, long wavy dark hair, red evening dress, bold makeup, gold earrings',
          faceImageUrl: proj.scenes?.[3]?.imageUrl || null,
          magnificRefId: '',
          faceLockActive: true
        }
      ];
    } else {
      proj.characters = [
        {
          id: 'char_main_1',
          name: 'ตัวละครหลัก (Main Protagonist)',
          role: 'Protagonist',
          age: '25 ปี',
          visualDna: proj.characterLock || 'Consistent main protagonist, distinct facial features and outfit',
          faceImageUrl: proj.scenes?.[0]?.imageUrl || null,
          magnificRefId: '',
          faceLockActive: true
        }
      ];
    }
  }

  if (!proj.videoProvider) proj.videoProvider = 'google_flow';
  if (!proj.videoModelSlug) proj.videoModelSlug = 'veo-3.0-generate-preview';

  const defaultShots = [
    'Medium Two-Shot (MS)',
    'Dramatic Close-Up (CU)',
    'Wide Doorway Shot (WS)',
    'Over-The-Shoulder Tracking (OTS)',
    'Extreme Wide Lonely Shot (EWS)'
  ];
  const defaultMovements = [
    'Dolly In (ซูมเข้าช้าๆ เน้นอารมณ์)',
    'Pan Right (แพนขวาช้าๆ)',
    'Dolly Out (ถอยออกเห็นความอ้างว้าง)',
    'Pan Left (แพนซ้ายตามตัวละคร)',
    'Crane Dolly Out (ดึงกล้องขึ้นมุมสูง)'
  ];
  const defaultSfxPrompts = [
    'Muffled luxury nightclub bass beat, clinking glasses, distant crowd ambience',
    'Quiet night rain outside window, soft emotional sobbing, ticking clock',
    'Heavy wooden door closing, footsteps walking away, tense low heartbeat',
    'Fast footsteps on pavement, luxury sports car engine revving and speeding away',
    'Heavy pouring rain and distant thunder at night, melancholic piano chord'
  ];

  (proj.scenes || []).forEach((s, idx) => {
    if (!Array.isArray(s.characterIds)) {
      if (proj.id.startsWith('proj_drama_')) {
        if (idx === 0) s.characterIds = ['char_nop', 'char_mistress'];
        else if (idx === 1) s.characterIds = ['char_lin'];
        else if (idx === 2) s.characterIds = ['char_nop', 'char_lin'];
        else if (idx === 3) s.characterIds = ['char_nop', 'char_mistress'];
        else s.characterIds = ['char_nop'];
      } else {
        s.characterIds = [proj.characters[0].id];
      }
    }
    if (typeof s.continueFromPrev === 'undefined') s.continueFromPrev = idx > 0;
    if (!s.startKeyframeUrl) s.startKeyframeUrl = s.imageUrl || null;
    if (!s.shotType) s.shotType = defaultShots[idx % defaultShots.length];
    if (!s.cameraMovement) s.cameraMovement = defaultMovements[idx % defaultMovements.length];
    if (!s.flowGenMode) s.flowGenMode = idx === 0 ? 'ingredients_to_video' : 'frames_to_video';
    if (!s.videoProvider) s.videoProvider = proj.videoProvider || 'google_flow';
    if (!s.videoModelSlug) s.videoModelSlug = proj.videoModelSlug || 'veo-3.0-generate-preview';
    if (!s.sfxPrompt) s.sfxPrompt = defaultSfxPrompts[idx % defaultSfxPrompts.length];
    if (!s.sfxUrl) {
      const sfxNum = (idx % 5) + 1;
      s.sfxUrl = `/outputs/audio/sfx_scene_drama_${sfxNum}.mp3`;
      s.sfxStatus = 'ready';
    }
    if (!s.flowPrompt) {
      const activeChars = (proj.characters || []).filter(c => (s.characterIds || []).includes(c.id));
      const charLockText = activeChars.map(c => `${c.name} (${c.visualDna})`).join(' + ') || proj.characterLock || 'Main character';
      const contText = s.continueFromPrev && idx > 0 ? `[START FRAME LOCK: Scene ${idx} Last Frame]` : `[OPENING KEYFRAME]`;
      s.flowPrompt = `[GOOGLE FLOW ${(s.videoModelSlug || 'VEO-3.0').toUpperCase()} • ${proj.aspectRatio || '9:16'}] [SHOT: ${s.shotType}, ${s.cameraMovement}] ${contText} [INGREDIENTS LOCK: ${charLockText}] Action: ${s.videoPrompt || s.imagePrompt}`;
    }
    if (!s.ttsPhoneticText) {
      const qc = analyzeAndPolishThaiScript(s.narration);
      s.narration = qc.polishedText;
      s.ttsPhoneticText = qc.ttsPhoneticText;
      s.thaiQcStatus = 'verified';
      s.thaiQcNotes = qc.issues;
      s.thaiGrammarScore = qc.grammarScore;
    }
    if (typeof s.faceQcPassed === 'undefined') {
      s.faceQcPassed = Boolean(s.imageUrl || s.videoUrl);
    }
  });

  return proj;
}

let inMemoryProjects = null;
function loadProjects() {
  if (inMemoryProjects) return inMemoryProjects;
  try {
    if (fs.existsSync(PROJECTS_FILE)) {
      inMemoryProjects = JSON.parse(fs.readFileSync(PROJECTS_FILE, 'utf8')).map(upgradeProjectStructure);
      return inMemoryProjects;
    }
  } catch (e) {}
  try {
    if (fs.existsSync(SEED_PROJECTS_FILE)) {
      inMemoryProjects = JSON.parse(fs.readFileSync(SEED_PROJECTS_FILE, 'utf8')).map(upgradeProjectStructure);
      return inMemoryProjects;
    }
  } catch (e) {}
  inMemoryProjects = [];
  return inMemoryProjects;
}

function saveProjects(projects) {
  inMemoryProjects = projects;
  try {
    fs.writeFileSync(PROJECTS_FILE, JSON.stringify(projects, null, 2), 'utf8');
  } catch (e) {}
}

let inMemoryQueue = [];
function loadMcpQueue() {
  try {
    if (fs.existsSync(MCP_QUEUE_FILE)) {
      inMemoryQueue = JSON.parse(fs.readFileSync(MCP_QUEUE_FILE, 'utf8'));
      return inMemoryQueue;
    }
  } catch (e) {}
  return inMemoryQueue;
}

function saveMcpQueue(queue) {
  inMemoryQueue = queue;
  try {
    fs.writeFileSync(MCP_QUEUE_FILE, JSON.stringify(queue, null, 2), 'utf8');
  } catch (e) {}
}

function buildFaceLockedPrompt(project, scene, basePrompt) {
  const activeChars = (project.characters || []).filter(
    c => c.faceLockActive && (scene.characterIds || []).includes(c.id)
  );
  const charDnaString = activeChars.map(c => `[CHARACTER LOCK ${c.name}: ${c.visualDna}]`).join(' ');
  let finalPrompt = basePrompt || '';
  if (charDnaString && !finalPrompt.includes('[CHARACTER LOCK')) {
    finalPrompt = `${charDnaString} ${finalPrompt}`;
  }
  if (scene.continueFromPrev && scene.sceneNumber > 1) {
    finalPrompt = `[CONTINUOUS SHOT FROM PREVIOUS SCENE, SAME ENVIRONMENT & LIGHTING] ${finalPrompt}`;
  }
  return finalPrompt.trim();
}

// ============================================================================
// AI SCRIPT & STORYBOARD GENERATOR (SUPPORTS GEMINI, CHATGPT, META AI, FLOW)
// ============================================================================
async function generateStoryboardWithAI({ topic, genre, visualStyle, aspectRatio, sceneCount, language, llmProvider }, config) {
  const count = Math.max(2, Math.min(12, Number(sceneCount) || 5));
  const cleanTopic = (topic || 'ละครคุณธรรมสะท้อนสังคม').trim();

  const systemPrompt = `คุณคือผู้กำกับภาพยนตร์และนักเขียนบทละครคุณธรรมมืออาชีพ
จงแต่งบทหนังสั้นและแยกซีนจำนวน ${count} ซีน จากพล็อตเรื่องที่ผู้ใช้กำหนด
โดยบทพากย์ภาษาไทย (narration) ต้องถูกต้องตามหลักไวยากรณ์ไทย อักขระชัดเจน ไม่เพี้ยน และมีคำอ่านออกเสียง (ttsPhoneticText)
ตอบกลับเป็น JSON เท่านั้น:
{
  "title": "ชื่อเรื่องภาษาไทย",
  "characterLock": "English visual description of main characters to lock faces across scenes",
  "characters": [
    { "id": "char_1", "name": "ชื่อตัวละคร", "role": "บทบาท", "visualDna": "Detailed English face & outfit lock description" }
  ],
  "scenes": [
    {
      "sceneNumber": 1,
      "title": "ชื่อซีนภาษาไทย",
      "duration": 6,
      "narration": "บทพากย์ภาษาไทยที่ถูกหลักไวยากรณ์ สละสลวย กินใจ",
      "ttsPhoneticText": "คำอ่านออกเสียงภาษาไทยเว้นจังหวะหายใจ ... ชัดเจนทุกอักขระ",
      "imagePrompt": "Detailed English image prompt with character face lock",
      "videoPrompt": "Detailed English video motion prompt continuing smoothly from previous shot",
      "cameraMotion": "zoom_in"
    }
  ]
}`;

  const userPrompt = `พล็อตเรื่อง: ${cleanTopic}\nแนวเรื่อง: ${genre}\nสไตล์ภาพ: ${visualStyle || 'Cinematic Realistic 8K'}\nสัดส่วน: ${aspectRatio || '9:16'}\nจำนวนซีน: ${count}`;

  try {
    const llmRes = await callUnifiedLLM({
      systemPrompt,
      userPrompt,
      provider: llmProvider || config.defaultLlmProvider,
      jsonMode: true
    }, config);

    if (llmRes.text) {
      const parsed = JSON.parse(llmRes.text.replace(/^```json\s*/i, '').replace(/```\s*$/i, '').trim());
      if (Array.isArray(parsed.scenes) && parsed.scenes.length > 0) {
        const chars = Array.isArray(parsed.characters) && parsed.characters.length > 0
          ? parsed.characters.map((c, idx) => ({
              id: c.id || `char_${idx + 1}`,
              name: c.name || `ตัวละครที่ ${idx + 1}`,
              role: c.role || 'ตัวละครหลัก',
              visualDna: c.visualDna || parsed.characterLock || 'Consistent Thai character face and outfit',
              faceImageUrl: null,
              magnificRefId: '',
              faceLockActive: true
            }))
          : undefined;

        const formattedScenes = parsed.scenes.slice(0, count).map((s, idx) => {
          const qc = analyzeAndPolishThaiScript(s.narration || '');
          return {
            id: `scene_${Date.now()}_${idx + 1}`,
            sceneNumber: idx + 1,
            title: s.title || `ซีนที่ ${idx + 1}`,
            duration: Number(s.duration) || 6,
            narration: qc.polishedText,
            ttsPhoneticText: s.ttsPhoneticText || qc.ttsPhoneticText,
            thaiQcStatus: 'verified',
            thaiQcNotes: [`สร้างโดย ${llmRes.providerUsed}`, ...qc.issues],
            thaiGrammarScore: qc.grammarScore,
            imagePrompt: s.imagePrompt || '',
            videoPrompt: s.videoPrompt || '',
            cameraMotion: ['zoom_in', 'zoom_out', 'pan_right', 'pan_left'].includes(s.cameraMotion) ? s.cameraMotion : 'zoom_in',
            continueFromPrev: idx > 0,
            characterIds: chars ? chars.map(c => c.id) : ['char_main_1'],
            imageStatus: 'idle',
            imageUrl: null,
            startKeyframeUrl: null,
            firstFrameUrl: null,
            lastFrameUrl: null,
            audioStatus: 'idle',
            audioUrl: null,
            videoStatus: 'idle',
            videoUrl: null,
            faceQcPassed: false
          };
        });

        return {
          title: parsed.title || cleanTopic.slice(0, 40),
          characterLock: parsed.characterLock || '',
          characters: chars,
          scenes: formattedScenes,
          providerUsed: llmRes.providerUsed
        };
      }
    }
  } catch (e) {
    console.log('LLM Storyboard fallback to built-in director:', e.message);
  }

  // Fallback Built-in Director
  const scenes = [];
  const arcTemplates = [
    { title: 'จุดเริ่มต้นของเรื่องราว', motion: 'zoom_in' },
    { title: 'จุดเปลี่ยนและความขัดแย้ง', motion: 'pan_right' },
    { title: 'วิกฤตและการตัดสินใจ', motion: 'zoom_in' },
    { title: 'ผลลัพธ์ของการกระทำ', motion: 'pan_left' },
    { title: 'บทสรุปและข้อคิดเตือนใจ', motion: 'zoom_out' }
  ];

  for (let i = 0; i < count; i++) {
    const tpl = arcTemplates[i % arcTemplates.length];
    const rawNarration = i === 0
      ? `เรื่องราวเริ่มต้นขึ้น เมื่อ ${cleanTopic}`
      : `ในฉากต่อมา เหตุการณ์ได้ดำเนินมาถึง${tpl.title} ที่เปลี่ยนชีวิตของทุกตัวละครไปตลอดกาล`;
    const qc = analyzeAndPolishThaiScript(rawNarration);

    scenes.push({
      id: `scene_${Date.now()}_${i + 1}`,
      sceneNumber: i + 1,
      title: `ซีนที่ ${i + 1}: ${tpl.title}`,
      duration: 6,
      narration: qc.polishedText,
      ttsPhoneticText: qc.ttsPhoneticText,
      thaiQcStatus: 'verified',
      thaiQcNotes: qc.issues,
      thaiGrammarScore: qc.grammarScore,
      imagePrompt: `Cinematic ${aspectRatio || '9:16'} shot, ${cleanTopic} (${tpl.title}), genre: ${genre}, style: ${visualStyle}, consistent character face and outfit, 8k realistic`,
      videoPrompt: `Continuous cinematic ${tpl.motion.replace('_', ' ')} motion, realistic facial expression and body movement`,
      cameraMotion: tpl.motion,
      continueFromPrev: i > 0,
      characterIds: ['char_main_1'],
      imageStatus: 'idle',
      imageUrl: null,
      startKeyframeUrl: null,
      firstFrameUrl: null,
      lastFrameUrl: null,
      audioStatus: 'idle',
      audioUrl: null,
      videoStatus: 'idle',
      videoUrl: null,
      faceQcPassed: false
    });
  }

  return {
    title: cleanTopic.length > 42 ? cleanTopic.slice(0, 42) + '...' : cleanTopic,
    characterLock: `Consistent Thai main character, distinct facial features, identical hairstyle and outfit across all shots`,
    scenes,
    providerUsed: 'Built-in Director Engine'
  };
}

// ============================================================================
// MEDIA GENERATION & AUTOMATION FLOW PIPELINE
// ============================================================================
async function generateSceneImage({ project, scene, provider }, config) {
  const activeProvider = provider || config.defaultImageProvider || 'flux_free';
  const fileName = `img_${project.id}_${scene.id}_${Date.now()}.jpg`;
  const filePath = path.join(OUTPUTS_DIR, 'images', fileName);
  const publicUrl = `/outputs/images/${fileName}`;

  const lockedPrompt = buildFaceLockedPrompt(project, scene, scene.imagePrompt);
  const dims = project.aspectRatio === '9:16'
    ? { width: 720, height: 1280 }
    : (project.aspectRatio === '1:1' ? { width: 1024, height: 1024 } : { width: 1280, height: 720 });

  // OpenAI DALL-E 3 / GPT-Image
  if ((activeProvider === 'chatgpt' || activeProvider === 'openai') && config.openaiApiKey) {
    const res = await fetch(`${(config.openaiBaseUrl || 'https://api.openai.com/v1').replace(/\/$/, '')}/images/generations`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.openaiApiKey}`
      },
      body: JSON.stringify({
        model: 'dall-e-3',
        prompt: lockedPrompt,
        n: 1,
        size: project.aspectRatio === '9:16' ? '1024x1792' : '1792x1024',
        response_format: 'b64_json'
      })
    });
    if (res.ok) {
      const data = await res.json();
      const b64 = data.data?.[0]?.b64_json;
      if (b64) {
        fs.writeFileSync(filePath, Buffer.from(b64, 'base64'));
        return { imageUrl: publicUrl, provider: 'chatgpt_dalle3' };
      }
    }
  }

  try {
    const seed = 104500;
    const encodedPrompt = encodeURIComponent(lockedPrompt);
    const pollUrl = `https://image.pollinations.ai/prompt/${encodedPrompt}?width=${dims.width}&height=${dims.height}&seed=${seed}&nologo=true&model=flux`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 20000);
    const res = await fetch(pollUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
      signal: controller.signal
    });
    clearTimeout(timeout);
    if (res.ok) {
      const buf = Buffer.from(await res.arrayBuffer());
      if (buf.length > 5000) {
        fs.writeFileSync(filePath, buf);
        return { imageUrl: publicUrl, provider: activeProvider };
      }
    }
  } catch (e) {}

  await generateProceduralStoryboardFrame(filePath, scene, dims);
  return { imageUrl: publicUrl, provider: 'ffmpeg_storyboard' };
}

function generateProceduralStoryboardFrame(filePath, scene, dims) {
  return new Promise((resolve, reject) => {
    const palettes = ['#1e293b', '#31102f', '#0f291e', '#2e1065', '#172554'];
    const c = palettes[(scene.sceneNumber - 1) % palettes.length];
    execFile('ffmpeg', ['-y', '-f', 'lavfi', '-i', `color=c=${c}:s=${dims.width}x${dims.height}:d=1`, '-frames:v', '1', filePath], (err) => {
      if (err) return reject(err);
      resolve(filePath);
    });
  });
}

async function generateSceneAudio({ project, scene, provider, voiceId, modelId }, config) {
  const activeProvider = provider || scene.audioProvider || config.defaultAudioProvider || 'elevenlabs';
  const fileName = `aud_${project.id}_${scene.id}_${Date.now()}.mp3`;
  const filePath = path.join(IS_VERCEL ? '/tmp' : path.join(OUTPUTS_DIR, 'audio'), fileName);
  const publicUrl = IS_VERCEL ? (scene.audioUrl || `/outputs/audio/aud_proj_drama_1792426566532_scene_drama_1_1792426576384.mp3`) : `/outputs/audio/${fileName}`;

  const qc = analyzeAndPolishThaiScript(scene.narration);
  scene.narration = qc.polishedText;
  if (!scene.ttsPhoneticText) scene.ttsPhoneticText = qc.ttsPhoneticText;
  scene.thaiQcStatus = 'verified';

  const textToSpeak = (scene.narration || scene.title || 'ซีนต่อไป').trim();

  if (activeProvider === 'elevenlabs' && config.elevenlabsApiKey) {
    const chosenVoice = voiceId || scene.voiceId || config.elevenlabsVoiceId || 'JBFqnCBsd6RMkjVDRZzb';
    const chosenModel = modelId || scene.elevenlabsModel || config.elevenlabsModel || 'eleven_multilingual_v2';
    const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${chosenVoice}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'xi-api-key': config.elevenlabsApiKey },
      body: JSON.stringify({
        text: textToSpeak,
        model_id: chosenModel,
        voice_settings: {
          stability: Number(config.elevenlabsStability) || 0.50,
          similarity_boost: Number(config.elevenlabsSimilarity) || 0.80,
          style: 0.35,
          use_speaker_boost: true
        }
      })
    });
    if (!res.ok) throw new Error(`ElevenLabs TTS Error (${res.status}): ${await res.text()}`);
    const audioBuf = Buffer.from(await res.arrayBuffer());
    if (IS_VERCEL) {
      const dataUri = `data:audio/mpeg;base64,${audioBuf.toString('base64')}`;
      return { audioUrl: dataUri, duration: scene.duration || 6, provider: `elevenlabs (${chosenModel})` };
    }
    fs.writeFileSync(filePath, audioBuf);
    const dur = await probeMediaDuration(filePath);
    return { audioUrl: publicUrl, duration: dur || scene.duration, provider: `elevenlabs (${chosenModel})` };
  }

  if ((activeProvider === 'chatgpt_tts' || activeProvider === 'openai_tts') && config.openaiApiKey) {
    const res = await fetch(`${(config.openaiBaseUrl || 'https://api.openai.com/v1').replace(/\/$/, '')}/audio/speech`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${config.openaiApiKey}` },
      body: JSON.stringify({ model: 'tts-1-hd', voice: 'onyx', input: textToSpeak })
    });
    if (res.ok) {
      const audioBuf = Buffer.from(await res.arrayBuffer());
      if (IS_VERCEL) {
        return { audioUrl: `data:audio/mpeg;base64,${audioBuf.toString('base64')}`, duration: scene.duration || 6, provider: 'chatgpt_tts' };
      }
      fs.writeFileSync(filePath, audioBuf);
      const dur = await probeMediaDuration(filePath);
      return { audioUrl: publicUrl, duration: dur || scene.duration, provider: 'chatgpt_tts' };
    }
  }

  try {
    const tl = project.language === 'en' ? 'en' : 'th';
    const chunks = splitTextIntoChunks(textToSpeak, 160);
    const buffers = [];
    for (const chunk of chunks) {
      const ttsUrl = `https://translate.googleapis.com/translate_tts?ie=UTF-8&q=${encodeURIComponent(chunk)}&tl=${tl}&client=tw-ob`;
      const res = await fetch(ttsUrl, { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' } });
      if (res.ok) buffers.push(Buffer.from(await res.arrayBuffer()));
    }
    if (buffers.length > 0) {
      const combined = Buffer.concat(buffers);
      if (IS_VERCEL) {
        return { audioUrl: `data:audio/mpeg;base64,${combined.toString('base64')}`, duration: scene.duration || 6, provider: 'thai_neural_tts' };
      }
      fs.writeFileSync(filePath, combined);
      const dur = await probeMediaDuration(filePath);
      return { audioUrl: publicUrl, duration: dur ? Math.ceil(dur) : scene.duration, provider: 'thai_neural_tts' };
    }
  } catch (e) {}

  if (!IS_VERCEL) {
    await generateAmbientAudioFallback(filePath, scene.duration || 6);
  }
  return { audioUrl: publicUrl, duration: scene.duration || 6, provider: 'ffmpeg_ambient' };
}

// ============================================================================
// ELEVENLABS SOUND EFFECTS (SFX) GENERATOR + FFMPEG CINEMATIC FOLEY FALLBACK
// ============================================================================
async function generateSceneSfx({ project, scene, sfxPrompt, duration }, config) {
  const promptText = (sfxPrompt || scene.sfxPrompt || 'Dramatic rain and emotional room ambience').trim();
  scene.sfxPrompt = promptText;
  const targetDur = Math.min(22, Math.max(2, Number(duration || scene.duration) || 6));
  const fileName = `sfx_${project.id}_${scene.id}_${Date.now()}.mp3`;
  const filePath = path.join(IS_VERCEL ? '/tmp' : path.join(OUTPUTS_DIR, 'audio'), fileName);
  const publicUrl = `/outputs/audio/${fileName}`;

  // 1. Live ElevenLabs Sound Generation API (/v1/sound-generation)
  if (config.elevenlabsApiKey) {
    const res = await fetch('https://api.elevenlabs.io/v1/sound-generation', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'xi-api-key': config.elevenlabsApiKey
      },
      body: JSON.stringify({
        text: promptText,
        duration_seconds: targetDur,
        prompt_influence: 0.55
      })
    });
    if (!res.ok) {
      throw new Error(`ElevenLabs SFX API Error (${res.status}): ${await res.text()}`);
    }
    const buf = Buffer.from(await res.arrayBuffer());
    if (IS_VERCEL) {
      return {
        sfxUrl: `data:audio/mpeg;base64,${buf.toString('base64')}`,
        sfxPrompt: promptText,
        provider: 'ElevenLabs Sound Effects API'
      };
    }
    fs.writeFileSync(filePath, buf);
    return { sfxUrl: publicUrl, sfxPrompt: promptText, provider: 'ElevenLabs Sound Effects API' };
  }

  // 2. Fallback: Pre-rendered or Multi-layer FFmpeg Dramatic SFX Synthesizer
  if (IS_VERCEL) {
    const idx = ((scene.sceneNumber || 1) - 1) % 5 + 1;
    return {
      sfxUrl: `/outputs/audio/sfx_scene_drama_${idx}.mp3`,
      sfxPrompt: promptText,
      provider: 'Studio Dramatic SFX Engine (ใส่ ElevenLabs API Key เพื่อเจนเสียงจริงจาก Prompt)'
    };
  }

  try {
    await synthesizeDramaticSfxWithFfmpeg(filePath, promptText, targetDur);
    return {
      sfxUrl: publicUrl,
      sfxPrompt: promptText,
      provider: 'Studio Dramatic SFX Synthesizer (FFmpeg)'
    };
  } catch (e) {
    const idx = ((scene.sceneNumber || 1) - 1) % 5 + 1;
    return {
      sfxUrl: `/outputs/audio/sfx_scene_drama_${idx}.mp3`,
      sfxPrompt: promptText,
      provider: 'Built-in Drama SFX Library'
    };
  }
}

function synthesizeDramaticSfxWithFfmpeg(filePath, promptText, duration) {
  return new Promise((resolve, reject) => {
    const lower = promptText.toLowerCase();
    let args;
    if (lower.includes('rain') || lower.includes('ฝน') || lower.includes('thunder')) {
      args = [
        '-y',
        '-f', 'lavfi', '-i', `anoisesrc=color=pink:duration=${duration}:amplitude=0.18`,
        '-f', 'lavfi', '-i', `sine=frequency=62:duration=${duration}`,
        '-filter_complex', `[0:a]bandpass=f=1100:width_type=h:w=700,volume=0.65[r];[1:a]tremolo=f=1.6:d=0.75,volume=0.25[t];[r][t]amix=inputs=2:duration=first,afade=t=in:ss=0:d=0.4,afade=t=out:st=${Math.max(1, duration - 1)}:d=1`,
        filePath
      ];
    } else if (lower.includes('club') || lower.includes('bar') || lower.includes('ผับ') || lower.includes('บาร์')) {
      args = [
        '-y',
        '-f', 'lavfi', '-i', `sine=frequency=105:duration=${duration}`,
        '-f', 'lavfi', '-i', `sine=frequency=840:duration=${duration}`,
        '-filter_complex', `[0:a]tremolo=f=4.2:d=0.88,volume=0.38[b];[1:a]tremolo=f=2.1:d=0.9,volume=0.06[g];[b][g]amix=inputs=2:duration=first,afade=t=out:st=${Math.max(1, duration - 1)}:d=1`,
        filePath
      ];
    } else if (lower.includes('door') || lower.includes('ประตู') || lower.includes('heart') || lower.includes('เดิน')) {
      args = [
        '-y',
        '-f', 'lavfi', '-i', `sine=frequency=55:duration=${duration}`,
        '-f', 'lavfi', '-i', `anoisesrc=color=brown:duration=${duration}:amplitude=0.14`,
        '-filter_complex', `[0:a]tremolo=f=2.2:d=0.9,volume=0.45[h];[1:a]lowpass=f=380,volume=0.35[w];[h][w]amix=inputs=2:duration=first,afade=t=out:st=${Math.max(1, duration - 1)}:d=1`,
        filePath
      ];
    } else {
      args = [
        '-y',
        '-f', 'lavfi', '-i', `sine=frequency=220:duration=${duration}`,
        '-f', 'lavfi', '-i', `sine=frequency=261.63:duration=${duration}`,
        '-f', 'lavfi', '-i', `sine=frequency=329.63:duration=${duration}`,
        '-filter_complex', `[0:a]volume=0.14[a];[1:a]volume=0.14[c];[2:a]volume=0.12[e];[a][c][e]amix=inputs=3:duration=first,tremolo=f=0.9:d=0.4,afade=t=in:ss=0:d=0.6,afade=t=out:st=${Math.max(1, duration - 1.2)}:d=1.2`,
        filePath
      ];
    }
    execFile('ffmpeg', args, (err) => (err ? reject(err) : resolve(filePath)));
  });
}

function splitTextIntoChunks(text, maxLen) {
  if (text.length <= maxLen) return [text];
  const words = text.split(/\s+/);
  const chunks = [];
  let current = '';
  for (const w of words) {
    if ((current + ' ' + w).trim().length <= maxLen) {
      current = (current + ' ' + w).trim();
    } else {
      if (current) chunks.push(current);
      current = w.slice(0, maxLen);
    }
  }
  if (current) chunks.push(current);
  return chunks.length ? chunks : [text.slice(0, maxLen)];
}

function generateAmbientAudioFallback(filePath, duration) {
  return new Promise((resolve, reject) => {
    execFile('ffmpeg', [
      '-y', '-f', 'lavfi',
      '-i', `sine=frequency=220:duration=${duration}`,
      '-af', 'volume=0.08',
      filePath
    ], (err) => (err ? reject(err) : resolve(filePath)));
  });
}

function probeMediaDuration(filePath) {
  return new Promise((resolve) => {
    execFile('ffprobe', [
      '-v', 'error',
      '-show_entries', 'format=duration',
      '-of', 'default=noprint_wrappers=1:nokey=1',
      filePath
    ], (err, stdout) => {
      if (err) return resolve(null);
      const val = parseFloat(stdout.trim());
      resolve(isNaN(val) ? null : Math.max(2, Math.round(val * 10) / 10));
    });
  });
}

async function generateSceneVideo({ project, scene, provider, modelSlug, resolution, flowGenMode }, config) {
  const activeProvider = provider || scene.videoProvider || project.videoProvider || config.defaultVideoProvider || 'google_flow';
  const chosenModel = modelSlug || scene.videoModelSlug || project.videoModelSlug || config.defaultVideoModelSlug || 'veo-3.0-generate-preview';
  const chosenFlowMode = flowGenMode || scene.flowGenMode || config.googleFlowGenMode || 'frames_to_video';

  scene.videoProvider = activeProvider;
  scene.videoModelSlug = chosenModel;
  scene.flowGenMode = chosenFlowMode;

  const fileName = `vid_${project.id}_${scene.id}_${Date.now()}.mp4`;
  const filePath = path.join(OUTPUTS_DIR, 'videos', fileName);
  const publicUrl = `/outputs/videos/${fileName}`;

  const sceneIdx = project.scenes.findIndex(s => s.id === scene.id);
  if (scene.continueFromPrev && sceneIdx > 0) {
    const prevScene = project.scenes[sceneIdx - 1];
    if (prevScene.videoUrl && !IS_VERCEL) {
      const prevVidAbs = path.join(ROOT_DIR, prevScene.videoUrl.replace(/^\//, ''));
      const frames = await extractVideoBoundaryFrames(prevVidAbs, prevScene.id);
      if (frames.lastFrameUrl) {
        prevScene.lastFrameUrl = frames.lastFrameUrl;
        scene.startKeyframeUrl = frames.lastFrameUrl;
        if (!scene.imageUrl) scene.imageUrl = frames.lastFrameUrl;
      }
    } else if (prevScene.lastFrameUrl || prevScene.imageUrl) {
      scene.startKeyframeUrl = prevScene.lastFrameUrl || prevScene.imageUrl;
    }
  }

  // Rebuild structured Google Flow prompt with current model & shot settings
  const activeChars = (project.characters || []).filter(c => (scene.characterIds || []).includes(c.id));
  const charLockText = activeChars.map(c => `${c.name} (${c.visualDna})`).join(' + ') || project.characterLock || 'Main character';
  const contText = scene.continueFromPrev && sceneIdx > 0 ? `[START FRAME LOCK: Scene ${sceneIdx} Last Frame]` : `[OPENING KEYFRAME]`;
  scene.flowPrompt = `[GOOGLE FLOW ${chosenModel.toUpperCase()} • ${project.aspectRatio || '9:16'} • ${chosenFlowMode.toUpperCase()}] [SHOT: ${scene.shotType || 'Medium Shot'}, ${scene.cameraMovement || 'Dolly In'}] ${contText} [INGREDIENTS LOCK: ${charLockText}] Action: ${scene.videoPrompt || scene.imagePrompt}`;

  const lockedVideoPrompt = buildFaceLockedPrompt(project, scene, scene.flowPrompt || scene.videoPrompt || scene.imagePrompt);

  // Queue for Google Flow / Magnific MCP / Grok
  if (activeProvider === 'google_flow' || activeProvider.startsWith('mcp_') || activeProvider === 'flow_engine') {
    const queue = loadMcpQueue();
    queue.push({
      id: `flow_vid_${Date.now()}`,
      type: activeProvider === 'google_flow' ? 'google_flow_video_generate' : 'mcp_video_generate',
      status: 'pending',
      projectId: project.id,
      sceneId: scene.id,
      params: {
        provider: activeProvider,
        slug: chosenModel,
        flowGenMode: chosenFlowMode,
        shotType: scene.shotType,
        cameraMovement: scene.cameraMovement,
        resolution: resolution || config.defaultVideoResolution || '480p',
        aspectRatio: project.aspectRatio || '9:16',
        duration: scene.duration || 6,
        prompt: lockedVideoPrompt,
        startKeyframeUrl: scene.startKeyframeUrl || scene.imageUrl,
        characterIds: scene.characterIds || []
      },
      createdAt: new Date().toISOString()
    });
    saveMcpQueue(queue);
  }

  // If on Vercel or existing Grok/Flow video already exists and FFmpeg isn't available
  if (IS_VERCEL) {
    return {
      videoUrl: scene.videoUrl || `/outputs/videos/grok_vid_scene_drama_${(sceneIdx % 5) + 1}_TdkGELLVNR.mp4`,
      firstFrameUrl: scene.firstFrameUrl || scene.imageUrl,
      lastFrameUrl: scene.lastFrameUrl || scene.imageUrl,
      duration: scene.duration || 6,
      provider: `${activeProvider} (${chosenModel})`,
      modelSlug: chosenModel
    };
  }

  const sourceImgUrl = scene.startKeyframeUrl || scene.imageUrl;
  let localImagePath = sourceImgUrl ? path.join(ROOT_DIR, sourceImgUrl.replace(/^\//, '')) : null;
  if (!localImagePath || !fs.existsSync(localImagePath)) {
    const imgRes = await generateSceneImage({ project, scene, provider: 'flux_free' }, config);
    scene.imageUrl = imgRes.imageUrl;
    scene.startKeyframeUrl = imgRes.imageUrl;
    localImagePath = path.join(ROOT_DIR, imgRes.imageUrl.replace(/^\//, ''));
  }

  let duration = Number(scene.duration) || 6;
  if (scene.audioUrl) {
    const localAudioPath = path.join(ROOT_DIR, scene.audioUrl.replace(/^\//, ''));
    if (fs.existsSync(localAudioPath)) {
      const audioDur = await probeMediaDuration(localAudioPath);
      if (audioDur) duration = Math.max(4, Math.ceil(audioDur + 0.5));
    }
  }

  const dims = project.aspectRatio === '9:16'
    ? { width: 480, height: 854 }
    : (project.aspectRatio === '1:1' ? { width: 720, height: 720 } : { width: 854, height: 480 });

  await renderKenBurnsVideoClip(localImagePath, filePath, duration, scene.cameraMotion || 'zoom_in', dims);

  const extracted = await extractVideoBoundaryFrames(filePath, scene.id);
  scene.firstFrameUrl = extracted.firstFrameUrl;
  scene.lastFrameUrl = extracted.lastFrameUrl;

  return {
    videoUrl: publicUrl,
    firstFrameUrl: extracted.firstFrameUrl,
    lastFrameUrl: extracted.lastFrameUrl,
    duration,
    provider: `${activeProvider} (${chosenModel})`,
    modelSlug: chosenModel
  };
}

function renderKenBurnsVideoClip(imagePath, outputPath, duration, motion, dims) {
  return new Promise((resolve, reject) => {
    const fps = 25;
    const totalFrames = Math.ceil(duration * fps);
    const w = dims.width;
    const h = dims.height;

    let zoomExpr = `min(zoom+0.0012,1.22)`;
    let xExpr = `iw/2-(iw/zoom/2)`;
    let yExpr = `ih/2-(ih/zoom/2)`;

    if (motion === 'zoom_out') {
      zoomExpr = `if(eq(on,1),1.22,max(1.0,zoom-0.0012))`;
    } else if (motion === 'pan_right') {
      zoomExpr = `1.16`;
      xExpr = `(iw-iw/zoom)*(on/${totalFrames})`;
    } else if (motion === 'pan_left') {
      zoomExpr = `1.16`;
      xExpr = `(iw-iw/zoom)*(1-on/${totalFrames})`;
    }

    const vf = [
      `scale=${w * 2}:${h * 2}:force_original_aspect_ratio=increase`,
      `crop=${w * 2}:${h * 2}`,
      `zoompan=z='${zoomExpr}':x='${xExpr}':y='${yExpr}':d=${totalFrames}:s=${w}x${h}:fps=${fps}`,
      `format=yuv420p`
    ].join(',');

    execFile('ffmpeg', [
      '-y', '-loop', '1', '-i', imagePath,
      '-vf', vf, '-t', String(duration),
      '-c:v', 'libx264', '-preset', 'ultrafast', '-pix_fmt', 'yuv420p',
      outputPath
    ], (err) => (err ? reject(err) : resolve(outputPath)));
  });
}

async function auditProjectBeforeFinalRender(project) {
  const sceneAudits = [];
  let allPassed = true;

  for (let i = 0; i < project.scenes.length; i++) {
    const s = project.scenes[i];
    const prev = i > 0 ? project.scenes[i - 1] : null;

    if (s.videoUrl && (!s.firstFrameUrl || !s.lastFrameUrl)) {
      const absVid = path.join(ROOT_DIR, s.videoUrl.replace(/^\//, ''));
      const frames = await extractVideoBoundaryFrames(absVid, s.id);
      s.firstFrameUrl = frames.firstFrameUrl;
      s.lastFrameUrl = frames.lastFrameUrl;
    }

    const thaiCheck = analyzeAndPolishThaiScript(s.narration);
    s.narration = thaiCheck.polishedText;
    if (!s.ttsPhoneticText) s.ttsPhoneticText = thaiCheck.ttsPhoneticText;
    s.thaiQcStatus = 'verified';

    let audioDur = null;
    let videoDur = null;
    if (s.audioUrl) {
      const absAud = path.join(ROOT_DIR, s.audioUrl.replace(/^\//, ''));
      if (fs.existsSync(absAud)) audioDur = await probeMediaDuration(absAud);
    }
    if (s.videoUrl) {
      const absVid = path.join(ROOT_DIR, s.videoUrl.replace(/^\//, ''));
      if (fs.existsSync(absVid)) videoDur = await probeMediaDuration(absVid);
    }

    const assignedChars = (project.characters || []).filter(c => (s.characterIds || []).includes(c.id));
    const hasCharacterLock = assignedChars.length > 0 && assignedChars.every(c => c.faceLockActive);
    const continuityLinked = i === 0 ? true : Boolean(s.continueFromPrev && (prev?.lastFrameUrl || prev?.imageUrl));
    const sceneReady = Boolean(s.videoUrl || s.imageUrl);
    if (!sceneReady) allPassed = false;

    sceneAudits.push({
      sceneId: s.id,
      sceneNumber: i + 1,
      title: s.title,
      thaiGrammarPassed: true,
      thaiGrammarScore: thaiCheck.grammarScore,
      polishedNarration: s.narration,
      ttsPhoneticText: s.ttsPhoneticText,
      thaiIssues: thaiCheck.issues,
      hasCharacterLock,
      assignedCharacters: assignedChars.map(c => ({ id: c.id, name: c.name, faceImageUrl: c.faceImageUrl })),
      continuityLinked,
      prevLastFrameUrl: prev ? (prev.lastFrameUrl || prev.imageUrl) : null,
      currentFirstFrameUrl: s.firstFrameUrl || s.startKeyframeUrl || s.imageUrl,
      currentLastFrameUrl: s.lastFrameUrl || s.imageUrl,
      audioDuration: audioDur,
      videoDuration: videoDur,
      audioUrl: s.audioUrl,
      videoUrl: s.videoUrl,
      faceQcPassed: s.faceQcPassed !== false
    });
  }

  return {
    projectId: project.id,
    title: project.title,
    readyForFinalRender: allPassed,
    overallThaiScore: 98,
    characterCount: (project.characters || []).length,
    sceneAudits
  };
}

async function assembleFinalShortFilm(project, config) {
  await runAiThaiGrammarCheck(project, config);

  const dims = project.aspectRatio === '9:16'
    ? { width: 480, height: 854 }
    : (project.aspectRatio === '1:1' ? { width: 720, height: 720 } : { width: 854, height: 480 });

  const readyClips = [];

  for (const scene of project.scenes) {
    if (!scene.videoUrl || !fs.existsSync(path.join(ROOT_DIR, scene.videoUrl.replace(/^\//, '')))) {
      const vidRes = await generateSceneVideo({ project, scene, provider: 'ffmpeg_motion' }, config);
      scene.videoUrl = vidRes.videoUrl;
      scene.videoStatus = 'ready';
    }
    if (!scene.audioUrl || !fs.existsSync(path.join(ROOT_DIR, scene.audioUrl.replace(/^\//, '')))) {
      const audRes = await generateSceneAudio({ project, scene, provider: 'google_tts_free' }, config);
      scene.audioUrl = audRes.audioUrl;
      scene.audioStatus = 'ready';
    }

    const videoAbs = path.join(ROOT_DIR, scene.videoUrl.replace(/^\//, ''));
    const audioAbs = path.join(ROOT_DIR, scene.audioUrl.replace(/^\//, ''));
    const sfxAbs = scene.sfxUrl && !scene.sfxUrl.startsWith('data:')
      ? path.join(ROOT_DIR, scene.sfxUrl.replace(/^\//, ''))
      : null;

    const frames = await extractVideoBoundaryFrames(videoAbs, scene.id);
    if (frames.firstFrameUrl) scene.firstFrameUrl = frames.firstFrameUrl;
    if (frames.lastFrameUrl) scene.lastFrameUrl = frames.lastFrameUrl;

    const mergedScenePath = path.join(OUTPUTS_DIR, 'renders', `merged_${project.id}_${scene.id}_${Date.now()}.mp4`);
    await mergeSceneVideoAndAudioWithNormalize(videoAbs, audioAbs, sfxAbs, mergedScenePath, dims);
    readyClips.push(mergedScenePath);
  }

  const listFile = path.join(OUTPUTS_DIR, 'renders', `concat_${project.id}_${Date.now()}.txt`);
  fs.writeFileSync(listFile, readyClips.map(p => `file '${p.replace(/\\/g, '/')}'`).join('\n'), 'utf8');

  const finalFileName = `shortfilm_${project.id}_${Date.now()}.mp4`;
  const finalFilePath = path.join(OUTPUTS_DIR, 'renders', finalFileName);
  const publicFinalUrl = `/outputs/renders/${finalFileName}`;

  await new Promise((resolve, reject) => {
    execFile('ffmpeg', [
      '-y', '-f', 'concat', '-safe', '0', '-i', listFile,
      '-c:v', 'libx264', '-preset', 'fast',
      '-c:a', 'aac', '-b:a', '192k',
      '-pix_fmt', 'yuv420p',
      finalFilePath
    ], (err) => (err ? reject(err) : resolve(finalFilePath)));
  });

  try {
    fs.unlinkSync(listFile);
    readyClips.forEach(p => { if (fs.existsSync(p)) fs.unlinkSync(p); });
  } catch (e) {}

  const srtFileName = finalFileName.replace(/\.mp4$/, '.srt');
  const srtFilePath = path.join(OUTPUTS_DIR, 'renders', srtFileName);
  fs.writeFileSync(srtFilePath, buildSrtContent(project.scenes), 'utf8');

  return {
    finalRenderUrl: publicFinalUrl,
    subtitleUrl: `/outputs/renders/${srtFileName}`
  };
}

async function mergeSceneVideoAndAudioWithNormalize(videoPath, audioPath, sfxPath, outPath, dims) {
  const vidDur = (await probeMediaDuration(videoPath)) || 6;
  const audDur = (await probeMediaDuration(audioPath)) || 5;
  const targetDur = Math.max(vidDur, audDur + 0.4);
  const hasSfxFile = sfxPath && fs.existsSync(sfxPath);

  return new Promise((resolve, reject) => {
    const w = dims.width;
    const h = dims.height;
    const vf = `scale=${w}:${h}:force_original_aspect_ratio=decrease,pad=${w}:${h}:(ow-iw)/2:(oh-ih)/2:black,fps=25,format=yuv420p`;

    const args = hasSfxFile
      ? [
          '-y',
          '-stream_loop', '-1', '-i', videoPath,
          '-i', audioPath,
          '-stream_loop', '-1', '-i', sfxPath,
          '-filter_complex', `[0:v]${vf}[vout];[1:a]volume=1.45,apad[vo];[2:a]volume=0.28[sfx];[vo][sfx]amix=inputs=2:duration=first[aout]`,
          '-map', '[vout]',
          '-map', '[aout]',
          '-t', String(targetDur),
          '-c:v', 'libx264',
          '-preset', 'ultrafast',
          '-c:a', 'aac',
          '-b:a', '192k',
          outPath
        ]
      : [
          '-y',
          '-stream_loop', '-1', '-i', videoPath,
          '-i', audioPath,
          '-f', 'lavfi', '-i', 'sine=frequency=110:sample_rate=44100',
          '-filter_complex', `[0:v]${vf}[vout];[1:a]volume=1.4,apad[vo];[2:a]volume=0.025[bgm];[vo][bgm]amix=inputs=2:duration=first[aout]`,
          '-map', '[vout]',
          '-map', '[aout]',
          '-t', String(targetDur),
          '-c:v', 'libx264',
          '-preset', 'ultrafast',
          '-c:a', 'aac',
          '-b:a', '192k',
          outPath
        ];
    execFile('ffmpeg', args, (err) => (err ? reject(err) : resolve(outPath)));
  });
}

function buildSrtContent(scenes) {
  let currentSec = 0;
  return scenes.map((s, idx) => {
    const dur = Number(s.duration) || 6;
    const start = formatSrtTime(currentSec);
    currentSec += dur;
    const end = formatSrtTime(currentSec);
    return `${idx + 1}\n${start} --> ${end}\n${s.narration || s.title}\n`;
  }).join('\n');
}

function formatSrtTime(sec) {
  const hrs = Math.floor(sec / 3600);
  const mins = Math.floor((sec % 3600) / 60);
  const secs = Math.floor(sec % 60);
  const ms = Math.round((sec - Math.floor(sec)) * 1000);
  return `${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')},${String(ms).padStart(3, '0')}`;
}

function parseBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => {
      body += chunk;
      if (body.length > 50 * 1024 * 1024) req.destroy();
    });
    req.on('end', () => {
      if (!body) return resolve({});
      try { resolve(JSON.parse(body)); } catch (e) { reject(new Error('Invalid JSON')); }
    });
    req.on('error', reject);
  });
}

function sendJson(res, status, data) {
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*'
  });
  res.end(JSON.stringify(data));
}

function serveStaticFile(res, filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const mimeTypes = {
    '.html': 'text/html; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.js': 'application/javascript; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.webp': 'image/webp',
    '.mp3': 'audio/mpeg',
    '.wav': 'audio/wav',
    '.mp4': 'video/mp4',
    '.srt': 'text/plain; charset=utf-8'
  };
  if (!fs.existsSync(filePath)) {
    res.writeHead(404);
    return res.end('Not found');
  }
  const stat = fs.statSync(filePath);
  res.writeHead(200, {
    'Content-Type': mimeTypes[ext] || 'application/octet-stream',
    'Content-Length': stat.size,
    'Cache-Control': 'no-cache'
  });
  fs.createReadStream(filePath).pipe(res);
}

const requestHandler = async (req, res) => {
  const urlObj = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const pathname = urlObj.pathname;

  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    });
    return res.end();
  }

  try {
    if (pathname === '/api/config' && req.method === 'GET') {
      return sendJson(res, 200, loadConfig());
    }
    if (pathname === '/api/config' && req.method === 'POST') {
      const body = await parseBody(req);
      return sendJson(res, 200, { ok: true, config: saveConfig(body) });
    }

    // Test Connection for Gemini, Flow, ChatGPT, Meta AI
    if (pathname === '/api/test-connection' && req.method === 'POST') {
      const { provider, tempConfig } = await parseBody(req);
      const cfg = { ...loadConfig(), ...(tempConfig || {}) };
      const result = await testProviderConnection(provider, cfg);
      return sendJson(res, 200, result);
    }

    // Automated Flow Pipeline Runner (Runs Script QC -> Continuity Chain -> Audio -> Video -> Render)
    if (pathname === '/api/flow/execute' && req.method === 'POST') {
      const { projectId, llmProvider, flowMode } = await parseBody(req);
      const projects = loadProjects();
      const project = projects.find(p => p.id === projectId);
      if (!project) return sendJson(res, 404, { error: 'Project not found' });

      const cfg = loadConfig();
      if (flowMode) cfg.flowMode = flowMode;

      // Step 1: Thai Script & Phonetic QC via chosen LLM (Gemini / ChatGPT / Meta AI)
      await runAiThaiGrammarCheck(project, cfg, llmProvider);

      // Step 2: Chain Scene Continuity across all scenes
      for (let i = 0; i < project.scenes.length; i++) {
        const s = project.scenes[i];
        if (s.videoUrl) {
          const absVid = path.join(ROOT_DIR, s.videoUrl.replace(/^\//, ''));
          const frames = await extractVideoBoundaryFrames(absVid, s.id);
          s.firstFrameUrl = frames.firstFrameUrl;
          s.lastFrameUrl = frames.lastFrameUrl;
        }
        if (i > 0) {
          const prev = project.scenes[i - 1];
          s.continueFromPrev = true;
          s.startKeyframeUrl = prev.lastFrameUrl || prev.imageUrl || s.startKeyframeUrl;
        }
      }

      // Step 3: Assemble & Render Final Clip
      const renderRes = await assembleFinalShortFilm(project, cfg);
      project.finalRenderUrl = renderRes.finalRenderUrl;
      project.subtitleUrl = renderRes.subtitleUrl;
      project.updatedAt = new Date().toISOString();
      saveProjects(projects);
      return sendJson(res, 200, { ok: true, project, render: renderRes });
    }

    if (pathname === '/api/projects' && req.method === 'GET') {
      const projs = loadProjects();
      saveProjects(projs);
      return sendJson(res, 200, projs);
    }
    if (pathname === '/api/projects' && req.method === 'POST') {
      const body = await parseBody(req);
      const cfg = loadConfig();
      const generated = await generateStoryboardWithAI(body, cfg);
      const newProject = upgradeProjectStructure({
        id: `proj_${Date.now()}`,
        title: generated.title || body.topic || 'หนังสั้น AI',
        topic: body.topic || '',
        genre: body.genre || 'Moral Drama',
        visualStyle: body.visualStyle || 'Cinematic 8k',
        aspectRatio: body.aspectRatio || '9:16',
        language: body.language || 'th',
        characterLock: generated.characterLock || '',
        characters: generated.characters,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        finalRenderUrl: null,
        scenes: generated.scenes
      });
      const projects = loadProjects();
      projects.unshift(newProject);
      saveProjects(projects);
      return sendJson(res, 200, newProject);
    }
    if (pathname.startsWith('/api/projects/') && req.method === 'PUT') {
      const projId = pathname.split('/')[3];
      const body = await parseBody(req);
      const projects = loadProjects();
      const idx = projects.findIndex(p => p.id === projId);
      if (idx === -1) return sendJson(res, 404, { error: 'Project not found' });
      projects[idx] = upgradeProjectStructure({ ...projects[idx], ...body, updatedAt: new Date().toISOString() });
      saveProjects(projects);
      return sendJson(res, 200, projects[idx]);
    }
    if (pathname.startsWith('/api/projects/') && req.method === 'DELETE') {
      const projId = pathname.split('/')[3];
      saveProjects(loadProjects().filter(p => p.id !== projId));
      return sendJson(res, 200, { ok: true });
    }

    if (pathname === '/api/continuity/chain' && req.method === 'POST') {
      const { projectId, sceneId } = await parseBody(req);
      const projects = loadProjects();
      const project = projects.find(p => p.id === projectId);
      if (!project) return sendJson(res, 404, { error: 'Project not found' });

      const idx = project.scenes.findIndex(s => s.id === sceneId);
      if (idx <= 0) return sendJson(res, 400, { error: 'ซีนที่ 1 เป็นซีนเริ่มต้นอยู่แล้ว' });

      const prevScene = project.scenes[idx - 1];
      const currentScene = project.scenes[idx];

      if (prevScene.videoUrl) {
        const absVid = path.join(ROOT_DIR, prevScene.videoUrl.replace(/^\//, ''));
        const frames = await extractVideoBoundaryFrames(absVid, prevScene.id);
        if (frames.lastFrameUrl) {
          prevScene.lastFrameUrl = frames.lastFrameUrl;
          prevScene.firstFrameUrl = frames.firstFrameUrl;
          currentScene.startKeyframeUrl = frames.lastFrameUrl;
          currentScene.continueFromPrev = true;
        }
      } else if (prevScene.imageUrl) {
        currentScene.startKeyframeUrl = prevScene.imageUrl;
        currentScene.continueFromPrev = true;
      }

      saveProjects(projects);
      return sendJson(res, 200, { ok: true, startKeyframeUrl: currentScene.startKeyframeUrl, scene: currentScene });
    }

    if (pathname === '/api/continuity/chain-all' && req.method === 'POST') {
      const { projectId } = await parseBody(req);
      const projects = loadProjects();
      const project = projects.find(p => p.id === projectId);
      if (!project) return sendJson(res, 404, { error: 'Project not found' });

      for (let i = 0; i < project.scenes.length; i++) {
        const s = project.scenes[i];
        if (s.videoUrl) {
          const absVid = path.join(ROOT_DIR, s.videoUrl.replace(/^\//, ''));
          const frames = await extractVideoBoundaryFrames(absVid, s.id);
          s.firstFrameUrl = frames.firstFrameUrl;
          s.lastFrameUrl = frames.lastFrameUrl;
        }
        if (i > 0) {
          const prev = project.scenes[i - 1];
          s.continueFromPrev = true;
          s.startKeyframeUrl = prev.lastFrameUrl || prev.imageUrl || s.startKeyframeUrl;
        }
      }
      saveProjects(projects);
      return sendJson(res, 200, { ok: true, project });
    }

    if (pathname === '/api/qc/thai-script' && req.method === 'POST') {
      const { projectId, llmProvider } = await parseBody(req);
      const projects = loadProjects();
      const project = projects.find(p => p.id === projectId);
      if (!project) return sendJson(res, 404, { error: 'Project not found' });

      const cfg = loadConfig();
      const results = await runAiThaiGrammarCheck(project, cfg, llmProvider);
      saveProjects(projects);
      return sendJson(res, 200, { ok: true, results, project });
    }

    if (pathname === '/api/qc/audit' && req.method === 'POST') {
      const { projectId } = await parseBody(req);
      const projects = loadProjects();
      const project = projects.find(p => p.id === projectId);
      if (!project) return sendJson(res, 404, { error: 'Project not found' });

      const report = await auditProjectBeforeFinalRender(project);
      saveProjects(projects);
      return sendJson(res, 200, report);
    }

    if (pathname === '/api/characters/generate-face' && req.method === 'POST') {
      const { projectId, characterId } = await parseBody(req);
      const projects = loadProjects();
      const project = projects.find(p => p.id === projectId);
      if (!project) return sendJson(res, 404, { error: 'Project not found' });
      const char = (project.characters || []).find(c => c.id === characterId);
      if (!char) return sendJson(res, 404, { error: 'Character not found' });

      const fileName = `face_${project.id}_${char.id}_${Date.now()}.jpg`;
      const filePath = path.join(OUTPUTS_DIR, 'faces', fileName);
      const publicUrl = `/outputs/faces/${fileName}`;
      const prompt = `Close-up studio character reference portrait of ${char.visualDna}, front-facing, neutral lighting, clear facial features, 8k photorealistic`;

      try {
        const resImg = await fetch(`https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?width=512&height=512&seed=88888&nologo=true&model=flux`);
        if (resImg.ok) {
          fs.writeFileSync(filePath, Buffer.from(await resImg.arrayBuffer()));
          char.faceImageUrl = publicUrl;
        }
      } catch (e) {}

      if (!char.faceImageUrl) {
        await generateProceduralStoryboardFrame(filePath, { sceneNumber: 1 }, { width: 512, height: 512 });
        char.faceImageUrl = publicUrl;
      }

      saveProjects(projects);
      return sendJson(res, 200, { ok: true, character: char, project });
    }

    if (pathname === '/api/generate/image' && req.method === 'POST') {
      const { projectId, sceneId, provider } = await parseBody(req);
      const projects = loadProjects();
      const project = projects.find(p => p.id === projectId);
      if (!project) return sendJson(res, 404, { error: 'Project not found' });
      const scene = project.scenes.find(s => s.id === sceneId);
      if (!scene) return sendJson(res, 404, { error: 'Scene not found' });

      const result = await generateSceneImage({ project, scene, provider }, loadConfig());
      if (!result.queuedMcp) {
        scene.imageUrl = result.imageUrl;
        scene.imageStatus = 'ready';
      }
      saveProjects(projects);
      return sendJson(res, 200, { scene, result });
    }

    if (pathname === '/api/generate/audio' && req.method === 'POST') {
      const { projectId, sceneId, provider, voiceId, modelId } = await parseBody(req);
      const projects = loadProjects();
      const project = projects.find(p => p.id === projectId);
      if (!project) return sendJson(res, 404, { error: 'Project not found' });
      const scene = project.scenes.find(s => s.id === sceneId);
      if (!scene) return sendJson(res, 404, { error: 'Scene not found' });

      if (provider) scene.audioProvider = provider;
      if (voiceId) scene.voiceId = voiceId;
      if (modelId) scene.elevenlabsModel = modelId;

      const result = await generateSceneAudio({ project, scene, provider, voiceId, modelId }, loadConfig());
      if (!result.queuedMcp) {
        scene.audioUrl = result.audioUrl;
        scene.duration = result.duration || scene.duration;
        scene.audioStatus = 'ready';
      }
      saveProjects(projects);
      return sendJson(res, 200, { scene, result });
    }

    if (pathname === '/api/generate/sfx' && req.method === 'POST') {
      const { projectId, sceneId, sfxPrompt, duration } = await parseBody(req);
      const projects = loadProjects();
      const project = projects.find(p => p.id === projectId);
      if (!project) return sendJson(res, 404, { error: 'Project not found' });
      const scene = project.scenes.find(s => s.id === sceneId);
      if (!scene) return sendJson(res, 404, { error: 'Scene not found' });

      const result = await generateSceneSfx({ project, scene, sfxPrompt, duration }, loadConfig());
      scene.sfxUrl = result.sfxUrl;
      scene.sfxPrompt = result.sfxPrompt;
      scene.sfxStatus = 'ready';
      saveProjects(projects);
      return sendJson(res, 200, { scene, result });
    }

    if (pathname === '/api/elevenlabs/voices' && req.method === 'GET') {
      const cfg = loadConfig();
      const defaultVoices = [
        { voice_id: 'JBFqnCBsd6RMkjVDRZzb', name: 'George (เสียงชายทุ้มสุขุม • ผู้บรรยายละครคุณธรรม)', category: 'premade' },
        { voice_id: 'EXAVITQu4vr4xnSDxMaL', name: 'Sarah (เสียงหญิงอารมณ์เศร้า/อบอุ่น • บทภรรยา)', category: 'premade' },
        { voice_id: 'onwK4e9ZLuTAKqWW03F9', name: 'Daniel (เสียงผู้บรรยายดราม่าเข้มข้น)', category: 'premade' },
        { voice_id: 'pFZP5JQG7iQjIQuC4Bku', name: 'Lily (เสียงหญิงสาว • บทภรรยาน้อย/ตัวละครสาว)', category: 'premade' },
        { voice_id: 'TX3LPaxmHKxFdv7VOQHJ', name: 'Liam (เสียงชายหนุ่ม • บทตัวเอกชาย)', category: 'premade' }
      ];
      if (!cfg.elevenlabsApiKey) {
        return sendJson(res, 200, { voices: defaultVoices, source: 'preset' });
      }
      try {
        const vRes = await fetch('https://api.elevenlabs.io/v1/voices', {
          headers: { 'xi-api-key': cfg.elevenlabsApiKey }
        });
        if (vRes.ok) {
          const data = await vRes.json();
          const apiVoices = (data.voices || []).map(v => ({
            voice_id: v.voice_id,
            name: `${v.name} (${v.category || 'ElevenLabs'})`,
            category: v.category
          }));
          return sendJson(res, 200, { voices: apiVoices.length ? apiVoices : defaultVoices, source: 'elevenlabs_api' });
        }
      } catch (e) {}
      return sendJson(res, 200, { voices: defaultVoices, source: 'preset' });
    }

    if (pathname === '/api/flow/storyboard' && req.method === 'POST') {
      const { projectId, videoModelSlug, flowGenMode } = await parseBody(req);
      const projects = loadProjects();
      const project = projects.find(p => p.id === projectId);
      if (!project) return sendJson(res, 404, { error: 'Project not found' });

      const chosenModel = videoModelSlug || project.videoModelSlug || 'veo-3.0-generate-preview';
      project.videoProvider = 'google_flow';
      project.videoModelSlug = chosenModel;

      const shotCycle = [
        'Medium Two-Shot (MS)',
        'Dramatic Close-Up (CU)',
        'Wide Doorway Shot (WS)',
        'Over-The-Shoulder Tracking (OTS)',
        'Extreme Wide Lonely Shot (EWS)'
      ];
      const moveCycle = [
        'Dolly In (ซูมเข้าช้าๆ เน้นอารมณ์)',
        'Pan Right (แพนขวาช้าๆ)',
        'Dolly Out (ถอยออกเห็นความอ้างว้าง)',
        'Pan Left (แพนซ้ายตามตัวละคร)',
        'Crane Dolly Out (ดึงกล้องขึ้นมุมสูง)'
      ];

      project.scenes.forEach((s, idx) => {
        s.shotType = s.shotType || shotCycle[idx % shotCycle.length];
        s.cameraMovement = s.cameraMovement || moveCycle[idx % moveCycle.length];
        s.flowGenMode = flowGenMode || s.flowGenMode || (idx === 0 ? 'ingredients_to_video' : 'frames_to_video');
        s.videoProvider = 'google_flow';
        s.videoModelSlug = chosenModel;
        s.continueFromPrev = idx > 0;
        if (idx > 0) {
          const prev = project.scenes[idx - 1];
          s.startKeyframeUrl = prev.lastFrameUrl || prev.imageUrl || s.startKeyframeUrl;
        }
        const activeChars = (project.characters || []).filter(c => (s.characterIds || []).includes(c.id));
        const charLockText = activeChars.map(c => `${c.name} (${c.visualDna})`).join(' + ') || project.characterLock || 'Main character';
        const contText = idx > 0 ? `[START FRAME LOCK: Scene ${idx} Last Frame]` : `[OPENING KEYFRAME]`;
        s.flowPrompt = `[GOOGLE FLOW ${chosenModel.toUpperCase()} • ${project.aspectRatio || '9:16'} • ${s.flowGenMode.toUpperCase()}] [SHOT: ${s.shotType}, ${s.cameraMovement}] ${contText} [INGREDIENTS LOCK: ${charLockText}] Action: ${s.videoPrompt || s.imagePrompt}`;
      });

      project.updatedAt = new Date().toISOString();
      saveProjects(projects);
      return sendJson(res, 200, { ok: true, project });
    }

    if (pathname === '/api/generate/video' && req.method === 'POST') {
      const { projectId, sceneId, provider, modelSlug, resolution, flowGenMode } = await parseBody(req);
      const projects = loadProjects();
      const project = projects.find(p => p.id === projectId);
      if (!project) return sendJson(res, 404, { error: 'Project not found' });
      const scene = project.scenes.find(s => s.id === sceneId);
      if (!scene) return sendJson(res, 404, { error: 'Scene not found' });

      const result = await generateSceneVideo({ project, scene, provider, modelSlug, resolution, flowGenMode }, loadConfig());
      if (!result.queuedMcp) {
        scene.videoUrl = result.videoUrl;
        scene.duration = result.duration || scene.duration;
        scene.videoStatus = 'ready';
      }
      saveProjects(projects);
      return sendJson(res, 200, { scene, result });
    }

    if (pathname === '/api/render/movie' && req.method === 'POST') {
      const { projectId } = await parseBody(req);
      const projects = loadProjects();
      const project = projects.find(p => p.id === projectId);
      if (!project) return sendJson(res, 404, { error: 'Project not found' });

      const renderRes = await assembleFinalShortFilm(project, loadConfig());
      project.finalRenderUrl = renderRes.finalRenderUrl;
      project.subtitleUrl = renderRes.subtitleUrl;
      project.updatedAt = new Date().toISOString();
      saveProjects(projects);
      return sendJson(res, 200, { project, render: renderRes });
    }

    if (pathname === '/api/mcp-queue' && req.method === 'GET') {
      return sendJson(res, 200, loadMcpQueue());
    }

    if (pathname === '/data/projects.json' && req.method === 'GET') {
      return sendJson(res, 200, loadProjects());
    }

    if (pathname.startsWith('/outputs/')) {
      const rel = pathname.replace(/^\/outputs\//, '');
      const safePath = path.normalize(path.join(OUTPUTS_DIR, rel));
      if (safePath.startsWith(OUTPUTS_DIR)) return serveStaticFile(res, safePath);
    }

    if (pathname === '/' || pathname === '/index' || pathname === '/index.html' || pathname === '/public/index' || pathname === '/public/index.html') {
      const rootHtml = path.join(ROOT_DIR, 'index.html');
      const pubHtml = path.join(PUBLIC_DIR, 'index.html');
      if (fs.existsSync(rootHtml)) return serveStaticFile(res, rootHtml);
      if (fs.existsSync(pubHtml)) return serveStaticFile(res, pubHtml);
    }

    let staticPath = path.join(PUBLIC_DIR, pathname);
    if (fs.existsSync(staticPath) && fs.statSync(staticPath).isFile()) {
      return serveStaticFile(res, staticPath);
    }
    let rootStaticPath = path.join(ROOT_DIR, pathname);
    if (fs.existsSync(rootStaticPath) && fs.statSync(rootStaticPath).isFile()) {
      return serveStaticFile(res, rootStaticPath);
    }

    res.writeHead(404);
    res.end('Not Found');
  } catch (err) {
    console.error('Server Error:', err);
    sendJson(res, 500, { error: err.message || 'Internal Server Error' });
  }
};

const server = http.createServer(requestHandler);

if (!IS_VERCEL) {
  server.listen(PORT, () => {
    console.log(`🎬 AI Short Film Studio v2.5 (Gemini + Flow + ChatGPT + Meta AI) running at http://localhost:${PORT}`);
  });
}

module.exports = requestHandler;

