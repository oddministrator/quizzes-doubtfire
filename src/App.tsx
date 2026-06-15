import { useState } from 'react';
import { DirectoryScreen } from './components/DirectoryScreen';
import { QuizScreen } from './components/QuizScreen';
import { QuestionSet } from './types';

function App() {
  const [activeSet, setActiveSet] = useState<QuestionSet | null>(null);

  return (
    <>
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
