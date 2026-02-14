import prisma from "../config/prismaClient.mjs";
import { serializeBigInt } from "../utils/serializer.js";

const formatTimeFromDatabase = (dateTime) => {
    if (!dateTime) return null;
    const date = new Date(dateTime);
    const hours = String(date.getUTCHours()).padStart(2, "0");
    const minutes = String(date.getUTCMinutes()).padStart(2, "0");
    return `${hours}:${minutes}`;
};

export const createShiftAssignments = async (req, res) => {
    try {
        const {
            shiftId,
            user_ids,
            company_id,
            startDate,
            endDate,
            role_id,
            notes,
        } = req.body;

        // ---- Validation ----
        if (
            !shiftId ||
            !company_id ||
            !startDate ||
            !role_id ||
            !Array.isArray(user_ids) ||
            user_ids.length === 0
        ) {
            return res.status(400).json({
                status: "error",
                message:
                    "Missing required fields: shiftId, company_id, startDate, role_id, and non-empty user_ids array.",
            });
        }

        const parsedStart = new Date(startDate);
        const parsedEnd = endDate ? new Date(endDate) : null;

        if (parsedEnd && parsedEnd < parsedStart) {
            return res.status(400).json({
                status: "error",
                message: "endDate cannot be before startDate.",
            });
        }

        // ---- Check Shift Exists ----
        const shift = await prisma.shifts.findFirst({
            where: {
                id: BigInt(shiftId),
                company_id: BigInt(company_id),
                deleted_at: null,
            },
        });

        if (!shift) {
            return res.status(404).json({
                status: "error",
                message: "Shift not found for this company.",
            });
        }

        const userBigInts = user_ids.map((id) => BigInt(id));

        // ---- 1️⃣ Prevent Duplicate Same Shift Assignment ----
        const existingSameShift = await prisma.shift_assignments.findMany({
            where: {
                shiftId: BigInt(shiftId),
                user_id: { in: userBigInts },
                status: "active",
                deleted_at: null,
            },
            select: { user_id: true },
        });

        const duplicateUserIds = existingSameShift.map((a) => a.user_id.toString());

        // ---- 2️⃣ Prevent Overlapping Active Shifts ----
        const overlappingAssignments = await prisma.shift_assignments.findMany({
            where: {
                user_id: { in: userBigInts },
                status: "active",
                deleted_at: null,
                OR: [
                    {
                        AND: [
                            { startDate: { lte: parsedEnd || new Date("9999-12-31") } },
                            { endDate: { gte: parsedStart } },
                        ],
                    },
                    {
                        AND: [{ startDate: { lte: parsedStart } }, { endDate: null }],
                    },
                ],
            },
            select: { user_id: true },
        });

        const overlappingUserIds = overlappingAssignments.map((a) =>
            a.user_id.toString(),
        );

        // ---- Combine conflicts ----
        const blockedUserIds = new Set([
            ...duplicateUserIds,
            ...overlappingUserIds,
        ]);

        const usersToAssign = user_ids.filter(
            (id) => !blockedUserIds.has(id.toString()),
        );

        if (usersToAssign.length === 0) {
            return res.status(400).json({
                status: "error",
                message:
                    "All selected users either already have this shift or have overlapping active shifts.",
                duplicates: duplicateUserIds,
                overlapping: overlappingUserIds,
            });
        }

        // ---- Prepare Data ----
        const assignmentsToCreate = usersToAssign.map((userId) => ({
            shiftId: BigInt(shiftId),
            user_id: BigInt(userId),
            startDate: parsedStart,
            endDate: parsedEnd,
            role_id,
            notes: notes || null,
            status: "active",
        }));

        const result = await prisma.shift_assignments.createMany({
            data: assignmentsToCreate,
        });

        const skippedCount = user_ids.length - usersToAssign.length;

        let message = `${result.count} shift assignment(s) created successfully.`;
        if (skippedCount > 0) {
            message += ` ${skippedCount} user(s) skipped due to conflict.`;
        }

        return res.status(201).json({
            status: "success",
            message,
            data: {
                created: result.count,
                skipped: skippedCount,
                duplicateUserIds,
                overlappingUserIds,
            },
        });
    } catch (error) {
        console.error("Error creating shift assignments:", error);
        return res.status(500).json({
            status: "error",
            message: "Internal Server Error",
        });
    }
};

