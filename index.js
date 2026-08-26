import "dotenv/config";
import express from 'express';
import cors from 'cors';
import http from 'http'
import cookieParser from "cookie-parser";
import { pool } from './config/db.js';
import { digitalAgriPool } from "./config/digitalAgriDb.js";

import { startDeviceSnapshotWorker } from "./services/device-snapshot.service.js";
import initWS from "./websocket/wsServer.js";
import { initMQTT } from "./middleware/mqttClient.js";

import authRoutes from './routes/authRoutes.js';
import zoneRoutes from './routes/zoneRoutes.js';
import stateRoutes from './routes/stateRoutes.js';
import districtRoutes from './routes/districtRoutes.js';
import blockRoutes from './routes/blockRoutes.js';
import advisoryRoutes from './routes/advisoryRoutes.js';
import advisoryTypeRoutes from './routes/advisoryTypeRoutes.js';
import categoryRoutes from './routes/categoryRoutes.js';
import cropRoutes from './routes/cropRoutes.js';
import cropStageRoutes from './routes/cropStageRoutes.js';
import adminUsersRoutes from './routes/adminUsersRoutes.js';
import rolesRoutes from './routes/rolesRoutes.js';
import permissionRoutes from './routes/permissionRoutes.js';
import dashRoutes from './routes/dashRoutes.js';
import approvalRoutes from './routes/approvalRoutes.js';
import activityRoutes from './routes/activityRoutes.js';
import weatherStationRoutes from './routes/weatherStationRoutes.js';
import weatherObservationRoutes from './routes/weatherObservationRoutes.js';
import weatherForecastRoutes from './routes/weatherForecastRoutes.js';

import farmerRoutes from './routes/farmer.routes.js'
import filterRoutes from './routes/filters.routes.js'
import chartRoutes from './routes/chart.routes.js'
import deviceRoutes from './routes/device.routes.js'

const PORT = process.env.PORT;
const app = express();
const server = http.createServer(app);

app.set("trust proxy", true);

app.use(cookieParser());
app.use(cors({
    origin: process.env.CLIENT_URL,
    credentials: true
}));
app.use(express.json());

BigInt.prototype.toJSON = function () {
    return Number(this);
};

app.get('/', (req, res) => {
    res.send('Hello World!');
});

app.use("/api", authRoutes);
app.use("/api/zones", zoneRoutes);
app.use("/api/states", stateRoutes);
app.use("/api/districts", districtRoutes);
app.use("/api/blocks", blockRoutes);
app.use("/api/advisories", advisoryRoutes);
app.use("/api/advisories/types", advisoryTypeRoutes);
app.use("/api/categories", categoryRoutes);
app.use("/api/crops", cropRoutes);
app.use("/api/crop-stages", cropStageRoutes);
app.use("/api/users", adminUsersRoutes);
app.use("/api/roles", rolesRoutes);
app.use("/api/permissions", permissionRoutes);
app.use("/api/dashboard", dashRoutes);
app.use("/api/approval", approvalRoutes);
app.use("/api/activity-logs", activityRoutes);
app.use("/api/weather/stations", weatherStationRoutes);
app.use("/api/weather/observations", weatherObservationRoutes);
app.use("/api/weather/forecasts", weatherForecastRoutes);

app.use("/api/farmers", farmerRoutes);
app.use("/api/filters", filterRoutes);
app.use("/api/charts", chartRoutes);
app.use("/api/devices", deviceRoutes);

async function startServer() {
    try {
        const conn = await pool.getConnection();
        console.log("✅ Database connected successfully");
        conn.release();

        initWS(server);
        // initMQTT();
        startDeviceSnapshotWorker();

        server.listen(PORT, () => {
            console.log(`🚀 Server running on port ${PORT}`);
        });

    } catch (err) {
        console.error("❌ Failed to connect to database:", err.message);
        process.exit(1);
    }
}

startServer();