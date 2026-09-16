import {
    executeCreateUser,
    executeUpdateUser,
    executeDeleteUser
} from "./adminUserService.js";

import {
    executeCreateRole,
    executeUpdateRole,
    executeDeleteRole
} from "./roleService.js";

import {
    executeCreatePermission,
    executeDeletePermission
} from "./permissionService.js";

import {
    executeCreateCategory,
    executeUpdateCategory,
    executeDeleteCategory
} from "./categoryService.js";

import {
    executeCreateAdvisoryType,
    executeUpdateAdvisoryType,
    executeDeleteAdvisoryType
} from "./advisoryService.js";

import {
    executeCreateCrop,
    executeUpdateCrop,
    executeDeleteCrop
} from "./cropService.js";

import {
    executeCreateCropStage,
    executeUpdateCropStage,
    executeDeactivateCropStage
} from "./cropStageService.js";

import {
    executeCreateCropRange,
    executeUpdateCropRange,
    executeDeactivateCropRange
} from "./cropRangeService.js";

import {
    executeCreateSensorAlert,
    executeUpdateSensorAlert,
    executeDeleteSensorAlert
} from "./sensorAlertService.js";

import {
    executeCreateAdvisory,
    executeUpdateAdvisory,
    executeDeleteAdvisory
} from "./advisoryService.js";

import {
    executeCreateZone,
    executeUpdateZone,
    executeDeleteZone
} from "./zoneService.js";

import {
    executeCreateState,
    executeUpdateState,
    executeDeleteState
} from "./stateService.js";

import {
    executeCreateDistrict,
    executeUpdateDistrict,
    executeDeleteDistrict
} from "./districtService.js";

import {
    executeCreateBlock,
    executeUpdateBlock,
    executeDeleteBlock
} from "./blockService.js";

import {
    executeUpdateRoleManagement
} from "./roleManagementService.js";

import { ACTIONS } from '../constant/activityActions.js';
import { ENTITIES } from '../constant/activityEntities.js'