export const getAllShiftAssignments = async (req, res) => {
    try {
        const { company_id } = req.query;

        if (!company_id) {
            return res.status(400).json({
                status: "error",
                message: "company_id is required",
            });
        }

        const assignments = await prisma.shift_assignments.findMany({
            where: {
                shift: {
                    company_id: BigInt(company_id),
                },
                deleted_at: null,
            },
            include: {
                user: {
                    select: {
                        id: true,
                        name: true,
                        email: true,
                        role: {
                            select: { id: true, name: true },
                        },
                    },
                },
                shift: {
                    select: {
                        id: true,
                        name: true,
                        startTime: true,
                        endTime: true,
                    },
                },
                role: true,
            },
            orderBy: {
                createdAt: "desc",
            },
        });

        // 👇 THIS MUST BE HERE (inside function)
        const formattedAssignments = assignments.map((assignment) => ({
            ...assignment,
            shift: assignment.shift
                ? {
                    ...assignment.shift,
                    startTime: formatTimeFromDatabase(assignment.shift.startTime),
                    endTime: formatTimeFromDatabase(assignment.shift.endTime),
                }
                : null,
        }));

        return res.status(200).json({
            status: "success",
            count: formattedAssignments.length,
            data: serializeBigInt(formattedAssignments),
        });
    } catch (error) {
        console.error("Error fetching all shift assignments:", error);
        return res.status(500).json({
            status: "error",
            message: "Internal Server Error",
        });
    }
};

export const getShiftAssignmentsByShiftId = async (req, res) => {
    try {
        const { shiftId } = req.params;

        if (!shiftId) {
            return res.status(400).json({
                status: "error",
                message: "Shift ID is required",
            });
        }

        const assignments = await prisma.shift_assignments.findMany({
            where: {
                shiftId: BigInt(shiftId),
                deleted_at: null,
            },
            include: {
                user: {
                    select: {
                        id: true,
                        name: true,
                        email: true,
                        role: {
                            select: { id: true, name: true },
                        },
                    },
                },
                shift: {
                    select: {
                        id: true,
                        name: true,
                        startTime: true,
                        endTime: true,
                    },
                },

                role: true,
            },
            orderBy: { startDate: "desc" },
        });

        return res.status(200).json({
            status: "success",
            data: serializeBigInt(assignments),
        });
    } catch (error) {
        console.error("Error fetching shift assignments:", error);
        return res.status(500).json({
            status: "error",
            message: "Internal Server Error",
        });
    }
};

export const getShiftAssignableUsers = async (req, res) => {
    try {
        const { company_id } = req.query;

        if (!company_id) {
            return res.status(400).json({
                status: "error",
                message: "company_id is required",
            });
        }

        // 🔒 Define allowed roles explicitly
        // Replace 2 & 3 with your actual role IDs
        const CLEANER_ROLE_ID = 5;
        const SUPERVISOR_ROLE_ID = 3;

        const users = await prisma.users.findMany({
            where: {
                company_id: BigInt(company_id),
                role_id: {
                    in: [CLEANER_ROLE_ID, SUPERVISOR_ROLE_ID],
                },
                deleted_at: null,
            },
            select: {
                id: true,
                name: true,
                email: true,
                phone: true,
                role: {
                    select: {
                        id: true,
                        name: true,
                    },
                },
            },
            orderBy: {
                name: "asc",
            },
        });

        const serialized = users.map((user) => ({
            ...user,
            id: user.id.toString(),
        }));

        return res.status(200).json({
            status: "success",
            data: serialized,
        });
    } catch (error) {
        console.error("Error fetching shift assignable users:", error);
        return res.status(500).json({
            status: "error",
            message: "Internal Server Error",
        });
    }
};

