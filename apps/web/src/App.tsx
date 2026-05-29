import {NarrativePanel} from './components/NarrativePanel';
import {ImageGallery} from './components/ImageGallery';
import {PromptList} from './components/PromptList';
import {SocialMetadataPanel} from './components/SocialMetadataPanel';
import {StatusPanel} from './components/StatusPanel';
import {TopicComposer} from './components/TopicComposer';
import {VideoPreview} from './components/VideoPreview';
import {useGenerator} from './hooks/useGenerator';

export default function App() {
  const {state, actions, derived} = useGenerator();

  return (
    <div className="app-shell">
      <div className="background-orb background-orb-a" />
      <div className="background-orb background-orb-b" />

      <main className="app-layout">
        <TopicComposer
          canGenerateAudio={derived.canGenerateAudio}
          canGenerateNarrative={derived.canGenerateNarrative}
          canGenerateVideo={derived.canGenerateVideo}
          onGenerateAudio={actions.generateAudio}
          onGenerateNarrative={actions.generateNarrative}
          onGenerateVideo={actions.renderVideo}
          onTopicChange={actions.setTopic}
          topic={state.topic}
        />

        <section className="dashboard-grid">
          <NarrativePanel
            audioStatus={state.audioStatus}
            narrative={state.narrative}
            onNarrativeChange={actions.setNarrativeText}
          />
          <StatusPanel
            feed={state.statusFeed}
            audioStatus={state.audioStatus}
            imageStatus={state.imageStatus}
            narrativeStatus={state.narrativeStatus}
            promptStatus={state.promptStatus}
            renderStatus={state.renderStatus}
            sceneVideoStatus={state.sceneVideoStatus}
            socialMetadataStatus={state.socialMetadataStatus}
          />
        </section>

        <SocialMetadataPanel
          canGenerate={derived.canGenerateSocialMetadata}
          metadata={state.socialMetadata}
          onGenerate={actions.generateSocialMetadata}
          status={state.socialMetadataStatus}
        />

        <PromptList prompts={state.prompts} />

        <ImageGallery images={state.images} />

        <VideoPreview
          canDownloadBundle={derived.canDownloadBundle}
          isBundleReady={derived.canDownloadBundle}
          onDownloadBundle={actions.downloadBundle}
          onImportBundle={actions.importBundle}
          video={state.video}
        />
      </main>
    </div>
  );
}
