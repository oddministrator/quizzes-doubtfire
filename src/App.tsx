import { useState } from 'react';
import { DirectoryScreen } from './components/DirectoryScreen';
import { QuizScreen } from './components/QuizScreen';
import { QuestionSet } from './types';
import fullLogo from './assets/full-logo.png';
function App() {
  const [activeSet, setActiveSet] = useState<QuestionSet | null>(null);

  return (
    <>
      <a href="https://radiological.info" className="return-link" title="Return to radiological.info">
        <img src={fullLogo} alt="Radiological Info Logo" className="return-logo" />
      </a>
      {activeSet ? (
        <QuizScreen 
          set={activeSet} 
          onExit={() => setActiveSet(null)} 
        />
      ) : (
        <DirectoryScreen 
          onSelectSet={(set) => setActiveSet(set)} 
        />
      )}
    </>
  );
}

export default App;
