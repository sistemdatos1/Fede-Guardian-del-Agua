
import React, { useState, useCallback, useRef, useEffect } from 'react';
import { STORY_DATA } from './constants';
import { StoryState } from './types';
import { generateImage, generateNarration } from './services/geminiService';

const App: React.FC = () => {
  const [state, setState] = useState<StoryState>({
    currentIndex: 0,
    isGenerating: false,
    isAudioPlaying: false,
    content: {},
  });

  const [isMovieMode, setIsMovieMode] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const audioContextRef = useRef<AudioContext | null>(null);
  const audioSourceRef = useRef<AudioBufferSourceNode | null>(null);
  const currentLoadingIndexRef = useRef<number | null>(null);

  const initAudio = () => {
    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
    }
    if (audioContextRef.current.state === 'suspended') {
      audioContextRef.current.resume();
    }
  };

  const stopAudio = useCallback(() => {
    if (audioSourceRef.current) {
      audioSourceRef.current.onended = null;
      try { audioSourceRef.current.stop(); } catch(e) {}
      audioSourceRef.current = null;
    }
    setState(prev => ({ ...prev, isAudioPlaying: false }));
  }, []);

  const playAudio = useCallback((buffer: AudioBuffer, onEnded?: () => void) => {
    initAudio();
    stopAudio();
    const source = audioContextRef.current!.createBufferSource();
    source.buffer = buffer;
    source.connect(audioContextRef.current!.destination);
    source.onended = () => {
      setState(prev => ({ ...prev, isAudioPlaying: false }));
      if (onEnded) onEnded();
    };
    source.start(0);
    audioSourceRef.current = source;
    setState(prev => ({ ...prev, isAudioPlaying: true }));
  }, [stopAudio]);

  const loadPageContent = useCallback(async (index: number): Promise<void> => {
    setErrorMessage(null);
    stopAudio();

    if (state.content[index]) {
      const existing = state.content[index];
      if (existing.audioBuffer) playAudio(existing.audioBuffer);
      return;
    }

    currentLoadingIndexRef.current = index;
    setState(prev => ({ ...prev, isGenerating: true }));
    initAudio();

    try {
      const episode = STORY_DATA[index];
      const [imageUrl, audioBuffer] = await Promise.all([
        generateImage(episode.imagePrompt, true),
        generateNarration(episode.text, audioContextRef.current!)
      ]);

      if (currentLoadingIndexRef.current === index) {
        // Fix: correctly update the state object
        setState(prev => ({
          ...prev,
          isGenerating: false,
          content: { ...prev.content, [index]: { imageUrl, audioBuffer } }
        }));
        playAudio(audioBuffer);
      }
    } catch (error) {
      setErrorMessage("Fede está descansando un momento. ¡Prueba de nuevo!");
      setState(prev => ({ ...prev, isGenerating: false }));
    }
  }, [state.content, playAudio, stopAudio]);

  const handleNext = () => {
    if (state.currentIndex < STORY_DATA.length - 1) {
      const next = state.currentIndex + 1;
      setState(prev => ({ ...prev, currentIndex: next }));
      loadPageContent(next);
    }
  };

  const handlePrev = () => {
    if (state.currentIndex > 0) {
      const prev = state.currentIndex - 1;
      setState(prev => ({ ...prev, currentIndex: prev }));
      loadPageContent(prev);
    }
  };

  const currentContent = state.content[state.currentIndex];
  const hasStarted = Object.keys(state.content).length > 0 || state.isGenerating;

  return (
    <div className={`min-h-screen flex flex-col items-center justify-center p-4 transition-colors duration-700 ${isMovieMode ? 'bg-black' : 'bg-gradient-to-br from-blue-100 via-white to-green-100'}`}>
      
      {errorMessage && (
        <div className="fixed top-4 bg-red-500 text-white p-4 rounded-xl shadow-2xl z-50 animate-bounce">
          {errorMessage}
        </div>
      )}

      {!hasStarted ? (
        <div className="text-center bg-white p-12 rounded-[3rem] shadow-2xl border-b-8 border-blue-500">
          <h1 className="text-5xl font-black text-blue-600 mb-6 italic">Fede el Guardián</h1>
          <img src="https://picsum.photos/seed/fede/400/400" className="w-48 h-48 mx-auto rounded-full mb-8 border-4 border-blue-100 shadow-xl" alt="Fede" />
          <div className="flex flex-col gap-4">
            <button onClick={() => loadPageContent(0)} className="bg-blue-500 hover:bg-blue-600 text-white text-2xl font-black px-12 py-5 rounded-3xl shadow-[0_8px_0_rgb(37,99,235)] active:translate-y-1 active:shadow-none transition-all">
              ¡LEER CUENTO!
            </button>
            <button onClick={() => { setIsMovieMode(true); loadPageContent(0); }} className="bg-purple-600 hover:bg-purple-700 text-white text-xl font-bold px-8 py-3 rounded-2xl shadow-[0_6px_0_rgb(126,34,206)] active:translate-y-1 active:shadow-none transition-all">
              <i className="fas fa-film mr-2"></i> MODO PELÍCULA
            </button>
          </div>
        </div>
      ) : (
        <div className={`w-full transition-all duration-700 ${isMovieMode ? 'max-w-none h-screen p-0 fixed inset-0 z-50 bg-black' : 'max-w-5xl bg-white rounded-[3rem] shadow-2xl overflow-hidden flex flex-col md:flex-row min-h-[600px] border-[10px] border-white'}`}>
          
          <div className={`${isMovieMode ? 'w-full h-full' : 'md:w-3/5'} relative bg-gray-900 overflow-hidden`}>
            {state.isGenerating ? (
              <div className="absolute inset-0 flex items-center justify-center bg-blue-900/20 backdrop-blur-sm">
                <div className="flex flex-col items-center">
                  <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-blue-400 mb-4"></div>
                  <p className="text-white font-bold animate-pulse">CREANDO MAGIA...</p>
                </div>
              </div>
            ) : currentContent?.imageUrl && (
              <div className="w-full h-full relative group">
                {/* Cinematic camera animation layers */}
                <div className="absolute inset-0 scale-110 animate-cinematic-camera">
                  <img src={currentContent.imageUrl} className="w-full h-full object-cover" alt="Escena" />
                </div>
                
                {/* Gradient for subtitles in movie mode */}
                {isMovieMode && (
                  <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black/80 to-transparent"></div>
                )}
              </div>
            )}
            
            {/* Text overlay in movie mode */}
            {isMovieMode && !state.isGenerating && (
              <div className="absolute bottom-20 left-10 right-10 text-center animate-fade-up">
                <p className="text-3xl md:text-5xl font-black text-white drop-shadow-[0_4px_4px_rgba(0,0,0,0.8)] leading-tight italic">
                  {STORY_DATA[state.currentIndex].text}
                </p>
              </div>
            )}

            <div className="absolute top-6 left-6 flex gap-2">
              <span className="bg-blue-600/90 backdrop-blur-md text-white px-4 py-1.5 rounded-full font-bold text-sm shadow-lg">PÁGINA {state.currentIndex + 1}</span>
              <button 
                onClick={() => setIsMovieMode(!isMovieMode)} 
                className="bg-white/20 backdrop-blur-md text-white hover:bg-white/40 px-4 py-1.5 rounded-full font-bold text-sm flex items-center gap-2 transition-all border border-white/30"
              >
                <i className={`fas ${isMovieMode ? 'fa-compress' : 'fa-expand'}`}></i>
                {isMovieMode ? 'SALIR DE CINE' : 'PANTALLA COMPLETA'}
              </button>
            </div>

            {isMovieMode && (
              <div className="absolute bottom-6 right-6 flex gap-4">
                <button onClick={handlePrev} disabled={state.currentIndex === 0} className="w-12 h-12 rounded-full bg-white/20 hover:bg-white/40 text-white disabled:opacity-20 transition-all">
                  <i className="fas fa-chevron-left"></i>
                </button>
                <button onClick={handleNext} disabled={state.currentIndex === STORY_DATA.length - 1} className="w-12 h-12 rounded-full bg-white/20 hover:bg-white/40 text-white disabled:opacity-20 transition-all">
                  <i className="fas fa-chevron-right"></i>
                </button>
              </div>
            )}
          </div>

          {!isMovieMode && (
            <div className="md:w-2/5 p-10 flex flex-col justify-between bg-white">
              <div>
                <h2 className="text-blue-500 font-black text-xl mb-4 italic uppercase tracking-tighter">Capítulo {state.currentIndex + 1}</h2>
                <p className="text-2xl font-bold text-gray-800 leading-tight">
                  {STORY_DATA[state.currentIndex].text}
                </p>
              </div>

              <div className="pt-8 space-y-6">
                <div className="flex justify-between items-center gap-4">
                  <button onClick={handlePrev} disabled={state.currentIndex === 0} className="w-14 h-14 rounded-2xl bg-gray-100 flex items-center justify-center hover:bg-blue-100 disabled:opacity-30 transition-colors">
                    <i className="fas fa-arrow-left"></i>
                  </button>
                  <button onClick={() => currentContent?.audioBuffer && playAudio(currentContent.audioBuffer)} className={`flex-1 py-4 rounded-2xl font-black text-white flex items-center justify-center gap-3 transition-all ${state.isAudioPlaying ? 'bg-green-500' : 'bg-blue-500 shadow-[0_5px_0_rgb(37,99,235)] active:translate-y-1 active:shadow-none'}`}>
                    <i className={`fas ${state.isAudioPlaying ? 'fa-volume-up animate-pulse' : 'fa-play'}`}></i>
                    {state.isAudioPlaying ? 'ESCUCHANDO' : 'NARRAR'}
                  </button>
                  <button onClick={handleNext} disabled={state.currentIndex === STORY_DATA.length - 1} className="w-14 h-14 rounded-2xl bg-blue-500 text-white flex items-center justify-center hover:bg-blue-600 shadow-[0_5px_0_rgb(37,99,235)] active:translate-y-1 active:shadow-none">
                    <i className="fas fa-arrow-right"></i>
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {!isMovieMode && (
        <footer className="mt-8 opacity-40 font-bold text-xs uppercase tracking-widest text-blue-900">
          Fede: El Guardián del Agua • Animación Cinematic Digital
        </footer>
      )}

      <style>{`
        @keyframes cinematic-camera {
          0% { transform: scale(1) translate(0, 0); }
          25% { transform: scale(1.1) translate(1%, 1%); }
          50% { transform: scale(1.15) translate(-1%, 2%); }
          75% { transform: scale(1.1) translate(-2%, -1%); }
          100% { transform: scale(1) translate(0, 0); }
        }
        .animate-cinematic-camera {
          animation: cinematic-camera 20s ease-in-out infinite;
        }
        @keyframes fade-up {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-fade-up {
          animation: fade-up 1s ease-out forwards;
        }
      `}</style>
    </div>
  );
};

export default App;
