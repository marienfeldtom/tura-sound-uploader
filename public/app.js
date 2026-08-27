// 7secs – global JS
// Close native dialogs on backdrop click
document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('dialog').forEach(d => {
    d.addEventListener('click', e => { if (e.target === d) d.close(); });
  });
});
