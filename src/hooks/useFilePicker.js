import { useCallback, useRef, useState } from 'react';

export function useFilePicker(loadFile) {
  const [isDragging, setIsDragging] = useState(false);
  const inputRef = useRef(null);

  const onDragOver = useCallback((e) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const onDragLeave = useCallback(() => {
    setIsDragging(false);
  }, []);

  const onDrop = useCallback((e) => {
    e.preventDefault();
    setIsDragging(false);
    loadFile(e.dataTransfer.files?.[0]);
  }, [loadFile]);

  const onInputChange = useCallback((e) => {
    loadFile(e.target.files?.[0]);
    e.target.value = '';
  }, [loadFile]);

  const openPicker = useCallback(() => {
    inputRef.current?.click();
  }, []);

  return {
    inputRef,
    isDragging,
    onDragOver,
    onDragLeave,
    onDrop,
    onInputChange,
    openPicker,
  };
}
