import express from "express";

import {
    createShiftAssignments,
    getShiftAssignmentsByShiftId,
    getShiftAssignableUsers,
    updateShiftAssignment,
    deleteShiftAssignment,
    getAllShiftAssignments,
    toggleShiftAssignmentStatus,
} from "../controller/shiftAssignController.js";

const shiftAssign_router = express.Router();

shiftAssign_router.get("/", getAllShiftAssignments);

shiftAssign_router.get("/by-shift/:shiftId", getShiftAssignmentsByShiftId);

shiftAssign_router.get("/assignable-users", getShiftAssignableUsers);

shiftAssign_router.post("/", createShiftAssignments);

shiftAssign_router.put("/:id", updateShiftAssignment);

shiftAssign_router.patch("/:id/toggle-status", toggleShiftAssignmentStatus);

shiftAssign_router.delete("/:id", deleteShiftAssignment);

export default shiftAssign_router;