# MediPredict AI — Symptom Interview, Disease Prediction, Treatment & Prevention (MERN)

No login. You pick the symptom that bothers you most, the app **asks follow-up questions one at a time**
(like a doctor), predicts the most likely condition, and shows **medical treatment, medicines, tests to ask about,
prevention, diet and when to see a doctor**.

> Educational project. Not a medical device and not a substitute for a doctor.

## Dataset (already trained in)
Trained on the Kaggle **Disease Symptom Prediction** dataset (itachi9604): 4,920 patient records, 41 diseases, 131 symptoms.
- Kaggle: search "Disease Symptom Prediction" by **itachi9604** (files: `dataset.csv`, `symptom_Description.csv`, `symptom_precaution.csv`, `Symptom-severity.csv`)
- The project ships with `server/data/model.json`, so you do **not** need to download anything to run or deploy it.
- To retrain (or use another dataset): put the CSV files in `server/dataset/` and run `cd server && npm run train`.
  Supported: `dataset.csv` (itachi9604) or `Training.csv` (kaushil268, "Disease Prediction Using Machine Learning").
- The dataset only has symptoms + diseases. The treatment, medicine, test, prevention and diet text for all 41 diseases
  is written in `server/data/content.js` (general educational information).

## How it works
`server/services/predictor.js` is an adaptive interview engine:
1. `scripts/train.js` learns P(symptom | disease) from the dataset (Naive Bayes) into `data/model.json`.
2. After each answer the probability of every disease is updated.
3. The next question is the symptom that **reduces uncertainty the most** (information gain), so every complaint gets its own tailored questions (typically 8–10).
4. It asks at least 8 and at most 18 questions, and stops once confident. Broad questions ("are you tired?") are down-weighted so the questions stay specific to your complaint; chest-pain / breathlessness safety questions are asked only when plausible, and you can always tap **+ Add a symptom** to mention anything else.
5. Red-flag combinations (chest pain + breathlessness, slurred speech, blood in sputum, ...) show an urgent warning.

### Measured accuracy (rows held out from training, 80/20 split)
| Test | Top-1 | Top-3 | Avg. questions |
|---|---|---|---|
| Held-out patients (984) | 100% | 100% | 8.3 |
| Same, but patients forget 20% of their real symptoms | 91.1% | 93.4% | 10.4 |

**Read this honestly:** this dataset is very clean and each disease has a distinctive symptom pattern, so near-perfect
scores are expected and do **not** mean 99.9% accuracy on real patients. Real people describe symptoms
imprecisely, many diseases share symptoms, and 41 diseases is a small subset of medicine. The second row is the more realistic figure.

## Stack
React 18 + Vite · Node + Express · MongoDB (Mongoose) · helmet, CORS, rate limiting.
MongoDB only stores **anonymous** finished-checkup counts; **the app works even if MongoDB is down.**

## Structure
```
server/
  server.js  config/db.js  models/Consultation.js
  routes/consult.js  routes/diseases.js
  services/predictor.js          # interview engine
  scripts/train.js               # trains + evaluates from Kaggle CSV -> data/model.json
  data/model.json                # trained model (shipped)
  data/content.js                # treatment/prevention text for 41 diseases
  data/knowledge.js              # loads model.json (falls back to built-in data/diseases.js)
  dataset/                       # (optional) drop Kaggle CSVs here
  test/engine.test.js
client/src/pages/Consult.jsx (chat)  pages/Diseases.jsx  components/{Navbar,ResultCard}.jsx
```

## API
| Method | Route | Purpose |
|---|---|---|
| GET | `/api/symptoms` | all symptoms + common starters |
| POST | `/api/consult/next` | `{yes:[],no:[],skip:[],finish?}` → next question or final result |
| GET | `/api/diseases?q=` , `/api/diseases/:id` | browse conditions |
| GET | `/api/model` | which model is loaded + its held-out accuracy |
| GET | `/api/stats` | anonymous usage counts |
| GET | `/api/health` | health check |

## Run locally
```bash
npm run install:all
cp server/.env.example server/.env
cp client/.env.example client/.env
npm run dev:server     # http://localhost:5000
npm run dev:client     # http://localhost:5173
npm test               # engine tests
```
Or: `docker compose up --build` → http://localhost:3000

## Deploy (free)
1. **MongoDB Atlas** (optional): free M0 cluster, create a user, allow `0.0.0.0/0`, copy the connection string and add `/medipredict` before the `?`.
2. **Render** (backend): New → Web Service → root dir `server`, build `npm install`, start `npm start`. Env vars: `MONGO_URI` (optional), `CLIENT_URL` (your Vercel URL).
3. **Vercel** (frontend): root dir `client`, env `VITE_API_URL=https://YOUR-API.onrender.com/api`.
4. Set Render's `CLIENT_URL` to the exact Vercel URL (no trailing slash) and redeploy.
Check `https://YOUR-API.onrender.com/api/model` — it should say `trained:dataset.csv`.
Free Render services sleep after 15 min, so the first request can take ~30–60 s.
