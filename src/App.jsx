import React, { useState, useEffect } from 'react';

const ALL_MAINS = [
  'fantasy', 'mystery', 'romance', 'thriller', 'horror', 
  'scifi', 'historical', 'adventure', 'yaoi', 'yuri'
];

const ALL_SUBS = [
  'Historical', 'School/Campus', 'Dark/Tragedy', 'Action/Adventure', 'Sci-Fi/Futuristic'
];

export default function App() {
  const [user, setUser] = useState(null);
  const [selectedMains, setSelectedMains] = useState([]);
  const [selectedSubs, setSelectedSubs] = useState([]);
  
  const [recommendations, setRecommendations] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);3
  const [sessionId] = useState(crypto.randomUUID());
  
  const [stats, setStats] = useState({ likes: 0, totalSwipes: 0, precisionAt3: '0.0' });

  // 1. ฟังก์ชัน Onboarding สร้าผู้ใช้
  const handleOnboarding = async () => {
    if (selectedMains.length === 0 || selectedSubs.length === 0) {
      alert('กรุณาเลือกอย่างน้อย 1 หมวดหลัก และ 1 หมวดย่อย');
      return;
    }

    const res = await fetch('https://letread-backend.onrender.com/api/users/onboarding', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: `User_${Math.floor(Math.random() * 1000)}`,
        selectedMains,
        selectedSubs
      })
    });
    const data = await res.json();
    setUser(data.user);
    fetchRecommendations(data.user.id);
  };

  // 2. ดึงหนังสือแนะนำ Top-3
  const fetchRecommendations = async (userId) => {
    const res = await fetch(`https://letread-backend.onrender.com/api/recommend/${userId}`);
    const data = await res.json();
    setRecommendations(data.recommendations || []);
    setCurrentIndex(0);
  };

  // 3. บันทึกผล Swipe
  const handleSwipe = async (action) => {
    const currentBook = recommendations[currentIndex];
    if (!currentBook) return;

    const res = await fetch('https://letread-backend.onrender.com/api/swipe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: user.id,
        bookId: currentBook.id,
        action,
        sessionId
      })
    });
    const data = await res.json();
    setStats({ likes: data.likes, totalSwipes: data.totalSwipes, precisionAt3: data.precisionAt3 });
    setCurrentIndex(prev => prev + 1);
  };

  const toggleSelect = (item, list, setList, max) => {
    if (list.includes(item)) {
      setList(list.filter(i => i !== item));
    } else {
      if (list.length < max) setList([...list, item]);
    }
  };

  // หน้าจอ Onboarding
  if (!user) {
    return (
      <div className="min-h-screen bg-slate-900 text-white flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-slate-800 p-6 rounded-2xl shadow-xl space-y-6">
          <h1 className="text-2xl font-bold text-center text-indigo-400">Let Read - Onboarding</h1>
          
          <div>
            <h2 className="text-sm font-semibold mb-2 text-slate-300">เลือกหมวดหลัก (1-5 หมวด)</h2>
            <div className="flex flex-wrap gap-2">
              {ALL_MAINS.map(m => (
                <button
                  key={m}
                  onClick={() => toggleSelect(m, selectedMains, setSelectedMains, 5)}
                  className={`px-3 py-1.5 rounded-full text-sm font-medium border ${
                    selectedMains.includes(m) ? 'bg-indigo-600 border-indigo-500 text-white' : 'border-slate-600 text-slate-400'
                  }`}
                >
                  {m}
                </button>
              ))}
            </div>
          </div>

          <div>
            <h2 className="text-sm font-semibold mb-2 text-slate-300">เลือกหมวดย่อย</h2>
            <div className="flex flex-wrap gap-2">
              {ALL_SUBS.map(s => (
                <button
                  key={s}
                  onClick={() => toggleSelect(s, selectedSubs, setSelectedSubs, 5)}
                  className={`px-3 py-1.5 rounded-full text-sm font-medium border ${
                    selectedSubs.includes(s) ? 'bg-emerald-600 border-emerald-500 text-white' : 'border-slate-600 text-slate-400'
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>

          <button
            onClick={handleOnboarding}
            className="w-full py-3 bg-indigo-500 hover:bg-indigo-600 rounded-xl font-bold transition"
          >
            เริ่มทดสอบแนะนำหนังสือ
          </button>
        </div>
      </div>
    );
  }

  const currentBook = recommendations[currentIndex];

  // หน้าจอ Swipe UI + Precision Dashboard
  return (
    <div className="min-h-screen bg-slate-900 text-white flex flex-col items-center justify-center p-4">
      {/* Precision@3 Dashboard */}
      <div className="mb-6 bg-slate-800 p-4 rounded-xl border border-slate-700 flex gap-6 text-center">
        <div>
          <p className="text-xs text-slate-400">Swiped</p>
          <p className="text-xl font-bold">{stats.totalSwipes}/3</p>
        </div>
        <div>
          <p className="text-xs text-slate-400">Likes</p>
          <p className="text-xl font-bold text-emerald-400">{stats.likes}</p>
        </div>
        <div>
          <p className="text-xs text-slate-400">Precision@3</p>
          <p className="text-xl font-bold text-indigo-400">{stats.precisionAt3}%</p>
        </div>
      </div>

      {/* Swipe Card UI */}
      {currentBook ? (
        <div className="max-w-sm w-full bg-slate-800 rounded-2xl overflow-hidden shadow-2xl border border-slate-700 flex flex-col">
          <img 
            src={currentBook.cover_url || 'https://via.placeholder.com/400x300'} 
            alt={currentBook.title}
            className="h-64 w-full object-cover"
          />
          <div className="p-5 flex-1 flex flex-col justify-between space-y-4">
            <div>
              <span className="text-xs font-semibold px-2.5 py-1 bg-indigo-900/60 text-indigo-300 rounded-md border border-indigo-700">
                Similarity: {(currentBook.similarity * 100).toFixed(1)}%
              </span>
              <h2 className="text-xl font-bold mt-2">{currentBook.title}</h2>
              <p className="text-sm text-slate-400 mt-1">
                {currentBook.main_category} • {currentBook.subcategory}
              </p>
            </div>

            <div className="flex gap-4">
              <button
                onClick={() => handleSwipe('DISLIKE')}
                className="flex-1 py-3 bg-rose-600/20 text-rose-400 border border-rose-500/30 rounded-xl font-bold hover:bg-rose-600/30"
              >
                Dislike ✕
              </button>
              <button
                onClick={() => handleSwipe('LIKE')}
                className="flex-1 py-3 bg-emerald-600/20 text-emerald-400 border border-emerald-500/30 rounded-xl font-bold hover:bg-emerald-600/30"
              >
                Like ♥
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-slate-800 p-8 rounded-2xl text-center max-w-sm">
          <h2 className="text-xl font-bold text-indigo-400 mb-2">ทดสอบครบ 3 เล่มแล้ว!</h2>
          <p className="text-sm text-slate-300 mb-4">
            ผลคะแนน Precision@3 ของ Session นี้เท่ากับ <span className="font-bold text-emerald-400">{stats.precisionAt3}%</span>
          </p>
          <button
            onClick={() => window.location.reload()}
            className="px-6 py-2 bg-indigo-500 rounded-lg text-sm font-semibold"
          >
            เริ่มทดสอบใหม่
          </button>
        </div>
      )}
    </div>
  );
}