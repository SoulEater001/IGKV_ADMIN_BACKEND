// controllers/systemController.js

import {
    PERMISSION_ACTIONS,
    PERMISSION_ACTION_LIST,
    PERMISSION_RESOURCES,
    PERMISSION_RESOURCE_LIST,
    ROLES,
    APPROVAL_STATUS
} from "../constant/index.js";

import { ENTITIES } from "../constant/activityEntities.js";
import { ACTIONS } from "../constant/activityActions.js";

export const getSystemConstants = async (req, res) => {
    try {

        return res.status(200).json({
            success: true,
            data: {
                permissionActions: PERMISSION_ACTIONS,
                permissionActionList: PERMISSION_ACTION_LIST,
                permissionResources: PERMISSION_RESOURCES,
                permissionResourceList: PERMISSION_RESOURCE_LIST,
                roles: ROLES,
                entities: ENTITIES,
                actions: ACTIONS,
                approvalStatus: APPROVAL_STATUS
            }
        });

    } catch (error) {

        console.error(error);

        return res.status(500).json({
            success: false,
            message: "Failed to load system constants."
        });

    }
};