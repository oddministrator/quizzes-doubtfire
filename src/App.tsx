import { useState } from 'react';
import { DirectoryScreen } from './components/DirectoryScreen';
import { QuizScreen } from './components/QuizScreen';
import { QuestionSet } from './types';

function App() {
  const [activeSet, setActiveSet] = useState<QuestionSet | null>(null);

  return (
    <>
      <a href="https://radiological.info" className="return-link" title="Return to radiological.info">
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M19 12H5M12 19l-7-7 7-7"/>
        </svg>
        <img src="/full-logo.png" alt="Radiological Info Logo" className="return-logo" />
        <span>Back</span>
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
