Read CONCEPT.md in this directory. It describes Legacy Switch, a digital dead man's switch web app (Kiroween 2026 hackathon, Frankenstein category).

Using spec-driven development, create ONLY the planning artifacts — do not write any application code yet:

1. Steering docs in .kiro/steering/: product.md (what the product is, who it is for, core principles), tech.md (stack decisions with reasons, commands, conventions), structure.md (planned repo layout and file responsibilities).
2. A feature spec in .kiro/specs/legacy-switch/: requirements.md (numbered requirements with acceptance criteria, in Kiro spec format), design.md (architecture, components, data model, encryption approach, timer state machine, interfaces), tasks.md (small implementation tasks in dependency order, each with the requirement it covers).

Scope: the MVP in CONCEPT.md only — accounts, capsules with end-to-end encryption (WebCrypto AES-GCM, PBKDF2 key derivation in the browser), check-in timer with grace period, trusted contacts, one-time release links, dashboard, and a demo mode with accelerated timers for judges. Keep the stack web-based and deployable on free tiers (React + Vite + TypeScript frontend, Node backend, SQLite/Postgres).

Work through the spec workflow properly: requirements first, then design, then tasks. Write the files to disk as you go.
