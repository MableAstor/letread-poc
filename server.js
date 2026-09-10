import express from 'express';
import cors from 'cors';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

// โหลดค่าจากไฟล์ .env
dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

// อ่านค่าจาก process.env
const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

// ... (โค้ดส่วนที่เหลือเหมือนเดิม)

// หมวดหมู่ 15 มิติ (10 หลัก + 5 ย่อย)
const ALL_MAINS = [
  'fantasy', 'mystery', 'romance', 'thriller', 'horror', 
  'scifi', 'historical', 'adventure', 'yaoi', 'yuri'
];

const ALL_SUBS = [
  'Historical', 'School/Campus', 'Dark/Tragedy', 'Action/Adventure', 'Sci-Fi/Futuristic'
];

// ฟังก์ชันสร้าง Vector (15 มิติ) - แปลงเป็น String รูปแบบ '[0,0,...]' สำหรับ Supabase Vector
function generateVector(selectedMains = [], selectedSubs = []) {
  const wMain = selectedMains.length > 0 ? 0.6 / selectedMains.length : 0;
  const wSub = selectedSubs.length > 0 ? 0.4 / selectedSubs.length : 0;

  const mainVec = ALL_MAINS.map(m => selectedMains.includes(m) ? wMain : 0);
  const subVec = ALL_SUBS.map(s => selectedSubs.includes(s) ? wSub : 0);

  return JSON.stringify([...mainVec, ...subVec]);
}

// ฟังก์ชัน Cosine Similarity
function calculateCosineSimilarity(vecA, vecB) {
  const a = typeof vecA === 'string' ? JSON.parse(vecA) : vecA;
  const b = typeof vecB === 'string' ? JSON.parse(vecB) : vecB;

  if (!a || !b || a.length !== b.length) return 0;

  let dot = 0, normA = 0, normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  if (normA === 0 || normB === 0) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

// 1. Endpoint สร้าง User (Onboarding)
app.post('/api/users/onboarding', async (req, res) => {
  try {
    const { username, selectedMains, selectedSubs } = req.body;
    const preferenceVector = generateVector(selectedMains, selectedSubs);

    const { data: user, error } = await supabase
      .from('users')
      .insert([{ username, preference_vector: preferenceVector }])
      .select()
      .single();

    if (error) {
      console.error('Insert User Error:', error);
      return res.status(500).json({ error: error.message });
    }

    res.json({ user });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// 2. Endpoint ดึงหนังสือแนะนำ Top 3
app.get('/api/recommend/:userId', async (req, res) => {
  try {
    const { userId } = req.params;

    const { data: user, error: uErr } = await supabase
      .from('users')
      .select('*')
      .eq('id', userId)
      .single();

    if (uErr || !user) return res.status(404).json({ error: 'User not found' });

    const { data: books, error: bErr } = await supabase.from('books').select('*');
    if (bErr) throw bErr;

    const scoredBooks = books.map(book => {
      const sim = calculateCosineSimilarity(user.preference_vector, book.feature_vector);
      return { ...book, similarity: isNaN(sim) ? 0 : sim };
    });

    scoredBooks.sort((a, b) => b.similarity - a.similarity);

    res.json({ recommendations: scoredBooks.slice(0, 3) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 3. Endpoint บันทึก Swipe
app.post('/api/swipe', async (req, res) => {
  try {
    const { userId, bookId, action, sessionId } = req.body;

    await supabase.from('swipe_logs').insert([
      { user_id: userId, book_id: bookId, action, session_id: sessionId }
    ]);

    const { data: logs } = await supabase
      .from('swipe_logs')
      .select('*')
      .eq('user_id', userId)
      .eq('session_id', sessionId);

    const totalSwipes = logs ? logs.length : 0;
    const likes = logs ? logs.filter(l => l.action === 'LIKE').length : 0;
    const precisionAt3 = totalSwipes > 0 ? ((likes / totalSwipes) * 100).toFixed(1) : '0.0';

    res.json({ likes, totalSwipes, precisionAt3 });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.listen(5000, () => console.log('Server running on port 5000'));