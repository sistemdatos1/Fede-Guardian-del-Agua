
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { STORY_DATA } from './constants';
import { StoryState, GeneratedContent } from './types';
import { generateImage, generateNarration } from './services/geminiService';

const App: React.FC = () => {
  const [state, setState] = useState<StoryState>({
    currentIndex: 0,
    isGenerating: false,
    isAudioPlaying: false,
    content: {},
  });

  const audioContextRef = useRef<AudioContext | null>(null);
  const audioSourceRef = useRef<AudioBufferSourceNode | null>(null);
  const autoAdvanceTimeoutRef = useRef<number | null>(null);

  const initAudio = () => {
    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
    }
  };

  const stopAudio = useCallback(() => {
    if (audioSourceRef.current) {
      audioSourceRef.current.onended = null;
      audioSourceRef.current.stop();
      audioSourceRef.current = null;
    }
    if (autoAdvanceTimeoutRef.current) {
      clearTimeout(autoAdvanceTimeoutRef.current);
    }
    setState(prev => ({ ...prev, isAudioPlaying: false }));
  }, []);

  const handleNext = useCallback(() => {
    setState(prev => {
      if (prev.currentIndex < STORY_DATA.length - 1) {
        const nextIndex = prev.currentIndex + 1;
        // Trigger loading the next content
        loadPageContent(nextIndex);
        return { ...prev, currentIndex: nextIndex };
      }
      return prev;
    });
  }, []);

  const playAudio = useCallback((buffer: AudioBuffer, shouldAutoAdvance: boolean) => {
    if (!audioContextRef.current) return;
    stopAudio();
    
    const source = audioContextRef.current.createBufferSource();
    source.buffer = buffer;
    source.connect(audioContextRef.current.destination);
    
    source.onended = () => {
      setState(prev => ({ ...prev, isAudioPlaying: false }));
      
      // Si no es la última página, avanzar automáticamente después de un pequeño descanso
      if (shouldAutoAdvance) {
        autoAdvanceTimeoutRef.current = window.setTimeout(() => {
          handleNext();
        }, 1500); // 1.5 segundos de pausa para apreciar la ilustración
      }
    };

    source.start();
    audioSourceRef.current = source;
    setState(prev => ({ ...prev, isAudioPlaying: true }));
  }, [stopAudio, handleNext]);

  const loadPageContent = useCallback(async (index: number) => {
    // Si ya existe el contenido, solo lo reproducimos
    if (state.content[index]) {
      const existing = state.content[index];
      if (existing.audioBuffer) {
        playAudio(existing.audioBuffer, index < STORY_DATA.length - 1);
      }
      return;
    }

    setState(prev => ({ ...prev, isGenerating: true }));
    initAudio();

    try {
      const episode = STORY_DATA[index];
      const [imageUrl, audioBuffer] = await Promise.all([
        generateImage(episode.imagePrompt),
        generateNarration(episode.text, audioContextRef.current!)
      ]);

      setState(prev => ({
        ...prev,
        isGenerating: false,
        content: {
          ...prev.content,
          [index]: { imageUrl, audioBuffer }
        }
      }));

      playAudio(audioBuffer, index < STORY_DATA.length - 1);
    } catch (error) {
      console.error("Error loading story page:", error);
      setState(prev => ({ ...prev, isGenerating: false }));
    }
  }, [state.content, playAudio]);

  const handlePrev = () => {
    if (state.currentIndex > 0) {
      const prevIndex = state.currentIndex - 1;
      setState(prev => ({ ...prev, currentIndex: prevIndex }));
      loadPageContent(prevIndex);
    }
  };

  const handleStart = () => {
    initAudio();
    loadPageContent(0);
  };

  const currentEpisode = STORY_DATA[state.currentIndex];
  const currentContent = state.content[state.currentIndex];

  const hasStarted = Object.keys(state.content).length > 0 || state.isGenerating;

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-gradient-to-b from-blue-50 to-green-50">
      {!hasStarted ? (
        <div className="text-center space-y-8 max-w-lg">
          <div className="relative group">
            <div className="absolute -inset-1 bg-gradient-to-r from-blue-400 to-green-400 rounded-3xl blur opacity-25 group-hover:opacity-100 transition duration-1000"></div>
            <div className="relative bg-white p-8 rounded-3xl shadow-xl">
              <h1 className="text-4xl font-bold text-blue-600 mb-4 italic">Fede: El Guardián del Agua</h1>
              <img 
                src="https://picsum.photos/seed/fede_hero/400/400" 
                alt="Fede Intro" 
                className="w-48 h-48 mx-auto rounded-full border-4 border-blue-100 mb-6 shadow-md object-cover"
              />
              <p className="text-gray-600 text-lg mb-8">
                Disfruta de esta historia narrada automáticamente. Solo relájate y escucha la aventura de Fede.
              </p>
              <button 
                onClick={handleStart}
                className="w-full bg-blue-500 hover:bg-blue-600 text-white font-bold py-4 px-8 rounded-2xl text-xl shadow-lg transform hover:scale-105 transition-all duration-200"
              >
                Comenzar Historia <i className="fas fa-magic ml-2"></i>
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="w-full max-w-5xl bg-white rounded-3xl shadow-2xl overflow-hidden flex flex-col md:flex-row min-h-[600px] border-4 border-white">
          {/* Illustration Area */}
          <div className="md:w-3/5 relative bg-blue-50 flex items-center justify-center overflow-hidden border-r border-gray-100">
            {state.isGenerating ? (
              <div className="flex flex-col items-center space-y-6">
                <div className="relative">
                   <div className="animate-spin rounded-full h-24 w-24 border-t-4 border-b-4 border-blue-500"></div>
                   <div className="absolute inset-0 flex items-center justify-center">
                      <i className="fas fa-tint text-blue-400 animate-pulse"></i>
                   </div>
                </div>
                <p className="text-blue-600 font-bold animate-pulse text-center px-6 text-lg">
                  Preparando el siguiente episodio...
                </p>
              </div>
            ) : currentContent?.imageUrl ? (
              <img 
                src={currentContent.imageUrl} 
                alt={`Página ${state.currentIndex + 1}`}
                className="w-full h-full object-cover animate-fade-in"
              />
            ) : null}
            
            {/* Page indicator */}
            <div className="absolute top-6 left-6 bg-blue-600/90 backdrop-blur-md px-4 py-2 rounded-2xl text-white font-bold shadow-lg text-lg">
              {state.currentIndex + 1} / {STORY_DATA.length}
            </div>

            {/* Audio playing wave indicator */}
            {state.isAudioPlaying && (
              <div className="absolute bottom-6 right-6 flex items-end space-x-1.5 bg-black/20 p-3 rounded-2xl backdrop-blur-sm">
                {[...Array(5)].map((_, i) => (
                  <div key={i} className={`w-1.5 bg-white rounded-full animate-audio-wave h-6`} style={{ animationDelay: `${i * 0.15}s` }}></div>
                ))}
              </div>
            )}
          </div>

          {/* Text & Controls Area */}
          <div className="md:w-2/5 p-10 flex flex-col justify-between bg-white relative">
            <div className="flex-1 flex flex-col justify-center">
              <div className="mb-6">
                <span className="bg-green-100 text-green-700 text-xs font-bold px-3 py-1 rounded-full uppercase tracking-widest">
                  Guardando el planeta
                </span>
              </div>
              <h2 className="text-blue-500 font-bold text-xl mb-4 italic">Capítulo {state.currentIndex + 1}</h2>
              <p className="text-2xl md:text-3xl text-gray-800 font-semibold leading-relaxed">
                {currentEpisode.text}
              </p>
            </div>

            <div className="space-y-6 pt-8">
              <div className="flex items-center justify-between">
                <button 
                  onClick={handlePrev}
                  disabled={state.currentIndex === 0 || state.isGenerating}
                  className="w-14 h-14 rounded-2xl bg-gray-50 text-gray-400 hover:bg-blue-50 hover:text-blue-500 disabled:opacity-20 transition-all flex items-center justify-center border border-gray-100 shadow-sm"
                  title="Anterior"
                >
                  <i className="fas fa-arrow-left text-xl"></i>
                </button>

                <button 
                  onClick={() => currentContent?.audioBuffer && playAudio(currentContent.audioBuffer, state.currentIndex < STORY_DATA.length - 1)}
                  disabled={state.isGenerating || !currentContent?.audioBuffer}
                  className={`flex items-center space-x-3 px-8 py-4 rounded-2xl font-bold transition-all shadow-md ${state.isAudioPlaying ? 'bg-green-500 text-white animate-pulse' : 'bg-blue-500 text-white hover:bg-blue-600'}`}
                >
                  <i className={`fas ${state.isAudioPlaying ? 'fa-volume-up' : 'fa-play'}`}></i>
                  <span>{state.isAudioPlaying ? 'Escuchando...' : 'Repetir'}</span>
                </button>

                <button 
                  onClick={handleNext}
                  disabled={state.currentIndex === STORY_DATA.length - 1 || state.isGenerating}
                  className="w-14 h-14 rounded-2xl bg-blue-500 text-white hover:bg-blue-600 disabled:opacity-20 transition-all shadow-md flex items-center justify-center"
                  title="Siguiente"
                >
                  <i className="fas fa-arrow-right text-xl"></i>
                </button>
              </div>

              <div className="text-center">
                <p className="text-gray-400 text-xs italic">
                  * El cuento avanza solo al terminar cada narración.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Footer */}
      <footer className="mt-8 text-gray-500 text-sm flex items-center space-x-3 bg-white/50 px-6 py-2 rounded-full backdrop-blur-sm border border-white">
        <i className="fas fa-water text-blue-400"></i>
        <span className="font-semibold uppercase tracking-tighter text-[10px]">Cuidemos el agua con Fede</span>
        <i className="fas fa-earth-americas text-green-400"></i>
      </footer>

      <style>{`
        @keyframes fade-in {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes audio-wave {
          0%, 100% { height: 8px; }
          50% { height: 24px; }
        }
        .animate-fade-in {
          animation: fade-in 1s ease-out forwards;
        }
        .animate-audio-wave {
          animation: audio-wave 1s ease-in-out infinite;
        }
      `}</style>
    </div>
  );
};

export default App;
