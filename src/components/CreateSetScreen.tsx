import React, { useState, useRef, useEffect } from 'react';
import { QuestionSet, Question, Answer } from '../types';
import { OPFSService } from '../services/opfs';
import { ChevronLeft, ChevronRight, Download, Plus, Check, Edit3, HelpCircle, Trash2 } from 'lucide-react';
import './CreateSetScreen.css';

interface Props {
  initialSet?: QuestionSet | null;
  onExit: () => void;
  onSetCreated?: (set: QuestionSet) => void;
}

interface DraftAnswer {
  id: string;
  text: string;
}

export const CreateSetScreen: React.FC<Props> = ({ initialSet, onExit, onSetCreated }) => {
  // Global set state
  const [completedQuestions, setCompletedQuestions] = useState<Question[]>(() => {
    return initialSet?.questions ? [...initialSet.questions] : [];
  });
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState<number>(0);
  const [setTitle, setSetTitle] = useState(() => initialSet?.title || 'My Custom Question Set');
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [advancePercent, setAdvancePercent] = useState<number>(() => {
    return initialSet?.advance_required_percent ?? 70;
  });

  const firstQ = initialSet?.questions?.[0];

  // Current question draft state
  const [assignedDifficulty, setAssignedDifficulty] = useState<number>(() => {
    return firstQ?.assigned_difficulty ?? (initialSet?.current_level ?? 2);
  });
  const [isEditingDifficulty, setIsEditingDifficulty] = useState(false);
  const [questionText, setQuestionText] = useState(() => firstQ?.text || '');
  const [isEditingQuestion, setIsEditingQuestion] = useState(false);
  
  // Answers list (up to 5)
  const [answers, setAnswers] = useState<DraftAnswer[]>(() => {
    return firstQ?.answers ? firstQ.answers.map(a => ({ id: a.id, text: a.text })) : [];
  });
  const [editingAnswerIndex, setEditingAnswerIndex] = useState<number | null>(null);
  const [answerInputText, setAnswerInputText] = useState('');

  // Explanation state
  const [explanation, setExplanation] = useState(() => firstQ?.explanation || '');
  const [isEditingExplanation, setIsEditingExplanation] = useState(false);

  // Stage state: 'drafting' | 'prompt_random' | 'selecting_correct'
  const [stage, setStage] = useState<'drafting' | 'prompt_random' | 'selecting_correct'>('drafting');
  const [isOrdered, setIsOrdered] = useState(() => !!firstQ?.ordered);
  const [selectedCorrectIds, setSelectedCorrectIds] = useState<string[]>(() => {
    return firstQ?.answers ? firstQ.answers.filter(a => a.isCorrect).map(a => a.id) : [];
  });
  const [notification, setNotification] = useState<string | null>(null);

  const questionInputRef = useRef<HTMLTextAreaElement>(null);
  const answerInputRef = useRef<HTMLInputElement>(null);
  const explanationInputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (isEditingQuestion && questionInputRef.current) {
      questionInputRef.current.focus();
    }
  }, [isEditingQuestion]);

  useEffect(() => {
    if (editingAnswerIndex !== null && answerInputRef.current) {
      answerInputRef.current.focus();
    }
  }, [editingAnswerIndex]);

  useEffect(() => {
    if (isEditingExplanation && explanationInputRef.current) {
      explanationInputRef.current.focus();
    }
  }, [isEditingExplanation]);

  const showToast = (msg: string) => {
    setNotification(msg);
    setTimeout(() => {
      setNotification(null);
    }, 3500);
  };

  // Question navigation handlers
  const loadQuestionAtIndex = (index: number, questionsList: Question[] = completedQuestions) => {
    setCurrentQuestionIndex(index);
    setStage('drafting');
    setIsEditingQuestion(false);
    setEditingAnswerIndex(null);
    setIsEditingExplanation(false);

    if (index < questionsList.length) {
      const q = questionsList[index];
      setAssignedDifficulty(q.assigned_difficulty);
      setQuestionText(q.text);
      setAnswers(q.answers.map(a => ({ id: a.id, text: a.text })));
      setExplanation(q.explanation || '');
      setIsOrdered(!!q.ordered);
      setSelectedCorrectIds(q.answers.filter(a => a.isCorrect).map(a => a.id));
    } else {
      // It is the new question draft
      setAssignedDifficulty(2);
      setQuestionText('');
      setAnswers([]);
      setExplanation('');
      setIsOrdered(false);
      setSelectedCorrectIds([]);
    }
  };

  const handlePrevQuestion = () => {
    if (currentQuestionIndex > 0) {
      loadQuestionAtIndex(currentQuestionIndex - 1);
    }
  };

  const handleNextQuestion = () => {
    if (currentQuestionIndex < completedQuestions.length) {
      loadQuestionAtIndex(currentQuestionIndex + 1);
    }
  };

  // Answer editing handlers
  const handleStartEditAnswer = (index: number) => {
    if (editingAnswerIndex !== null && editingAnswerIndex !== index) {
      handleSaveAnswer();
    }
    setEditingAnswerIndex(index);
    if (index < answers.length) {
      setAnswerInputText(answers[index].text);
    } else {
      setAnswerInputText('');
    }
  };

  const handleSaveAnswer = () => {
    if (editingAnswerIndex === null) return;
    const targetIndex = editingAnswerIndex;
    const trimmed = answerInputText.trim();
    if (!trimmed) {
      setEditingAnswerIndex(null);
      setAnswerInputText('');
      return;
    }

    setAnswers(prev => {
      if (targetIndex < prev.length) {
        const updated = [...prev];
        updated[targetIndex] = { ...updated[targetIndex], text: trimmed };
        return updated;
      } else {
        return [...prev, { id: `a${prev.length + 1}`, text: trimmed }];
      }
    });

    setEditingAnswerIndex(null);
    setAnswerInputText('');
  };

  const handleDeleteAnswer = (indexToDelete: number) => {
    const deletedId = answers[indexToDelete]?.id;
    setAnswers(prev => prev.filter((_, idx) => idx !== indexToDelete));
    if (deletedId) {
      setSelectedCorrectIds(prev => prev.filter(id => id !== deletedId));
    }
    if (editingAnswerIndex === indexToDelete) {
      setEditingAnswerIndex(null);
      setAnswerInputText('');
    } else if (editingAnswerIndex !== null && editingAnswerIndex > indexToDelete) {
      setEditingAnswerIndex(editingAnswerIndex - 1);
    }
  };

  // Explanation handlers
  const handleSaveExplanation = () => {
    setIsEditingExplanation(false);
  };

  // Randomization prompt handlers
  const handleSelectAnswersAndSubmit = () => {
    if (!questionText.trim()) {
      showToast('Please enter question text first.');
      setIsEditingQuestion(true);
      return;
    }
    if (answers.length < 2) {
      showToast('Please add at least 2 answers.');
      return;
    }
    setStage('prompt_random');
  };

  const handleRandomOrderResponse = (randomize: boolean) => {
    // If randomize is YES, ordered is false. If NO, ordered is true.
    setIsOrdered(!randomize);
    setSelectedCorrectIds([]);
    setStage('selecting_correct');
  };

  // Correct answer toggle
  const toggleCorrectAnswer = (id: string) => {
    if (selectedCorrectIds.includes(id)) {
      setSelectedCorrectIds(selectedCorrectIds.filter(x => x !== id));
    } else {
      setSelectedCorrectIds([...selectedCorrectIds, id]);
    }
  };

  // Finalize current question
  const handleCommitCurrentQuestion = (): Question | null => {
    if (!questionText.trim() || answers.length < 2 || selectedCorrectIds.length === 0) {
      return null;
    }

    const questionAnswers: Answer[] = answers.map((a, idx) => ({
      id: `a${idx + 1}`,
      text: a.text,
      isCorrect: selectedCorrectIds.includes(a.id)
    }));

    const newQuestion: Question = {
      id: currentQuestionIndex < completedQuestions.length
        ? completedQuestions[currentQuestionIndex].id
        : `q${completedQuestions.length + 1}`,
      text: questionText.trim(),
      answers: questionAnswers,
      type: selectedCorrectIds.length > 1 ? 'multiple' : 'single',
      assigned_difficulty: assignedDifficulty,
      user_attempts: 0,
      correct_attempts: 0,
      current_attempt: 'null',
      ordered: isOrdered ? true : undefined,
      explanation: explanation.trim() ? explanation.trim() : undefined
    };

    return newQuestion;
  };

  const handleConfirmCorrectAnswers = () => {
    if (selectedCorrectIds.length === 0) {
      showToast('Please tap at least one correct answer.');
      return;
    }

    const q = handleCommitCurrentQuestion();
    if (!q) return;

    if (currentQuestionIndex < completedQuestions.length) {
      // Update existing question
      const updated = [...completedQuestions];
      updated[currentQuestionIndex] = q;
      setCompletedQuestions(updated);
      showToast(`Question ${currentQuestionIndex + 1} updated!`);
      setStage('drafting');
    } else {
      // Add new question
      const updated = [...completedQuestions, q];
      setCompletedQuestions(updated);
      showToast(`Question ${completedQuestions.length + 1} added!`);
      // Advance to next new question
      loadQuestionAtIndex(updated.length, updated);
    }
  };

  // Download & Finish
  const handleFinishAndDownload = async () => {
    const finalQuestions = [...completedQuestions];

    // If currently on selecting_correct stage with valid selection, commit this question too
    if (stage === 'selecting_correct' && selectedCorrectIds.length > 0) {
      const currentQ = handleCommitCurrentQuestion();
      if (currentQ) {
        if (currentQuestionIndex < finalQuestions.length) {
          finalQuestions[currentQuestionIndex] = currentQ;
        } else {
          finalQuestions.push(currentQ);
        }
      }
    }

    if (finalQuestions.length === 0) {
      alert('Please complete at least one question before downloading.');
      return;
    }

    const allDiffs = Array.from(new Set(finalQuestions.map(q => q.assigned_difficulty))).sort((a, b) => a - b);
    const minLevel = allDiffs[0] ?? assignedDifficulty;

    const newSet: QuestionSet = {
      id: initialSet?.id || `set-${Date.now()}`,
      title: setTitle.trim() || 'Custom Question Bank',
      current_level: minLevel,
      advance_required_percent: advancePercent,
      questions: finalQuestions
    };

    // Save to storage
    try {
      await OPFSService.saveQuestionSet(newSet);
    } catch (e) {
      console.warn('Storage save failed, downloading file anyway:', e);
    }

    // Trigger browser file download
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(newSet, null, 2));
    const dlAnchorElem = document.createElement('a');
    dlAnchorElem.setAttribute('href', dataStr);
    const fileName = `${(newSet.title || 'quiz_set').replace(/[^a-z0-9]/gi, '_').toLowerCase()}.json`;
    dlAnchorElem.setAttribute('download', fileName);
    dlAnchorElem.click();

    if (onSetCreated) {
      onSetCreated(newSet);
    }
    onExit();
  };

  return (
    <div className="quiz-screen create-set-screen">
      {notification && (
        <div className="creator-notification animate-slide-down">
          {notification}
        </div>
      )}

      {/* Header */}
      <header className="quiz-header">
        <button className="back-btn" onClick={onExit} aria-label="Back">
          <ChevronLeft size={24} />
        </button>

        <div className="progress creator-header-center">
          {isEditingDifficulty ? (
            <div className="level-edit-container">
              <span>Level</span>
              <input
                type="number"
                min="1"
                max="99"
                className="level-input"
                value={assignedDifficulty}
                onChange={(e) => setAssignedDifficulty(Math.max(1, parseInt(e.target.value) || 1))}
                onBlur={() => setIsEditingDifficulty(false)}
                onKeyDown={(e) => { if (e.key === 'Enter') setIsEditingDifficulty(false); }}
                autoFocus
              />
            </div>
          ) : (
            <div 
              className="level-badge-clickable" 
              onClick={() => setIsEditingDifficulty(true)}
              title="Click to change Level / Assigned Difficulty"
            >
              Level {assignedDifficulty}
              <Edit3 size={14} className="level-edit-icon" />
            </div>
          )}

          <div className="question-nav-container">
            <button
              className="nav-arrow-btn"
              onClick={handlePrevQuestion}
              disabled={currentQuestionIndex === 0}
              title="Previous question"
              aria-label="Previous question"
            >
              <ChevronLeft size={16} />
            </button>
            <span className="current-q-label">
              Question {currentQuestionIndex + 1}
            </span>
            <button
              className="nav-arrow-btn"
              onClick={handleNextQuestion}
              disabled={currentQuestionIndex >= completedQuestions.length}
              title="Next question"
              aria-label="Next question"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>

        <button 
          className="cheater-btn finish-btn active"
          onClick={handleFinishAndDownload}
          title="Finish and Download Question Set"
          aria-label="Finish and Download"
        >
          <Download size={18} />
          <span className="cheater-btn-text">Finish & Download</span>
        </button>
      </header>

      {/* Main Body */}
      <main className="quiz-main creator-main">
        {/* Set Title & Advance Requirement Config bar */}
        <div className="set-config-bar">
          <div className="set-title-container">
            {isEditingTitle ? (
              <input
                type="text"
                className="set-title-input"
                value={setTitle}
                onChange={(e) => setSetTitle(e.target.value)}
                onBlur={() => {
                  if (!setTitle.trim()) setSetTitle('My Custom Question Set');
                  setIsEditingTitle(false);
                }}
                onKeyDown={(e) => { if (e.key === 'Enter') setIsEditingTitle(false); }}
                autoFocus
              />
            ) : (
              <div className="set-title-display" onClick={() => setIsEditingTitle(true)}>
                <span>{setTitle}</span>
                <Edit3 size={14} />
              </div>
            )}
          </div>

          <div className="advance-percent-container">
            <input
              type="number"
              min="1"
              max="100"
              className="advance-percent-input"
              value={advancePercent}
              onChange={(e) => setAdvancePercent(Math.min(100, Math.max(1, parseInt(e.target.value) || 0)))}
            />
            <span className="advance-percent-label">% required to advance</span>
          </div>
        </div>

        {/* STAGE 1: DRAFTING */}
        {stage === 'drafting' && (
          <div className="creator-draft-flow animate-fade-in">
            {/* Question Text */}
            <div className="question-card creator-question-card">
              {isEditingQuestion ? (
                <div className="inline-editor">
                  <textarea
                    ref={questionInputRef}
                    className="question-textarea"
                    placeholder="Enter question text..."
                    value={questionText}
                    onChange={(e) => setQuestionText(e.target.value)}
                    onBlur={() => setIsEditingQuestion(false)}
                    rows={3}
                  />
                  <div className="editor-actions">
                    <button 
                      className="button-base button-primary btn-sm"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => setIsEditingQuestion(false)}
                    >
                      <Check size={16} /> Done
                    </button>
                  </div>
                </div>
              ) : (
                <h2 
                  className={`question-text creator-clickable ${!questionText ? 'placeholder' : ''}`}
                  onClick={() => setIsEditingQuestion(true)}
                >
                  {questionText || "Press here to change question text."}
                  <Edit3 size={18} className="inline-pencil" />
                </h2>
              )}
            </div>

            {/* Answers Grid */}
            <div className="answers-grid creator-answers-grid">
              {answers.map((answer, index) => {
                const isEditingThis = editingAnswerIndex === index;

                if (isEditingThis) {
                  return (
                    <div key={answer.id} className="answer-btn answer-editing-box">
                      <input
                        ref={answerInputRef}
                        type="text"
                        className="answer-input"
                        value={answerInputText}
                        onChange={(e) => setAnswerInputText(e.target.value)}
                        onBlur={handleSaveAnswer}
                        onKeyDown={(e) => { if (e.key === 'Enter') handleSaveAnswer(); }}
                        placeholder={`Answer ${index + 1}`}
                      />
                      <button 
                        className="button-base button-primary btn-sm"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={handleSaveAnswer}
                      >
                        <Check size={16} /> Save
                      </button>
                    </div>
                  );
                }

                return (
                  <div 
                    key={answer.id} 
                    className="answer-btn creator-answer-configured"
                    onClick={() => handleStartEditAnswer(index)}
                    title="Click to edit answer"
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => { if (e.key === 'Enter') handleStartEditAnswer(index); }}
                  >
                    <div className="answer-number">{index + 1}</div>
                    <span className="creator-answer-text">{answer.text}</span>
                    <div className="answer-actions">
                      <button 
                        type="button"
                        className="answer-action-btn edit-action"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleStartEditAnswer(index);
                        }}
                        title="Edit answer"
                        aria-label="Edit answer"
                      >
                        <Edit3 size={16} />
                      </button>
                      <button 
                        type="button"
                        className="answer-action-btn delete-action"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteAnswer(index);
                        }}
                        title="Delete answer"
                        aria-label="Delete answer"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                );
              })}

              {/* Show Initial or Next Answer Button (up to 5 max) */}
              {answers.length < 5 && (
                editingAnswerIndex === answers.length ? (
                  <div className="answer-btn answer-editing-box">
                    <input
                      ref={answerInputRef}
                      type="text"
                      className="answer-input"
                      value={answerInputText}
                      onChange={(e) => setAnswerInputText(e.target.value)}
                      onBlur={handleSaveAnswer}
                      onKeyDown={(e) => { if (e.key === 'Enter') handleSaveAnswer(); }}
                      placeholder={answers.length === 0 ? "Edit this answer..." : "Edit next answer..."}
                    />
                    <button 
                      className="button-base button-primary btn-sm"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={handleSaveAnswer}
                    >
                      <Check size={16} /> Add
                    </button>
                  </div>
                ) : (
                  <button
                    className="answer-btn creator-add-answer-btn"
                    onClick={() => handleStartEditAnswer(answers.length)}
                  >
                    <Plus size={18} />
                    <span>{answers.length === 0 ? "Edit this answer." : "Edit next answer."}</span>
                  </button>
                )
              )}
            </div>

            {/* Explanation Section */}
            <div className="creator-explanation-section">
              {isEditingExplanation ? (
                <div className="inline-editor explanation-box">
                  <textarea
                    ref={explanationInputRef}
                    className="explanation-textarea"
                    placeholder="Enter an explanation (shown if answered incorrectly)..."
                    value={explanation}
                    onChange={(e) => setExplanation(e.target.value)}
                    onBlur={handleSaveExplanation}
                    rows={2}
                  />
                  <div className="editor-actions">
                    <button 
                      className="button-base button-primary btn-sm"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={handleSaveExplanation}
                    >
                      <Check size={16} /> Done
                    </button>
                  </div>
                </div>
              ) : (
                <div 
                  className={`explanation-prompt-line ${explanation ? 'has-explanation' : ''}`}
                  onClick={() => setIsEditingExplanation(true)}
                >
                  <HelpCircle size={18} />
                  <span>{explanation ? `Explanation: ${explanation}` : "Press this to add an explanation."}</span>
                  <Edit3 size={14} className="inline-pencil" />
                </div>
              )}
            </div>

            {/* Submit & Randomize Step Trigger */}
            <div className="creator-submit-container">
              <button
                className={`button-base button-primary creator-proceed-btn ${answers.length >= 2 && questionText.trim() ? 'ready' : ''}`}
                onClick={handleSelectAnswersAndSubmit}
                disabled={answers.length < 2 || !questionText.trim()}
              >
                {answers.length < 2 
                  ? `Add at least 2 answers (${answers.length}/2)` 
                  : "Select Answers and Submit"}
              </button>
            </div>
          </div>
        )}

        {/* STAGE 2: RANDOM ORDER PROMPT MODAL */}
        {stage === 'prompt_random' && (
          <div className="random-prompt-overlay animate-fade-in">
            <div className="random-prompt-card glass-panel">
              <h3>Answer Order</h3>
              <p>Should these answers be displayed in random order?</p>
              <div className="prompt-buttons">
                <button 
                  className="button-base button-primary yes-btn"
                  onClick={() => handleRandomOrderResponse(true)}
                >
                  Yes (Randomized)
                </button>
                <button 
                  className="button-base prompt-no-btn"
                  onClick={() => handleRandomOrderResponse(false)}
                >
                  No (Keep Order)
                </button>
              </div>
            </div>
          </div>
        )}

        {/* STAGE 3: SELECT CORRECT ANSWERS */}
        {stage === 'selecting_correct' && (
          <div className="creator-selection-flow animate-fade-in">
            <div className="selection-instructions">
              Tap the correct answer(s) below:
            </div>

            <div className="question-card">
              <h2 className="question-text">{questionText}</h2>
              {explanation && (
                <div className="explanation-text">
                  <strong>Explanation:</strong> {explanation}
                </div>
              )}
            </div>

            <div className="answers-grid">
              {answers.map((answer, index) => {
                const isSelected = selectedCorrectIds.includes(answer.id);
                return (
                  <button
                    key={answer.id}
                    className={`answer-btn select-correct-btn ${isSelected ? 'correct-selected' : ''}`}
                    onClick={() => toggleCorrectAnswer(answer.id)}
                  >
                    {isOrdered && (
                      <div className="answer-number">{index + 1}</div>
                    )}
                    <span>{answer.text}</span>
                    {isSelected && <Check size={20} className="check-badge" />}
                  </button>
                );
              })}
            </div>

            {/* Bottom Button */}
            <div className="confirm-correct-container">
              <button
                className={`button-base button-primary bottom-confirm-btn ${selectedCorrectIds.length > 0 ? 'ready' : ''}`}
                onClick={handleConfirmCorrectAnswers}
                disabled={selectedCorrectIds.length === 0}
              >
                Press when Correct Answer(s) are Selected
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};
