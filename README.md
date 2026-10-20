# MECV backend

[![Tests and build](https://github.com/gagarinbefree/mecv_backend/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/gagarinbefree/mecv_backend/actions/workflows/ci.yml)

Backend цифровой визитки на TypeScript, NestJS, Prisma и Apollo GraphQL.

Сейчас подготовлен начальный каркас: функциональная композиция NestJS, строгая типизация, ESLint, тесты и сборка. Профиль, Prisma-схема и GraphQL API будут реализованы следующими TDD-этапами. Docker отложен; для работы с данными используется обычный PostgreSQL.

Контракт запроса profile и связанных типов описан в [GraphQL-схеме](src/profile/profile.graphql). Тесты проверяют запрос из задания, вложенные данные, пустые списки и допустимость null. Подключение схемы к HTTP-серверу и обработка скаляра Date относятся к следующим этапам.

Плашка отражает фактический результат workflow Tests and build в GitHub Actions. Зелёный статус означает, что ESLint, проверка типов, тесты и сборка завершились успешно; отсутствие запусков не является подтверждением успеха.

## Локальная проверка

Нужен Node.js 24.15 или совместимый более новый patch ветки 24.

~~~shell
npm ci
npm run check
~~~

Отдельные команды: npm run lint, npm run typecheck, npm test и npm run build. Сборка помещает JavaScript в dist. На текущем этапе сервер приложения ещё не реализован.

## Правила разработки

TDD, функциональный стиль без собственных классов, содержательный JSDoc у каждой функции, строгий TypeScript без any. Эти правила распространяются на тесты и проверяются ESLint. Отрицательные тесты отдельно подтверждают запрет классов, any и функций без JSDoc.
