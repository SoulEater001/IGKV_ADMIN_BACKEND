import "dotenv/config";
import express from 'express';
import cors from 'cors';
import { pool } from './config/db.js';
import authRoutes from './routes/authRoutes.js';
import zoneRoutes from './routes/zoneRoutes.js';
import stateRoutes from './routes/stateRoutes.js';
import districtRoutes from './routes/districtRoutes.js';
import blockRoutes from './routes/blockRoutes.js';
import advisoryRoutes from './routes/advisoryRoutes.js';
import categoryRoutes from './routes/categoryRoutes.js';
import cropRoutes from './routes/cropRoutes.js';
import adminUsersRoutes from './routes/adminUsersRoutes.js';
import rolesRoutes from './routes/rolesRoutes.js';
import permissionRoutes from './routes/permissionRoutes.js';
import dashRoutes from './routes/dashRoutes.js';

const PORT = process.env.PORT;
const app = express();

app.use(cors());
app.use(express.json());

app.get('/', (req, res) => {
    res.send('Hello World!');
});

app.use("/api", authRoutes);
app.use("/api/zones", zoneRoutes);
app.use("/api/state", zoneRoutes);
app.use("/api/states", stateRoutes);
app.use("/api/districts", districtRoutes);
app.use("/api/blocks", blockRoutes);
app.use("/api/advisories", advisoryRoutes);
app.use("/api/categories", categoryRoutes);
app.use("/api/crops", cropRoutes);
app.use("/api/users", adminUsersRoutes);
app.use("/api/roles", rolesRoutes);
app.use("/api/permissions", permissionRoutes);
app.use("/api/dashboard", dashRoutes);



app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});