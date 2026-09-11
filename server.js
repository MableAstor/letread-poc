import express from 'express';
import cors from 'cors';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

const ALL_MAINS = [
  'fantasy', 'mystery', 'romance', 'thriller', 'horror', 
  'scifi', 'historical', 'adventure', 'yaoi', 'yuri'
];

const ALL_SUBS = [
  'Historical', 'School/Campus', 'Dark/Tragedy', 'Action/Adventure', 'Sci-Fi/Futuristic'
];

function parseVector(vec) {
  if (typeof vec === 'string') return JSON.parse(vec);
  return vec || Array(15).fill(0);
}

function normalizeL2(vec) {
  const norm = Math.sqrt(vec.reduce((sum, val) => sum + val * val, 0));
  if (norm === 0) return vec;
  return vec.map(val => val / norm);
}

function generateVector(selectedMains = [], selectedSubs = []) {
  const wMain = selectedMains.length > 0 ? 0.6 / selectedMains.length : 0;
  const wSub = selectedSubs.length > 0 ? 0.4 / selectedSubs.length : 0;

  const mainVec = ALL_MAINS.map(m => selectedMains.includes(m) ? wMain : 0);
  const subVec = ALL_SUBS.map(s => selectedSubs.includes(s) ? wSub : 0);

  const rawVector = [...mainVec, ...subVec];
  return JSON.stringify(normalizeL2(rawVector));
}

function calculateCosineSimilarity(vecA, vecB) {
  const a = parseVector(vecA);
  const b = parseVector(vecB);

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

// 1. Endpoint Onboarding
app.post('/api/users/onboarding', async (req, res) => {
  try {
    const { username, selectedMains, selectedSubs } = req.body;
    const preferenceVector = generateVector(selectedMains, selectedSubs);

    const { data: user, error } = await supabase
      .from('users')
      .insert([{ username, preference_vector: preferenceVector }])
      .select()
      .single();

    if (error) return res.status(500).json({ error: error.message });
    res.json({ user });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 2. Endpoint Recomendations
app.get('/api/recommend/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const { sessionId } = req.query;
    const epsilon = 0.2;

    const { data: user, error: uErr } = await supabase
      .from('users')
      .select('*')
      .eq('id', userId)
      .single();

    if (uErr || !user) return res.status(404).json({ error: 'User not found' });

    let swipedBookIds = [];
    if (sessionId) {
      const { data: logs } = await supabase
        .from('swipe_logs')
        .select('book_id')
        .eq('user_id', userId)
        .eq('session_id', sessionId);
      
      if (logs) swipedBookIds = logs.map(l => l.book_id);
    }

    const { data: books, error: bErr } = await supabase.from('books').select('*');
    if (bErr) throw bErr;

    const unswipedBooks = books.filter(b => !swipedBookIds.includes(b.id));

    if (unswipedBooks.length === 0) {
      return res.json({ recommendations: [], message: 'หมดแล้วครับ!' });
    }

    const scoredBooks = unswipedBooks.map(book => {
      const sim = calculateCosineSimilarity(user.preference_vector, book.feature_vector);
      return { ...book, similarity: isNaN(sim) ? 0 : sim };
    });

    scoredBooks.sort((a, b) => b.similarity - a.similarity);

    let finalRecommendations = [];
    if (Math.random() < epsilon && scoredBooks.length > 3) {
      const top2 = scoredBooks.slice(0, 2);
      const remainingBooks = scoredBooks.slice(2);
      const randomBook = remainingBooks[Math.floor(Math.random() * remainingBooks.length)];
      finalRecommendations = [...top2, { ...randomBook, isExploration: true }];
    } else {
      finalRecommendations = scoredBooks.slice(0, 3);
    }

    res.json({ recommendations: finalRecommendations });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 3. Endpoint Swipe
app.post('/api/swipe', async (req, res) => {
  try {
    const { userId, bookId, action, sessionId } = req.body;

    await supabase.from('swipe_logs').insert([
      { user_id: userId, book_id: bookId, action, session_id: sessionId }
    ]);

    if (action === 'LIKE') {
      const { data: user } = await supabase.from('users').select('preference_vector').eq('id', userId).single();
      const { data: book } = await supabase.from('books').select('feature_vector').eq('id', bookId).single();

      if (user && book) {
        const uVec = parseVector(user.preference_vector);
        const bVec = parseVector(book.feature_vector);
        const learningRate = 0.15;

        const updatedVec = uVec.map((val, idx) => val + learningRate * (bVec[idx] || 0));
        const normalizedVec = normalizeL2(updatedVec);

        await supabase
          .from('users')
          .update({ preference_vector: JSON.stringify(normalizedVec) })
          .eq('id', userId);
      }
    }

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

// 4. Endpoint สรุปผลการแนะนำ (Summary)
app.get('/api/summary/:userId', async (req, res) => {
  try {
    const { userId } = req.params;

    const { data: user } = await supabase
      .from('users')
      .select('*')
      .eq('id', userId)
      .single();

    if (!user) return res.status(404).json({ error: 'User not found' });

    const { data: books } = await supabase.from('books').select('*');

    const scoredBooks = books.map(book => {
      const sim = calculateCosineSimilarity(user.preference_vector, book.feature_vector);
      return { ...book, similarity: isNaN(sim) ? 0 : sim };
    });

    scoredBooks.sort((a, b) => b.similarity - a.similarity);

    const top3Matched = scoredBooks.slice(0, 3);
    const remainingBooks = scoredBooks.slice(3);
    const discoveredBook = remainingBooks.find(b => b.similarity > 0) || remainingBooks[0];

    res.json({
      top3Matched,
      discoveredBook
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));