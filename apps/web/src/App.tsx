import {NarrativePanel} from './components/NarrativePanel';
import {ImageGallery} from './components/ImageGallery';
import {PromptList} from './components/PromptList';
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
          disabled={!derived.canGenerate}
          onGenerate={actions.generateNarrativePromptsAndImages}
          onTopicChange={actions.setTopic}
          topic={state.topic}
        />

        <section className="dashboard-grid">
          <NarrativePanel narrative={state.narrative} />
          <StatusPanel
            feed={state.statusFeed}
            imageStatus={state.imageStatus}
            narrativeStatus={state.narrativeStatus}
            promptStatus={state.promptStatus}
            renderStatus={state.renderStatus}
          />
        </section>

        <PromptList prompts={state.prompts} />

        <ImageGallery images={state.images} />

        <VideoPreview
          canRender={derived.canRender}
          isRendering={state.renderStatus === 'loading'}
          onRender={actions.renderVideo}
          video={state.video}
        />
      </main>
    </div>
  );
}
