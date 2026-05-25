# gym-schedule

Web app personale per la scheda di allenamento: log carico/reps per settimana,
sincronizzazione PC↔telefono via `data.json` nel repo, timer di recupero automatico.

## Come funziona
- Sito statico su **GitHub Pages**.
- I dati vivono in `data.json`, scritti via **GitHub Contents API** con un token che
  resta solo nel tuo browser.

## Setup (una volta)

### 1. Repo pubblico
Il repo `xBacco/gym-schedule` deve essere **pubblico**.

### 2. Crea un token fine-grained
GitHub → Settings → Developer settings → **Fine-grained tokens** → *Generate new token*:
- **Repository access:** Only select repositories → `gym-schedule`
- **Permissions:** Repository permissions → **Contents: Read and write**
- Genera e copia il token (`github_pat_…`).

### 3. Attiva Pages
Repo → Settings → **Pages** → Source: *Deploy from a branch* → `main` / `/ (root)`.
L'URL sarà `https://xbacco.github.io/gym-schedule/`.

### 4. Inserisci il token
Apri l'app, tocca ⚙ e incolla il token. Resta salvato in quel browser. Ripeti su ogni
dispositivo (PC e telefono).

## Sviluppo locale

```bash
# Test
npm test

# Anteprima locale (serve un server perché usa ES modules)
python -m http.server 8000
# poi apri http://localhost:8000
```
