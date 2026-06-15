import React, { useState } from 'react';
import { QuestionSet, Question, Answer } from '../types';
import { OPFSService } from '../services/opfs';
import { ChevronLeft, Check, X, HelpCircle } from 'lucide-react';
import './QuizScreen.css';

interface Props {
  set: QuestionSet;
  onExit: () => void;
}

export const QuizScreen: React.FC<Props> = ({ set: initialSet, onExit }) => {
  const pickNextQuestion = (currentSet: QuestionSet): Question | undefined => {
    const allDiffs = Array.from(new Set(currentSet.questions.map(q => q.assigned_difficulty))).sort((a,b) => a-b);
    const currentLevel = currentSet.current_level ?? allDiffs[0] ?? 0;
    
    const currentLevelQs = currentSet.questions.filter(q => 
      q.assigned_difficulty === currentLevel && (!q.current_attempt || q.current_attempt === 'null')
    );

    const earlierQs = currentSet.questions.filter(q => q.assigned_difficulty < currentLevel);
    
    let bestEarlierQuestion: Question | undefined = undefined;
    if (earlierQs.length > 0) {
      const withRatios = earlierQs.map(q => {
        const ratio = ((q.user_attempts || 0) + 4) / ((q.correct_attempts || 0) + 1);
        return { q, ratio };
      });
      
      withRatios.sort((a, b) => b.ratio - a.ratio);
      
      if (withRatios[0].ratio > 1.2) {
        bestEarlierQuestion = withRatios[0].q;
      } else if (currentLevelQs.length === 0) {
        // If there are no current level questions available (e.g. max level beaten),
        // fallback to the highest ratio question to keep the loop going.
        bestEarlierQuestion = withRatios[0].q;
      }
    }

    if (currentLevelQs.length > 0 && bestEarlierQuestion) {
      return Math.random() < 0.5 ? bestEarlierQuestion : currentLevelQs[0];
    } else if (currentLevelQs.length > 0) {
      return currentLevelQs[0];
    } else if (bestEarlierQuestion) {
      return bestEarlierQuestion;
    }
    
    return undefined;
  };

  const [set, setSet] = useState<QuestionSet>(initialSet);
  const [pendingUpdate, setPendingUpdate] = useState<QuestionSet | null>(null);
  const [selectedAnswers, setSelectedAnswers] = useState<string[]>([]);
  const [feedback, setFeedback] = useState<'correct' | 'incorrect' | null>(null);
  const [showExplanation, setShowExplanation] = useState(false);
  const [activeQuestionId, setActiveQuestionId] = useState<string | null>(() => {
    const q = pickNextQuestion(initialSet);
    return q ? q.id : null;
  });

  const currentQuestion = set.questions.find(q => q.id === activeQuestionId);

  const randomizedAnswers = React.useMemo(() => {
    if (!currentQuestion) return [];
    if (currentQuestion.ordered || currentQuestion.answers.length <= 2) {
      return currentQuestion.answers;
    }
    const shuffled = [...currentQuestion.answers];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  }, [currentQuestion]);

  if (!currentQuestion) {
    return (
      <div className="quiz-screen screen-container empty-quiz animate-fade-in">
        <div className="glass-panel">
          <h2>Quiz Complete!</h2>
          <button className="button-base button-primary" onClick={onExit} style={{ marginTop: '20px' }}>
            Return to Library
          </button>
        </div>
      </div>
    );
  }

  const isMultiple = currentQuestion.type === 'multiple';
  const correctAnswers = currentQuestion.answers.filter(a => a.isCorrect);
  const requiredCount = correctAnswers.length;

  const handleAnswerSelect = (answer: Answer) => {
    if (feedback) return; // Prevent selection while showing feedback

    if (!isMultiple) {
      evaluateSingle(answer);
    } else {
      if (selectedAnswers.includes(answer.id)) {
        setSelectedAnswers(selectedAnswers.filter(id => id !== answer.id));
      } else {
        setSelectedAnswers([...selectedAnswers, answer.id]);
      }
    }
  };

  const evaluateSingle = async (answer: Answer) => {
    setSelectedAnswers([answer.id]);
    const isCorrect = answer.isCorrect;
    await processResult(isCorrect);
  };

  const handleMultipleSubmit = async () => {
    if (selectedAnswers.length !== requiredCount) return;

    // Check if every selected answer is correct, and every correct answer is selected
    const allSelectedCorrect = selectedAnswers.every(id => 
      currentQuestion.answers.find(a => a.id === id)?.isCorrect
    );
    
    await processResult(allSelectedCorrect);
  };

  const processResult = async (isCorrect: boolean) => {
    setFeedback(isCorrect ? 'correct' : 'incorrect');

    // Update stats
    const updatedSet = { ...set, questions: [...set.questions] };
    const globalIndex = updatedSet.questions.findIndex(q => q.id === currentQuestion.id);
    
    const allDiffs = Array.from(new Set(updatedSet.questions.map(x => x.assigned_difficulty))).sort((a,b)=>a-b);
    const currentLevel = updatedSet.current_level ?? allDiffs[0] ?? 0;

    if (globalIndex !== -1) {
      const q = { ...updatedSet.questions[globalIndex] };
      q.user_attempts = (q.user_attempts || 0) + 1;
      if (isCorrect) {
        q.correct_attempts = (q.correct_attempts || 0) + 1;
      }
      
      // Only set current_attempt if it's a current_level question
      if (q.assigned_difficulty === currentLevel) {
        q.current_attempt = isCorrect ? 'correct' : 'incorrect';
      }
      
      updatedSet.questions[globalIndex] = q;
    }

    // Check if difficulty level is complete
    const diff = currentQuestion.assigned_difficulty;
    
    if (diff === currentLevel) {
      const questionsOfDiff = updatedSet.questions.filter(qu => qu.assigned_difficulty === diff);
      const allAnswered = questionsOfDiff.every(qu => qu.current_attempt === 'correct' || qu.current_attempt === 'incorrect');

      if (allAnswered && questionsOfDiff.length > 0) {
        const correctCount = questionsOfDiff.filter(qu => qu.current_attempt === 'correct').length;
        const percent = (correctCount / questionsOfDiff.length) * 100;
        
        const requiredPercent = updatedSet.advance_required_percent ?? 100;
        
        if (percent >= requiredPercent) {
          // Advance current_level to next highest difficulty available
          const nextDiff = allDiffs.find(d => d > currentLevel);
          if (nextDiff !== undefined) {
            updatedSet.current_level = nextDiff;
          } else {
            // Highest level reached and passed! 
            // Reset all questions of this difficulty to keep practicing the highest level.
            questionsOfDiff.forEach(qu => {
              const gIndex = updatedSet.questions.findIndex(x => x.id === qu.id);
              if (gIndex !== -1) {
                updatedSet.questions[gIndex] = { ...updatedSet.questions[gIndex], current_attempt: 'null' };
              }
            });
          }
        } else {
          // Reset all questions of this difficulty
          questionsOfDiff.forEach(qu => {
            const gIndex = updatedSet.questions.findIndex(x => x.id === qu.id);
            if (gIndex !== -1) {
              updatedSet.questions[gIndex] = { ...updatedSet.questions[gIndex], current_attempt: 'null' };
            }
          });
        }
      }
    }

    setPendingUpdate(updatedSet);
    // Save to file system
    await OPFSService.saveQuestionSet(updatedSet);
  };

  const handleNext = () => {
    const nextSet = pendingUpdate || set;
    if (pendingUpdate) {
      setSet(pendingUpdate);
      setPendingUpdate(null);
    }
    setFeedback(null);
    setShowExplanation(false);
    setSelectedAnswers([]);
    
    const nextQ = pickNextQuestion(nextSet);
    setActiveQuestionId(nextQ ? nextQ.id : null);
  };

  const handleScreenTap = () => {
    if (feedback) {
      handleNext();
    }
  };

  const handleExplanationClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowExplanation(true);
  };

  const currentLevelDisp = set.current_level ?? 0;
  const currentLevelRemaining = set.questions.filter(q => q.assigned_difficulty === currentLevelDisp && (!q.current_attempt || q.current_attempt === 'null')).length;

  return (
    <div className="quiz-screen" onClick={handleScreenTap}>
      {feedback && (
        <div className={`feedback-banner animate-slide-down ${feedback}`}>
          {feedback === 'correct' ? <><Check size={24}/> Correct!</> : <><X size={24}/> Incorrect!</>}
          {currentQuestion.explanation && (
            <button className="explanation-btn" onClick={handleExplanationClick} aria-label="Show explanation">
              <HelpCircle size={24} />
            </button>
          )}
        </div>
      )}

      <header className="quiz-header">
        <button className="back-btn" onClick={onExit} aria-label="Back">
          <ChevronLeft size={24} />
        </button>
        <div className="progress">
          Level {currentLevelDisp} • {currentLevelRemaining} remaining
        </div>
      </header>

      <main className="quiz-main">
        <div className="question-card animate-fade-in">
          <h2 className="question-text">{currentQuestion.text}</h2>
          {showExplanation && currentQuestion.explanation && (
            <div className="explanation-text animate-fade-in">
              {currentQuestion.explanation}
            </div>
          )}
        </div>

        <div className="answers-grid">
          {randomizedAnswers.map((answer, index) => {
            const isSelected = selectedAnswers.includes(answer.id);
            const showCorrectness = feedback !== null;
            
            let btnClass = 'answer-btn';
            if (showCorrectness) {
              btnClass += ' is-disabled';
              if (answer.isCorrect) btnClass += ' correct';
              else if (isSelected) btnClass += ' incorrect';
              else btnClass += ' dim';
            } else if (isSelected) {
              btnClass += ' selected';
            }

            return (
              <button 
                key={answer.id}
                className={btnClass}
                onClick={(e) => {
                  if (feedback !== null) return;
                  e.stopPropagation(); // prevent screen tap
                  handleAnswerSelect(answer);
                }}
              >
                {currentQuestion.ordered && (
                  <div className="answer-number">{index + 1}</div>
                )}
                {answer.text}
              </button>
            );
          })}
        </div>

        {isMultiple && !feedback && (
          <div className="multiple-submit-container">
            <button 
              className={`button-base button-primary ${selectedAnswers.length === requiredCount ? 'ready' : ''}`}
              onClick={(e) => {
                e.stopPropagation();
                handleMultipleSubmit();
              }}
              disabled={selectedAnswers.length !== requiredCount}
            >
              {selectedAnswers.length === requiredCount ? 'Submit' : `Select ${requiredCount}`}
            </button>
          </div>
        )}
      </main>
      
      {feedback && (
        <div className="tap-to-continue animate-fade-in">
          Tap anywhere to continue
        </div>
      )}
    </div>
  );
};
