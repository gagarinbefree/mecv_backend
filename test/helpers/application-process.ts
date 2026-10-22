import type { ChildProcessWithoutNullStreams } from 'node:child_process';
import { once } from 'node:events';

/**
 * Ожидает объявление готовности собранного HTTP-приложения без опроса фиксированного порта.
 * @param child - Дочерний процесс, принадлежащий тесту.
 * @returns Адрес GraphQL, объявленный после успешного listen.
 */
export function waitForApplication(child: ChildProcessWithoutNullStreams): Promise<string> {
  child.stdout.setEncoding('utf8');
  child.stderr.resume();
  return new Promise(attachListeners);

  /**
   * Подписывается на вывод, ошибки и преждевременное завершение дочернего процесса.
   * @param resolve - Принимает объявленный адрес готового приложения.
   * @param reject - Принимает ошибку подготовки или таймаута.
   */
  function attachListeners(resolve: (endpoint: string) => void, reject: (error: Error) => void): void {
    let output = '';
    const timer = setTimeout(onTimeout, 45_000);
    child.stdout.on('data', onData);
    child.once('exit', onExit);
    child.once('error', onError);

    /**
     * Накапливает UTF-8 вывод до сообщения HTTP-готовности.
     * @param chunk - Неизвестные данные потока, проверяемые перед использованием.
     */
    function onData(chunk: unknown): void {
      if (typeof chunk !== 'string') return;
      output += chunk;
      const endpoint = /GraphQL и Apollo Sandbox: (http:\/\/\S+)/.exec(output)?.[1];
      if (endpoint) {
        cleanup();
        resolve(endpoint);
      }
    }

    /** Сообщает об ошибке, если процесс завершился до объявления HTTP-готовности. */
    function onExit(): void {
      cleanup();
      reject(new Error('Процесс завершился до объявления HTTP-готовности.'));
    }

    /**
     * Передаёт ошибку создания дочернего процесса тесту.
     * @param error - Ошибка запуска Node.js.
     */
    function onError(error: Error): void {
      cleanup();
      reject(error);
    }

    /** Ограничивает ожидание готовности, оставляя остановку процесса владельцу теста. */
    function onTimeout(): void {
      cleanup();
      reject(new Error('Превышено время ожидания HTTP-готовности.'));
    }

    /** Освобождает таймер и подписки после любого результата ожидания. */
    function cleanup(): void {
      clearTimeout(timer);
      child.stdout.off('data', onData);
      child.off('exit', onExit);
      child.off('error', onError);
    }
  }
}

/**
 * Останавливает исключительно принадлежащий тесту процесс и дожидается его завершения.
 * @param child - Дочерний процесс, который создал текущий тест.
 */
export async function stopApplication(child: ChildProcessWithoutNullStreams): Promise<void> {
  if (child.exitCode !== null || child.signalCode !== null) return;
  const exited = once(child, 'exit');
  child.kill('SIGTERM');
  const timer = setTimeout(forceStop, 5_000);
  try {
    await exited;
  } finally {
    clearTimeout(timer);
  }

  /** Завершает только собственный дочерний процесс, если обычная остановка не завершилась. */
  function forceStop(): void {
    child.kill('SIGKILL');
  }
}
