import e from "express";
import * as userController from '../controllers/iot-user.controller.js'

const router = e.Router();

router.get("/", userController.getAllUsers);
router.get("/with-devices", userController.getAllUsersWithDevices);

export default router;
