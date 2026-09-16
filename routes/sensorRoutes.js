import e from "express";
import SensorController from "../controllers/sensorController.js";

const router = e.Router();

router.get(
    "/device/:deviceId/sensor/:sensorKey/history",
    async (req, res) => {
        try {
            const {
                deviceId,
                sensorKey
            } = req.params;

            const {
                period = "today"
            } = req.query;

            const result =
                await SensorController.getSensorHistory(
                    deviceId,
                    sensorKey,
                    period
                );

            res.json({
                success: true,
                deviceId,
                ...result
            });

        } catch (error) {
            console.error(
                "❌ Sensor history API error:",
                error
            );

            res.status(400).json({
                success: false,
                error: error.message
            });
        }
    }
);

export default router;