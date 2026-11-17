# Seurapomo

A football-manager board game for two to six people sharing one screen. Each player runs a club, takes turns
rolling a die around a board, and tries to end up richer than everyone else. The interface is in Finnish.

It runs entirely in the browser. There is no server and no account; the game in progress is saved in the
browser's local storage.

## Running it

You need Node.js and npm.

```sh
npm install
npm run dev
```

Vite prints the address to open, normally http://localhost:5173.

| Command | What it does |
|---|---|
| `npm run dev` | Starts the development server |
| `npm test` | Runs the tests |
| `npm run build` | Type-checks and builds to `dist/` |
| `npm run preview` | Serves the built version |

## How the game plays

**Seats.** Two to six managers. Any seat after the first can be handed to the computer. The league always has
ten clubs, so the rest are computer clubs.

**A week.** Every manager takes one turn on the board, then that week's matches are played. A season is 26
weeks: 18 league rounds, five cup rounds and three European rounds.

**A turn.** Wages are paid, then you roll and move around a 24-square board. Squares bring player auctions,
scouting offers, academy players, training, sponsor money, injuries, tax and press cards, which can help or hurt.
Before the match you choose a formation and can promise the team a bonus to lift morale.

**Players.** Each has a skill from 1 to 9 and *sisu*, which decides tight matches and late goals. Formations
counter each other, so the right shape against this week's opponent matters as much as the eleven names.

**Matches.** Results play out live over about fifteen seconds, minute by minute, with goals flashing up for the
managers' own matches.

**Money.** Income comes from gate receipts, sponsors, prize money and selling players. A manager in debt must
sell players before ending the turn. A club that is in debt with only eleven players left goes bankrupt and is
taken over by the computer.

**Competitions.** Alongside the league there is a 32-club cup with lower-division sides and three European
cups against foreign clubs.

**Winning.** The game is open-ended. At the end of any season the players can stop and count up, or play one
more. The winner is the manager with the most wealth: cash plus the value of the squad.

## Code

| Path | Contents |
|---|---|
| `src/game/engine.ts` | The rules, as a pure reducer with a seeded random-number generator |
| `src/game/data.ts` | Clubs, names, formations, board squares and cards |
| `src/game/bot.ts` | The computer manager |
| `src/game/engine.test.ts` | Tests for the rules and the computer manager |
| `src/*.tsx` | The React interface: setup, board, sidebar and overlays |

Built with React, TypeScript, Vite and Vitest.

## Licence

Copyright © 2026 Heikki Venhola.

Seurapomo is free software: you can redistribute it and modify it under the terms of the GNU General Public
License, version 3, as published by the Free Software Foundation. It comes with no warranty. The full text is in
[LICENSE](LICENSE).
