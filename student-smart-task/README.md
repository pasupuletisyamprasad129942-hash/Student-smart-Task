# Student Smart Task

A full-stack academic task planner and study focus web application built with **HTML/CSS/JavaScript** on the frontend and **Node.js, Express, and MongoDB (Mongoose)** on the backend.

## Features

- **Smart Priority Scoring**: Automatically ranks pending tasks using due-date urgency, priority level, in-progress status, and estimated study time.
- **Smart Next Step Banner**: Recommends the highest-priority task to tackle next with one-click focus mode.
- **Built-in Study Focus Timer**: 25-minute Focus / 5-minute Break Pomodoro timer linked to your selected task.
- **Subject Progress & Analytics**: KPI summary cards (Pending, Due Today, Study Time Left, Completed) and per-subject completion progress bars.
- **Full CRUD & Filtering**: Create, edit, update status (`todo`, `in-progress`, `completed`), delete, search, filter by subject/priority/status, and sort.
- **Light & Dark Themes**: Toggleable UI theme persisted in `localStorage`.
- **MongoDB Integration via `.env`**: Configurable database connection string for local MongoDB or MongoDB Atlas.

## Project Structure

```
student-smart-task/
├── .gitignore
├── README.md
├── backend/
│   ├── .env                  # Environment & MongoDB connection variables
│   ├── .env.example          # Example environment template
│   ├── package.json
│   ├── server.js             # Express server & static frontend hosting
│   ├── config/
│   │   └── db.js             # Mongoose MongoDB connection helper
│   ├── models/
│   │   └── Task.js           # Mongoose schema & Smart Score calculation
│   └── routes/
│       └── tasks.js          # REST API endpoints (/api/tasks)
└── frontend/
    ├── index.html
    ├── css/
    │   └── styles.css
    └── js/
        └── app.js
```

## Setup & Running Locally

### Prerequisites
- [Node.js](https://nodejs.org/) (v18+ recommended)
- [MongoDB](https://www.mongodb.com/try/download/community) running locally, or a free [MongoDB Atlas](https://www.mongodb.com/atlas) cluster

### 1. Configure `.env`
Open `backend/.env` and verify or update your MongoDB connection string:

```env
PORT=5000
NODE_ENV=development
MONGODB_URI=mongodb://127.0.0.1:27017/student_smart_task
CORS_ORIGIN=*
```

If using MongoDB Atlas, replace `MONGODB_URI` with your `mongodb+srv://...` connection string.

### 2. Install Dependencies & Start the Server
```bash
cd backend
npm install
npm start
```

For auto-reloading during development:
```bash
npm run dev
```

### 3. Open the App
Visit **http://localhost:5000** in your browser. The Express server serves both the REST API (`/api/tasks`) and the frontend UI (`frontend/`).

## API Endpoints

| Method | Endpoint | Description |
| --- | --- | --- |
| `GET` | `/api/health` | Check API and MongoDB connection state |
| `GET` | `/api/tasks` | List tasks (supports `status`, `priority`, `subject`, `category`, `search`, `sort`) |
| `GET` | `/api/tasks/stats` | Get summary metrics and subject breakdown |
| `POST` | `/api/tasks` | Create a new task |
| `PATCH` | `/api/tasks/:id` | Update task fields or status |
| `DELETE` | `/api/tasks/:id` | Delete a task |
| `DELETE` | `/api/tasks/completed/clear` | Delete all completed tasks |
