document.addEventListener('DOMContentLoaded', () => {
  const clearCacheBtn = document.getElementById('clearCache') as HTMLButtonElement;
  const cacheStatus = document.getElementById('cacheStatus');

  if (clearCacheBtn && cacheStatus) {
    clearCacheBtn.addEventListener('click', async () => {
      try {
        clearCacheBtn.disabled = true;
        clearCacheBtn.textContent = 'Очистка...';
        cacheStatus.textContent = '';
        cacheStatus.className = 'cache-status';

        await new Promise<void>((resolve) => {
          chrome.runtime.sendMessage({ action: 'clearCache' }, (response) => {
            if (chrome.runtime.lastError) {
              throw new Error(chrome.runtime.lastError.message);
            }
            resolve();
          });
        });

        cacheStatus.textContent = 'Кэш успешно очищен';
        cacheStatus.className = 'cache-status success';
      } catch (error) {
        cacheStatus.textContent = 'Ошибка при очистке кэша';
        cacheStatus.className = 'cache-status error';
        console.error('Error clearing cache:', error);
      } finally {
        clearCacheBtn.disabled = false;
        clearCacheBtn.textContent = 'Очистить кэш';
      }
    });
  }
}); 