export const updateShiftAssignment = async (req, res) => {
    try {
        const { id } = req.params;
        const { startDate, endDate, status, notes, role_id } = req.body;

        if (!id || isNaN(id)) {
            return res.status(400).json({
                status: "error",
                message: "Invalid shift assignment ID.",
            });
        }

        const assignment = await prisma.shift_assignments.findFirst({
            where: {
                id: BigInt(id),
                deleted_at: null,
            },
        });

        if (!assignment) {
            return res.status(404).json({
                status: "error",
                message: "Shift assignment not found.",
            });
        }

        const parsedStart = startDate ? new Date(startDate) : assignment.startDate;
        const parsedEnd = endDate ? new Date(endDate) : assignment.endDate;

        if (parsedEnd && parsedEnd < parsedStart) {
            return res.status(400).json({
                status: "error",
                message: "endDate cannot be before startDate.",
            });
        }

        // 🔥 Overlap Check (excluding current record)
        const overlapping = await prisma.shift_assignments.findFirst({
            where: {
                id: { not: BigInt(id) },
                user_id: assignment.user_id,
                status: "active",
                deleted_at: null,
                OR: [
                    {
                        AND: [
                            { startDate: { lte: parsedEnd || new Date("9999-12-31") } },
                            { endDate: { gte: parsedStart } },
                        ],
                    },
                    {
                        AND: [{ startDate: { lte: parsedStart } }, { endDate: null }],
                    },
                ],
            },
        });

        if (overlapping) {
            return res.status(400).json({
                status: "error",
                message: "User already has an overlapping active shift.",
            });
        }

        const updated = await prisma.shift_assignments.update({
            where: { id: BigInt(id) },
            data: {
                startDate: parsedStart,
                endDate: parsedEnd,
                status: status ?? assignment.status,
                notes: notes ?? assignment.notes,
                role_id: role_id ?? assignment.role_id,
            },
        });

        return res.status(200).json({
            status: "success",
            message: "Shift assignment updated successfully.",
            data: {
                ...updated,
                id: updated.id.toString(),
                shiftId: updated.shiftId.toString(),
                user_id: updated.user_id.toString(),
            },
        });
    } catch (error) {
        console.error("Error updating shift assignment:", error);
        return res.status(500).json({
            status: "error",
            message: "Internal Server Error",
        });
    }
};

export const toggleShiftAssignmentStatus = async (req, res) => {
    try {
        const { id } = req.params;

        if (!id || isNaN(id)) {
            return res.status(400).json({
                status: "error",
                message: "Invalid shift assignment ID.",
            });
        }

        const assignment = await prisma.shift_assignments.findFirst({
            where: {
                id: BigInt(id),
                deleted_at: null,
            },
        });

        if (!assignment) {
            return res.status(404).json({
                status: "error",
                message: "Shift assignment not found.",
            });
        }

        const newStatus = assignment.status === "active" ? "inactive" : "active";

        const updated = await prisma.shift_assignments.update({
            where: { id: BigInt(id) },
            data: {
                status: newStatus,
            },
        });

        return res.status(200).json({
            status: "success",
            message: "Shift assignment status updated successfully.",
            data: {
                ...updated,
                id: updated.id.toString(),
                shiftId: updated.shiftId.toString(),
                user_id: updated.user_id.toString(),
            },
        });
    } catch (error) {
        console.error("Error toggling shift assignment:", error);
        return res.status(500).json({
            status: "error",
            message: "Internal Server Error",
        });
    }
};

export const deleteShiftAssignment = async (req, res) => {
    try {
        const { id } = req.params;

        if (!id || isNaN(id)) {
            return res.status(400).json({
                status: "error",
                message: "Invalid shift assignment ID.",
            });
        }

        const assignment = await prisma.shift_assignments.findFirst({
            where: {
                id: BigInt(id),
                deleted_at: null,
            },
        });

        if (!assignment) {
            return res.status(404).json({
                status: "error",
                message: "Shift assignment not found.",
            });
        }

        await prisma.shift_assignments.update({
            where: { id: BigInt(id) },
            data: {
                deleted_at: new Date(),
                status: "inactive",
            },
        });

        return res.status(200).json({
            status: "success",
            message: "Shift assignment deleted successfully.",
        });
    } catch (error) {
        console.error("Error deleting shift assignment:", error);
        return res.status(500).json({
            status: "error",
            message: "Internal Server Error",
        });
    }
};