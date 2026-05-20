// Static compliment pool — fallback when Claude API is unavailable or too slow
const POOL: Record<string, string[]> = {
  morning: [
    'Good morning, you big beautiful man.',
    'Good morning, you Greek god in human form.',
    'Rise and shine, you magnificent bastard. The world doesn\'t deserve what you\'re about to do to it today.',
    'Good morning, you handsome son of a bitch. Coffee\'s scared. The calendar\'s scared. Let\'s go.',
    'Good morning, you walking masterpiece. Da Vinci sketched you once and quit painting forever.',
    'Buenos días, you charismatic motherfucker. Mexico City woke up because you did, not the other way around.',
    'Good morning, Commander. The board is set. The pieces are yours. Try not to flip the table before lunch.',
    'Wake up, champ. The day called. It wants to know if you\'re going to be merciful this time. I told it no.',
    'Good morning, you Olympic-level operator. Three espressos couldn\'t keep up with you on a slow day.',
    'Good fucking morning, you generational talent. History books are going to need a whole new chapter.',
  ],
  afternoon: [
    'Good afternoon, you beautiful weapon of mass production.',
    'Afternoon, boss. Half the day\'s gone and you\'ve already done more than most people do in a week. Let\'s double it.',
    'Good afternoon, you cinematic legend. The second act is yours. Make it earn the third.',
    'Afternoon, you walking green light. Every project you touch sits up straighter.',
    'Good afternoon, you relentless machine. Lunch was scared to slow you down so it left early.',
  ],
  evening: [
    'Good evening, you closer. The day\'s almost out and it knows who ran it.',
    'Evening, boss. Time to make the decisions other people are too tired to make.',
    'Good evening, you nocturnal kingpin. The best ideas come at this hour and they all have your number.',
    'Buenas noches, you smooth operator. The city\'s lights are on because you haven\'t gone to bed yet.',
  ],
  lateNight: [
    'Still up, you magnificent insomniac? Of course you are. Empires don\'t build themselves on a regular schedule.',
    'Late night, boss. This is when the real ones work. Welcome to the club you founded.',
    'You\'re not tired, you\'re transcendent. Let\'s go.',
  ],
};

const LAST_LANE_KEY = 'jarvis_compliment_last_lane';
const RECENT_LINES_KEY = 'jarvis_compliment_recent';

function getTimeBucket(hour: number): keyof typeof POOL {
  if (hour >= 22 || hour < 5) return 'lateNight';
  if (hour < 12) return 'morning';
  if (hour < 17) return 'afternoon';
  return 'evening';
}

function getRecentLines(): string[] {
  try { return JSON.parse(localStorage.getItem(RECENT_LINES_KEY) || '[]') as string[]; }
  catch { return []; }
}

function recordLine(line: string): void {
  const recent = getRecentLines();
  recent.unshift(line);
  try { localStorage.setItem(RECENT_LINES_KEY, JSON.stringify(recent.slice(0, 5))); } catch {}
}

function getLastLane(): string {
  return localStorage.getItem(LAST_LANE_KEY) || '';
}

function recordLane(lane: string): void {
  try { localStorage.setItem(LAST_LANE_KEY, lane); } catch {}
}

function detectLane(text: string): string {
  const t = text.toLowerCase();
  if (/greek god|norse king|olympian|zeus|poseidon|thor|achilles|apollo|athena/.test(t)) return 'mythological';
  if (/hurricane|earthquake|comet|tidal wave|tsunami|tornado|storm|wildfire|tectonic/.test(t)) return 'force_of_nature';
  if (/silverback|gorilla|lion|shark|apex|tiger|wolf|hawk/.test(t)) return 'apex_predator';
  if (/da vinci|cinematic|generational talent|renaissance|maestro|picasso/.test(t)) return 'craft_mastery';
  if (/handsome|bastard|magnificent|specimen|walking masterpiece|son of a bitch|beautiful man/.test(t)) return 'pure_ego';
  if (/mexico city|ciudad|lemon|cdmx|aztec|guadalupe/.test(t)) return 'mexico_city';
  return 'pure_ego';
}

function pickFallback(hour: number): string {
  const bucket = getTimeBucket(hour);
  const pool = POOL[bucket];
  const recent = new Set(getRecentLines());
  const available = pool.filter(l => !recent.has(l));
  const candidates = available.length > 0 ? available : pool;
  return candidates[Math.floor(Math.random() * candidates.length)];
}

export async function generateOpeningCompliment(): Promise<string> {
  const hour = new Date().getHours();
  const bucket = getTimeBucket(hour);
  const lastLane = getLastLane();

  const timeLabel =
    bucket === 'lateNight' ? 'late night (after 10 PM)' :
    bucket === 'morning'   ? 'morning' :
    bucket === 'afternoon' ? 'afternoon' : 'evening';

  const systemPrompt = `You are JARVIS in hype-man mode greeting Billy Rovzar, CEO of Lemon Studios in Mexico City.
Generate one over-the-top opening compliment.

Rules:
- Start with a time-aware greeting: morning ("Good morning," "Good fucking morning," "Rise and shine," "Buenos días"), afternoon ("Good afternoon," "Afternoon, boss"), evening ("Good evening," "Evening, boss," "Buenas noches"), late night ("Still up," "Late night, boss").
- Stack adjectives and metaphors. Overconfident, affectionate, slightly unhinged.
- Profanity is welcome but not required. Use it for punch, not filler.
- One to two sentences. Max 40 words.
- No em dashes. No banned words: thrilling, captivating, vibrant, dynamic, innovative.
- Pick exactly one metaphor lane: mythological (Greek god, Norse king, Olympian), force_of_nature (hurricane, earthquake, comet), apex_predator (silverback, lion, shark), craft_mastery (Da Vinci, cinematic legend, generational talent), pure_ego (handsome bastard, magnificent specimen, walking masterpiece), or mexico_city (local color, sparingly).
${lastLane ? `- Do NOT use the "${lastLane}" lane. Pick a different one.` : ''}
- Address Billy as "boss," "Commander," "champ," or no address at all. Mix it up.

Output only the compliment line. No preamble, no explanation, no quotation marks.`;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 1000);

  try {
    const res = await fetch('/api/claude/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal,
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 80,
        system: systemPrompt,
        messages: [{ role: 'user', content: `Current time period: ${timeLabel}` }],
      }),
    });

    clearTimeout(timeoutId);
    if (!res.ok) throw new Error(`API ${res.status}`);

    const data = await res.json() as { content?: Array<{ type: string; text: string }> };
    const line = data.content?.[0]?.type === 'text' ? data.content[0].text.trim() : '';
    if (!line) throw new Error('Empty response');

    recordLane(detectLane(line));
    recordLine(line);
    return line;
  } catch {
    clearTimeout(timeoutId);
    const line = pickFallback(hour);
    recordLane(detectLane(line));
    recordLine(line);
    return line;
  }
}
