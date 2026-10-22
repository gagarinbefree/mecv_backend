export type ServerConfig = Readonly<{ port: number; host: string }>;

/**
 * Проверяет сетевую конфигурацию до любых изменений базы данных.
 * @param portValue - Значение PORT либо отсутствие настройки.
 * @param hostValue - Значение HOST либо отсутствие настройки.
 * @returns Параметры HTTP-сервера; порт 0 разрешает назначение свободного порта системой.
 * @throws {Error} Если порт не является целым числом 0–65535 или адрес пустой/содержит пробелы.
 */
export function readServerConfig(portValue: string | undefined, hostValue: string | undefined): ServerConfig {
  const text = portValue ?? '3000';
  const port = Number(text);
  if (!/^\d+$/.test(text) || !Number.isInteger(port) || port > 65535) {
    throw new Error('PORT должен быть целым числом от 0 до 65535.');
  }
  const host = hostValue ?? '127.0.0.1';
  if (!host || /\s/.test(host)) throw new Error('HOST должен содержать непустой адрес без пробелов.');
  return { port, host };
}
