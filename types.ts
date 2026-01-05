
export interface StoryEpisode {
  pageNumber: number;
  text: string;
  imagePrompt: string;
}

export interface GeneratedContent {
  imageUrl: string | null;
  audioBuffer: AudioBuffer | null;
}

export interface StoryState {
  currentIndex: number;
  isGenerating: boolean;
  isAudioPlaying: boolean;
  content: Record<number, GeneratedContent>;
}
