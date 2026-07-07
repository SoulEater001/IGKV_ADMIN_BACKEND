import "dotenv/config";
import express from 'express';
import cors from 'cors';
import { pool } from './config/db.js';
import authRoutes from './routes/authRoutes.js';
import zoneRoutes from './routes/zoneRoutes.js';

const PORT = process.env.PORT;
const app = express();

app.use(cors());
app.use(express.json());

app.get('/', (req, res) => {
    res.send('Hello World!');
});

app.use("/api", authRoutes);
app.use("/api/zones", zoneRoutes);


app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});