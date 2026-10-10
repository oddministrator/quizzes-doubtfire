import { useState } from 'react';
import { DirectoryScreen } from './components/DirectoryScreen';
import { QuizScreen } from './components/QuizScreen';
import { CreateSetScreen } from './components/CreateSetScreen';
import { QuestionSet } from './types';
import fullLogo from './assets/full-logo.png';

function App() {
  const [activeSet, setActiveSet] = useState<QuestionSet | null>(null);
  const [isCreatingSet, setIsCreatingSet] = useState(false);
  const [editingSet, setEditingSet] = useState<QuestionSet | null>(null);

  const isHome = !activeSet && !isCreatingSet && !editingSet;

  return (
    <>
      {isHome && (
        <a href="https://radiological.info" className="return-link" title="Return to radiological.info">
          <img src={fullLogo} alt="Radiological Info Logo" className="return-logo" />
        </a>
      )}
      {activeSet ? (
        <QuizScreen 
          set={activeSet} 
          onExit={() => setActiveSet(null)} 
        />
      ) : (isCreatingSet || editingSet) ? (
        <CreateSetScreen 
          initialSet={editingSet}
          onExit={() => {
            setIsCreatingSet(false);
            setEditingSet(null);
          }}
          onSetCreated={(newSet) => {
            setIsCreatingSet(false);
            setEditingSet(null);
            setActiveSet(newSet);
          }}
        />
      ) : (
        <DirectoryScreen 
          onSelectSet={(set) => setActiveSet(set)} 
          onCreateSet={() => setIsCreatingSet(true)}
          onEditSet={(set) => setEditingSet(set)}
        />
      )}
    </>
  );
}

export default App;