export const executeApprovedRequest = async (
    connection,
    request,
    payload
) => {

    switch (`${request.resource}:${request.action}`) {

        case `${ENTITIES.USER}:${ACTIONS.CREATE}`:
            return await executeCreateUser(connection, payload);

        case `${ENTITIES.USER}:${ACTIONS.UPDATE}`:
            return await executeUpdateUser(connection, payload);

        case `${ENTITIES.USER}:${ACTIONS.DELETE}`:
            return await executeDeleteUser(
                connection,
                payload.id
            );

        case `${ENTITIES.ROLE}:${ACTIONS.CREATE}`:
            return await executeCreateRole(
                connection,
                payload
            );

        case `${ENTITIES.ROLE}:${ACTIONS.UPDATE}`:
            return await executeUpdateRole(
                connection,
                payload
            );

        case `${ENTITIES.ROLE}:${ACTIONS.DELETE}`:
            return await executeDeleteRole(
                connection,
                payload.id
            );

        case `${ENTITIES.ROLE_MANAGEMENT}:${ACTIONS.UPDATE}`:
            return await executeUpdateRoleManagement(
                connection,
                payload,
                request.requested_by
            );

        case `${ENTITIES.PERMISSION}:${ACTIONS.CREATE}`:
            return await executeCreatePermission(
                connection,
                payload
            );

        case `${ENTITIES.PERMISSION}:${ACTIONS.DELETE}`:
            return await executeDeletePermission(
                connection,
                payload.id
            );

        case `${ENTITIES.CATEGORY}:${ACTIONS.CREATE}`:
            return await executeCreateCategory(
                connection,
                payload
            );

        case `${ENTITIES.CATEGORY}:${ACTIONS.UPDATE}`:
            return await executeUpdateCategory(
                connection,
                payload
            );

        case `${ENTITIES.CATEGORY}:${ACTIONS.DELETE}`:
            return await executeDeleteCategory(
                connection,
                payload.id
            );

        case `${ENTITIES.ADVISORY_TYPE}:${ACTIONS.CREATE}`:
            return await executeCreateAdvisoryType(
                connection,
                payload
            );

        case `${ENTITIES.ADVISORY_TYPE}:${ACTIONS.UPDATE}`:
            return await executeUpdateAdvisoryType(
                connection,
                payload
            );

        case `${ENTITIES.ADVISORY_TYPE}:${ACTIONS.DELETE}`:
            return await executeDeleteAdvisoryType(
                connection,
                payload.id
            );

        case `${ENTITIES.CROP}:${ACTIONS.CREATE}`:
            return await executeCreateCrop(
                connection,
                payload
            );

        case `${ENTITIES.CROP}:${ACTIONS.UPDATE}`:
            return await executeUpdateCrop(
                connection,
                payload
            );

        case `${ENTITIES.CROP}:${ACTIONS.DELETE}`:
            return await executeDeleteCrop(
                connection,
                payload.id
            );

        case `${ENTITIES.CROP_STAGE}:${ACTIONS.CREATE}`:
            return await executeCreateCropStage(
                connection,
                payload
            );

        case `${ENTITIES.CROP_STAGE}:${ACTIONS.UPDATE}`:
            return await executeUpdateCropStage(
                connection,
                payload
            );

        case `${ENTITIES.CROP_STAGE}:${ACTIONS.DELETE}`:
            return await executeDeactivateCropStage(
                connection,
                payload.id
            );

        case `${ENTITIES.CROP_RANGE}:${ACTIONS.CREATE}`:
            return await executeCreateCropRange(
                connection,
                payload
            );

        case `${ENTITIES.CROP_RANGE}:${ACTIONS.UPDATE}`:
            return await executeUpdateCropRange(
                connection,
                payload
            );

        case `${ENTITIES.CROP_RANGE}:${ACTIONS.DELETE}`:
            return await executeDeactivateCropRange(
                connection,
                payload.id
            );

        case `${ENTITIES.SENSOR_ALERT}:${ACTIONS.CREATE}`:
            return await executeCreateSensorAlert(
                connection,
                payload
            );

        case `${ENTITIES.SENSOR_ALERT}:${ACTIONS.UPDATE}`:
            return await executeUpdateSensorAlert(
                connection,
                payload
            );

        case `${ENTITIES.SENSOR_ALERT}:${ACTIONS.DELETE}`:
            return await executeDeleteSensorAlert(
                connection,
                payload.id
            );

        case `${ENTITIES.ADVISORY}:${ACTIONS.CREATE}`:
            return await executeCreateAdvisory(
                connection,
                payload
            );

        case `${ENTITIES.ADVISORY}:${ACTIONS.UPDATE}`:
            return await executeUpdateAdvisory(
                connection,
                payload
            );

        case `${ENTITIES.ADVISORY}:${ACTIONS.DELETE}`:
            return await executeDeleteAdvisory(
                connection,
                payload.id
            );

        case `${ENTITIES.ZONE}:${ACTIONS.CREATE}`:
            return await executeCreateZone(
                connection,
                payload,
                request.requested_by
            );

        case `${ENTITIES.ZONE}:${ACTIONS.UPDATE}`:
            return await executeUpdateZone(
                connection,
                payload,
                request.requested_by
            );

        case `${ENTITIES.ZONE}:${ACTIONS.DELETE}`:
            return await executeDeleteZone(
                connection,
                payload.id,
                request.requested_by
            );

        case `${ENTITIES.STATE}:${ACTIONS.CREATE}`:
            return await executeCreateState(
                connection,
                payload,
                request.requested_by
            );

        case `${ENTITIES.STATE}:${ACTIONS.UPDATE}`:
            return await executeUpdateState(
                connection,
                payload,
                request.requested_by
            );

        case `${ENTITIES.STATE}:${ACTIONS.DELETE}`:
            return await executeDeleteState(
                connection,
                payload.id,
                request.requested_by
            );

        case `${ENTITIES.DISTRICT}:${ACTIONS.CREATE}`:
            return await executeCreateDistrict(
                connection,
                payload,
                request.requested_by
            );

        case `${ENTITIES.DISTRICT}:${ACTIONS.UPDATE}`:
            return await executeUpdateDistrict(
                connection,
                payload,
                request.requested_by
            );

        case `${ENTITIES.DISTRICT}:${ACTIONS.DELETE}`:
            return await executeDeleteDistrict(
                connection,
                payload.id,
                request.requested_by
            );

        case `${ENTITIES.BLOCK}:${ACTIONS.CREATE}`:
            return await executeCreateBlock(
                connection,
                payload,
                request.requested_by
            );

        case `${ENTITIES.BLOCK}:${ACTIONS.UPDATE}`:
            return await executeUpdateBlock(
                connection,
                payload,
                request.requested_by
            );

        case `${ENTITIES.BLOCK}:${ACTIONS.DELETE}`:
            return await executeDeleteBlock(
                connection,
                payload.id,
                request.requested_by
            );

        default:
            throw new Error("Unsupported resource.");
    }
};