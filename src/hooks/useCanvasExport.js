import { useCallback } from 'react';

export function useCanvasExport(canvasRef) {
  const exportPng = useCallback((filename = 'pictureplane-export.png') => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const url = canvas.toDataURL('image/png');
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
  }, [canvasRef]);

  return { exportPng };
}
