import { useState, useCallback } from 'react';

interface FileHashState {
  hash: string | null;
  fileName: string | null;
  fileSize: number | null;
  isHashing: boolean;
  error: string | null;
}

export function useFileHash() {
  const [state, setState] = useState<FileHashState>({
    hash: null,
    fileName: null,
    fileSize: null,
    isHashing: false,
    error: null,
  });

  const hashFile = useCallback(async (file: File): Promise<string | null> => {
    setState({
      hash: null,
      fileName: file.name,
      fileSize: file.size,
      isHashing: true,
      error: null,
    });

    try {
      const buffer = await file.arrayBuffer();
      const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      const hashHex = '0x' + hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

      setState({
        hash: hashHex,
        fileName: file.name,
        fileSize: file.size,
        isHashing: false,
        error: null,
      });

      return hashHex;
    } catch (err) {
      const error = err as Error;
      setState(prev => ({
        ...prev,
        isHashing: false,
        error: error.message || 'Failed to compute file hash',
      }));
      return null;
    }
  }, []);

  const reset = useCallback(() => {
    setState({
      hash: null,
      fileName: null,
      fileSize: null,
      isHashing: false,
      error: null,
    });
  }, []);

  return { ...state, hashFile, reset };
}
