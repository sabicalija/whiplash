/**
 * Built-in default alphaTex score loaded on startup so Whiplash is immediately
 * playable without uploading an external .gp file.
 *
 * Uses alphaTab 1.9+ alphaTex syntax:
 *  - Metadata arguments wrapped in parentheses: `\track ("Studio Drum Kit" "Drums")`
 *  - Duration ranges `:4`, `:8` so percussion articulation numbers (36, 38, 42)
 *    are parsed as Articulation notes rather than `fret.string` pairs.
 */
export const DEFAULT_ALPHATEX_SCORE = String.raw`
\title ("Whiplash Groove — Studio Practice Etude")
\subtitle ("Built-in Percussion & Bass Demo")
\artist ("Whiplash Trainer")
\tempo (110)

\track ("Studio Drum Kit" "Drums")
\staff {score}
\instrument ("percussion")
\ts (4 4)
:4 36 38 36 38 |
:4 36 38 36 38 |
:8 (36 42) 42 (38 42) 42 (36 42) 42 (38 42) 42 |
:8 (36 42) 42 (38 42) 42 (36 42) 42 (38 42) 42 |

\track ("Electric Finger Bass" "Bass")
\staff {score tabs}
\instrument (33)
\tuning (E1 A1 D2 G2)
\ts (4 4)
:8 0.4 0.4 3.4 5.4 0.4 0.4 7.4 5.4 |
:8 0.4 0.4 3.4 5.4 5.2 4.2 2.2 0.4 |
:8 0.4 0.4 3.4 0.4 5.4 0.4 7.4 5.4 |
:8 0.4 0.4 3.4 5.4 7.3 5.3 :4 0.4 |
`.trim()
