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
  const [currentIndex, setCurrentIndex] = useState(0);
  const [sessionId] = useState(crypto.randomUUID());
  
  const [stats, setStats] = useState({ likes: 0, totalSwipes: 0, precisionAt3: '0.0' });
  const [showPauseModal, setShowPauseModal] = useState(false);
  const [summaryData, setSummaryData] = useState(null);

  // จับเวลา Inactivity 20 นาที
  useEffect(() => {
    if (!user || summaryData || showPauseModal) return;

    const timer = setTimeout(() => {
      alert('ไม่มีการใช้งานเกิน 20 นาที ระบบจะสรุปผลคำแนะนำให้อัตโนมัติ');
      handleFinishSession();
    }, 20 * 60 * 1000);

    return () => clearTimeout(timer);
  }, [user, currentIndex, summaryData, showPauseModal]);

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

  const fetchRecommendations = async (userId) => {
    const res = await fetch(`https://letread-backend.onrender.com/api/recommend/${userId}?sessionId=${sessionId}`);
    const data = await res.json();
    
    if (data.recommendations && data.recommendations.length > 0) {
      setRecommendations(data.recommendations);
      setCurrentIndex(0);
    } else {
      handleFinishSession();
    }
  };

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

    if (currentIndex + 1 < recommendations.length) {
      setCurrentIndex(prev => prev + 1);
    } else {
      fetchRecommendations(user.id);
    }
  };

  const handleFinishSession = async () => {
    setShowPauseModal(false);
    if (!user) return;
    const res = await fetch(`https://letread-backend.onrender.com/api/summary/${user.id}`);
    const data = await res.json();
    setSummaryData(data);
  };

  const toggleSelect = (item, list, setList, max) => {
    if (list.includes(item)) {
      setList(list.filter(i => i !== item));
    } else {
      if (list.length < max) setList([...list, item]);
    }
  };

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

  // หน้าสรุปผลลัพธ์
  if (summaryData) {
    return (
      <div className="min-h-screen bg-slate-900 text-white p-6 flex flex-col items-center">
        <div className="max-w-xl w-full space-y-6">
          <div className="bg-slate-800 p-6 rounded-2xl text-center border border-slate-700">
            <h1 className="text-2xl font-bold text-indigo-400 mb-1">สรุปผลการแนะนำหนังสือของคุณ</h1>
            <p className="text-sm text-slate-400">วิเคราะห์จากพฤติกรรมการ Swipe ทั้งหมด {stats.totalSwipes} ครั้ง</p>
          </div>

          <div>
            <h2 className="text-lg font-bold text-emerald-400 mb-3">🎯 3 เล่มที่ตรงกับสไตล์ของคุณมากที่สุด</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {summaryData.top3Matched.map(b => (
                <div key={b.id} className="bg-slate-800 rounded-xl overflow-hidden border border-slate-700 flex flex-col">
                  <img src={b.cover_url || 'https://via.placeholder.com/300x450'} alt={b.title} className="aspect-[2/3] w-full object-cover" />
                  <div className="p-3">
                    <span className="text-xs font-bold text-emerald-400">Match {(b.similarity * 100).toFixed(1)}%</span>
                    <h3 className="font-bold text-sm truncate">{b.title}</h3>
                    <p className="text-xs text-slate-400">{b.main_category}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {summaryData.discoveredBook && (
            <div className="bg-gradient-to-r from-purple-900/40 to-slate-800 p-5 rounded-2xl border border-purple-500/30">
              <span className="text-xs font-bold px-2.5 py-1 bg-purple-600/30 text-purple-300 rounded-md border border-purple-500/40">
                ✨ หมวดหมู่นอกสายตาที่คุณอาจจะชอบ
              </span>
              <div className="flex gap-4 mt-3 items-center">
                <img src={summaryData.discoveredBook.cover_url || 'https://via.placeholder.com/150x225'} alt="" className="w-24 aspect-[2/3] object-cover rounded-lg" />
                <div>
                  <h3 className="font-bold text-lg text-purple-200">{summaryData.discoveredBook.title}</h3>
                  <p className="text-sm text-slate-400 mb-1">{summaryData.discoveredBook.main_category} • {summaryData.discoveredBook.subcategory}</p>
                  <p className="text-xs text-purple-300/80">ระบบค้นพบว่าคุณสนใจเนื้อหาหมวดนี้เพิ่มขึ้นจากพฤติกรรมการ Swipe</p>
                </div>
              </div>
            </div>
          )}

          <button
            onClick={() => window.location.reload()}
            className="w-full py-3 bg-indigo-500 hover:bg-indigo-600 rounded-xl font-bold transition"
          >
            เริ่มทดสอบ Session ใหม่
          </button>
        </div>
      </div>
    );
  }

  const currentBook = recommendations[currentIndex];

  // หน้า Swipe UI (Tinder Card Style)
  return (
    <div className="min-h-screen bg-slate-900 text-white flex flex-col items-center justify-center p-4 relative">
      <div className="mb-3 bg-slate-800/80 backdrop-blur-md px-6 py-2.5 rounded-full border border-slate-700 flex gap-6 text-center text-sm">
        <div><span className="text-slate-400">Swiped:</span> <strong className="ml-1">{stats.totalSwipes}</strong></div>
        <div><span className="text-slate-400">Likes:</span> <strong className="text-emerald-400 ml-1">{stats.likes}</strong></div>
        <div><span className="text-slate-400">Precision:</span> <strong className="text-indigo-400 ml-1">{stats.precisionAt3}%</strong></div>
      </div>

      <button 
        onClick={() => setShowPauseModal(true)}
        className="mb-4 px-4 py-1.5 bg-amber-500/20 text-amber-300 border border-amber-500/30 rounded-full text-xs font-semibold hover:bg-amber-500/30"
      >
        ⏸ หยุดปัดชั่วคราว
      </button>

      {/* Modal ป๊อปอัปเลือก พัก/สรุปผล */}
      {showPauseModal && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-slate-800 p-6 rounded-2xl border border-slate-700 max-w-sm w-full space-y-4 text-center">
            <h2 className="text-xl font-bold text-indigo-400">ต้องการทำอย่างไรต่อ?</h2>
            <p className="text-sm text-slate-300">คุณสามารถเลือกพักชั่วคราวเพื่อกลับมาปัดต่อ หรือดูผลสรุปการแนะนำได้เลย</p>
            
            <div className="space-y-3 pt-2">
              <button
                onClick={() => setShowPauseModal(false)}
                className="w-full py-2.5 bg-slate-700 hover:bg-slate-600 rounded-xl font-semibold border border-slate-600 text-white"
              >
                ☕ พักก่อน (กลับไปปัดต่อ)
              </button>
              <button
                onClick={handleFinishSession}
                className="w-full py-2.5 bg-indigo-500 hover:bg-indigo-600 rounded-xl font-bold text-white transition"
              >
                📊 สรุปผลการแนะนำทันที
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Tinder-Style Book Card */}
      {currentBook && (
        <div className="max-w-sm w-full bg-slate-800 rounded-3xl overflow-hidden shadow-2xl border border-slate-700 relative aspect-[2/3] flex flex-col justify-between">
          {/* รูปปกหนังสือเต็มใบ */}
          <img 
            src={currentBook.cover_url || 'https://via.placeholder.com/400x600'} 
            alt={currentBook.title}
            className="absolute inset-0 h-full w-full object-cover"
          />

          {/* ป้ายด้านบน */}
          <div className="relative z-10 p-4 flex gap-2">
            <span className="text-xs font-bold px-3 py-1 bg-black/60 backdrop-blur-md text-indigo-300 rounded-full border border-indigo-500/30">
              Match {(currentBook.similarity * 100).toFixed(1)}%
            </span>
            {currentBook.isExploration && (
              <span className="text-xs font-bold px-3 py-1 bg-black/60 backdrop-blur-md text-amber-300 rounded-full border border-amber-500/30">
                🎲 Exploration
              </span>
            )}
          </div>

          {/* เงาดำด้านล่าง + ข้อมูล + ปุ่ม Swipe */}
          <div className="relative z-10 bg-gradient-to-t from-slate-950 via-slate-950/80 to-transparent p-5 pt-16 flex flex-col justify-end space-y-4">
            <div>
              <h2 className="text-2xl font-bold text-white drop-shadow-md">{currentBook.title}</h2>
              <p className="text-sm text-slate-300 drop-shadow mt-1">
                {currentBook.main_category} • {currentBook.subcategory}
              </p>
            </div>

            <div className="flex gap-4 pt-2">
              <button
                onClick={() => handleSwipe('DISLIKE')}
                className="flex-1 py-3.5 bg-rose-600/80 backdrop-blur-md text-white rounded-2xl font-bold hover:bg-rose-600 transition shadow-lg active:scale-95 flex items-center justify-center gap-1"
              >
                Dislike ✕
              </button>
              <button
                onClick={() => handleSwipe('LIKE')}
                className="flex-1 py-3.5 bg-emerald-600/80 backdrop-blur-md text-white rounded-2xl font-bold hover:bg-emerald-600 transition shadow-lg active:scale-95 flex items-center justify-center gap-1"
              >
                Like ♥
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}