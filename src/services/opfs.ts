import { QuestionSet } from '../types';

/**
 * Service to manage QuestionSets using the Origin Private File System (OPFS)
 */
export const OPFSService = {
  async getDirectory(): Promise<FileSystemDirectoryHandle> {
    return await navigator.storage.getDirectory();
  },

  async saveQuestionSet(questionSet: QuestionSet): Promise<void> {
    const dir = await this.getDirectory();
    // Use the ID as the filename
    const fileHandle = await dir.getFileHandle(`${questionSet.id}.json`, { create: true });
    const writable = await fileHandle.createWritable();
    await writable.write(JSON.stringify(questionSet, null, 2));
    await writable.close();
  },

  async loadQuestionSet(id: string): Promise<QuestionSet> {
    const dir = await this.getDirectory();
    const fileHandle = await dir.getFileHandle(`${id}.json`);
    const file = await fileHandle.getFile();
    const text = await file.text();
    const parsed = JSON.parse(text) as QuestionSet;
    if (parsed.questions) {
      parsed.questions = parsed.questions.filter(q => q.text?.trim() && q.answers?.length > 0);
    }
    return parsed;
  },

  async getAllQuestionSets(): Promise<QuestionSet[]> {
    const dir = await this.getDirectory();
    const sets: QuestionSet[] = [];
    
    // @ts-ignore - TS doesn't fully support async iterables on FileSystemDirectoryHandle yet in standard DOM lib depending on version
    for await (const entry of dir.values()) {
      if (entry.kind === 'file' && entry.name.endsWith('.json')) {
        try {
          const fileHandle = await dir.getFileHandle(entry.name);
          const file = await fileHandle.getFile();
          const text = await file.text();
          const parsed = JSON.parse(text) as QuestionSet;
          if (parsed.questions) {
            parsed.questions = parsed.questions.filter(q => q.text?.trim() && q.answers?.length > 0);
          }
          sets.push(parsed);
        } catch (e) {
          console.error(`Error reading ${entry.name}`, e);
        }
      }
    }
    
    return sets;
  },
  
  async deleteQuestionSet(id: string): Promise<void> {
    const dir = await this.getDirectory();
    await dir.removeEntry(`${id}.json`);
  }
};
