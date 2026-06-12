export const startGlobalDrag = () => {
  const root = document.getElementById('tpm-root-container');
  if (root) {
    root.style.pointerEvents = 'auto';
    root.style.backgroundColor = 'rgba(0, 0, 0, 0.005)';
  }
};

export const stopGlobalDrag = () => {
  const root = document.getElementById('tpm-root-container');
  if (root) {
    root.style.pointerEvents = 'none';
    root.style.backgroundColor = 'transparent';
  }
};
