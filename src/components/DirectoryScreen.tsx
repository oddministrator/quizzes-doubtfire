import React, { useState, useEffect, useRef } from 'react';
import { OPFSService } from '../services/opfs';
import { QuestionSet } from '../types';
import { Download, Upload, Play, Trash2, RotateCcw, DownloadCloud } from 'lucide-react';
import './DirectoryScreen.css';

interface Props {
  onSelectSet: (set: QuestionSet) => void;
}

export const DirectoryScreen: React.FC<Props> = ({ onSelectSet }) => {
  const [sets, setSets] = useState<QuestionSet[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);

  const loadSets = async () => {
    setIsLoading(true);
    try {
      const loadedSets = await OPFSService.getAllQuestionSets();
      setSets(loadedSets);
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadSets();

    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const content = event.target?.result as string;
        const parsed = JSON.parse(content) as QuestionSet;
        if (!parsed.id) {
          parsed.id = `set-${Date.now()}`;
        }
        if (parsed.questions) {
          parsed.questions = parsed.questions.filter(q => q.text?.trim() && q.answers?.length > 0);
        }
        await OPFSService.saveQuestionSet(parsed);
        await loadSets();
      } catch (error) {
        alert("Failed to parse JSON file. Ensure it is a valid Question Set.");
      }
    };
    reader.readAsText(file);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleExport = (set: QuestionSet) => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(set, null, 2));
    const dlAnchorElem = document.createElement('a');
    dlAnchorElem.setAttribute("href", dataStr);
    dlAnchorElem.setAttribute("download", `${set.title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_export.json`);
    dlAnchorElem.click();
  };

  const handleReset = async (set: QuestionSet) => {
    if (window.confirm("Are you sure you want to reset all progress for this set?")) {
      const updatedSet = { ...set };
      const allDiffs = Array.from(new Set(updatedSet.questions.map(q => q.assigned_difficulty))).sort((a,b) => a-b);
      updatedSet.current_level = allDiffs[0] ?? 0;
      
      updatedSet.questions = updatedSet.questions.map(q => ({
        ...q,
        user_attempts: 0,
        correct_attempts: 0,
        current_attempt: 'null'
      }));
      
      await OPFSService.saveQuestionSet(updatedSet);
      await loadSets();
    }
  };

  const handleDelete = async (id: string) => {
    if (window.confirm("Are you sure you want to delete this set?")) {
      await OPFSService.deleteQuestionSet(id);
      await loadSets();
    }
  };

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setDeferredPrompt(null);
    }
  };

  return (
    <div className="directory-screen screen-container animate-fade-in">
      <header className="directory-header">
        <h1>Your Library</h1>
        <p className="subtitle">Manage and play your question sets</p>
      </header>

      <div className="directory-actions">
        <input 
          type="file" 
          accept=".json" 
          ref={fileInputRef} 
          style={{ display: 'none' }} 
          onChange={handleImport} 
        />
        <button 
          className="button-base button-primary"
          onClick={() => fileInputRef.current?.click()}
        >
          <Upload size={18} /> Import JSON Set
        </button>
        {deferredPrompt && (
          <button 
            className="button-base button-primary"
            onClick={handleInstallClick}
          >
            <DownloadCloud size={18} /> Install App
          </button>
        )}
      </div>

      <div className="sets-grid">
        {isLoading ? (
          <div className="loading-state">Loading...</div>
        ) : sets.length === 0 ? (
          <div className="empty-state glass-panel">
            <p>No question sets found.</p>
            <p>Import a JSON file to get started!</p>
          </div>
        ) : (
          sets.map((set: QuestionSet) => (
            <div key={set.id} className="set-card glass-panel">
              <div className="set-info">
                <h3>{set.title}</h3>
                <span className="question-count">{set.questions?.length || 0} questions</span>
              </div>
              <div className="set-actions">
                <button className="action-btn play-btn" onClick={() => onSelectSet(set)} aria-label="Play">
                  <Play size={20} />
                </button>
                <button className="action-btn export-btn" onClick={() => handleExport(set)} aria-label="Export">
                  <Download size={20} />
                </button>
                <button className="action-btn reset-btn" onClick={() => handleReset(set)} aria-label="Reset Progress">
                  <RotateCcw size={20} />
                </button>
                <button className="action-btn delete-btn" onClick={() => handleDelete(set.id)} aria-label="Delete">
                  <Trash2 size={20} />
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
