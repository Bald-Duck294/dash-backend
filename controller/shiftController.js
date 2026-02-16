import { serializeBigInt } from "../utils/serializer.js";
import prisma from "../config/prismaClient.mjs";

// ✅ Helper function to convert HH:MM string to DateTime
const convertTimeStringToDateTime = (timeStr) => {
    const [hours, minutes] = timeStr.split(":").map(Number);
    const date = new Date();
    date.setUTCHours(hours, minutes, 0, 0);
    return date;
};

// ✅ Helper function to convert DateTime to HH:MM string
const formatTimeFromDatabase = (dateTime) => {
    if (!dateTime) return null;
    const date = new Date(dateTime);
    const hours = String(date.getUTCHours()).padStart(2, "0");
    const minutes = String(date.getUTCMinutes()).padStart(2, "0");
    return `${hours}:${minutes}`;
};

// ✅ Helper function to format single shift
const formatShiftTimes = (shift) => {
    return {
        ...shift,
        startTime: formatTimeFromDatabase(shift.startTime),
        endTime: formatTimeFromDatabase(shift.endTime),
    };
};

// ✅ Helper function to format multiple shifts
const formatShiftArrayTimes = (shifts) => {
    return shifts.map(shift => formatShiftTimes(shift));
};

export const getAllShifts = async (req, res) => {
    try {
        const { company_id, include_unavailable } = req.query;

        console.log("Fetching shifts:", { company_id, include_unavailable });

        const whereClause = {
            deleted_at: null,
        };

        if (company_id) {
            whereClause.company_id = BigInt(company_id);
        }

        if (include_unavailable !== "true") {
            whereClause.status = true;
        }

        const shifts = await prisma.shifts.findMany({
            where: whereClause,
            include: {
                company: {
                    select: {
                        id: true,
                        name: true,
                    },
                },
                assignments: {
                    select: {
                        id: true,
                        user_id: true,
                    },
                },
            },
            orderBy: {
                createdAt: "desc",
            },
        });

        // ✅ Convert times to HH:MM format
        const formattedShifts = formatShiftArrayTimes(shifts);

        res.status(200).json({
            status: "success",
            message: "Shifts retrieved successfully",
            data: serializeBigInt(formattedShifts),
            count: formattedShifts.length,
        });
    } catch (error) {
        console.error("Error fetching shifts:", error);
        res.status(500).json({
            status: "error",
            message: "Failed to fetch shifts",
            error: process.env.NODE_ENV === "development" ? error.message : undefined,
        });
    }
};

export const getShiftById = async (req, res) => {
    try {
        const { id } = req.params;
        const { company_id, include_unavailable } = req.query;

        if (!id) {
            return res.status(400).json({
                status: "error",
                message: "Shift ID is required",
            });
        }

        const shift = await prisma.shifts.findUnique({
            where: {
                id: BigInt(id),
            },
            include: {
                company: {
                    select: {
                        id: true,
                        name: true,
                    },
                },
                assignments: {
                    include: {
                        user: {
                            select: {
                                id: true,
                                email: true,
                                name: true,
                                phone: true,
                                role_id: true,
                            },
                        },
                    },
                },
            },
        });

        if (!shift) {
            return res.status(404).json({
                status: "error",
                message: "Shift not found",
            });
        }

        if (include_unavailable !== "true" && !shift.status) {
            return res.status(404).json({
                status: "error",
                message: "Shift not found",
            });
        }

        if (company_id && shift.company_id !== BigInt(company_id)) {
            return res.status(403).json({
                status: "error",
                message: "Shift does not belong to this company",
            });
        }

        // ✅ Convert times to HH:MM format
        const formattedShift = formatShiftTimes(shift);

        res.status(200).json({
            status: "success",
            message: "Shift retrieved successfully",
            data: serializeBigInt(formattedShift),
        });
    } catch (error) {
        console.error("Error fetching shift:", error);
        res.status(500).json({
            status: "error",
            message: "Failed to fetch shift",
            error: process.env.NODE_ENV === "development" ? error.message : undefined,
        });
    }
};

export const createShift = async (req, res) => {
    try {
        const {
            name,
            description,
            startTime,  // Receives "09:00"
            endTime,    // Receives "17:00"
            effectiveFrom,
            effectiveUntil,
            company_id,
        } = req.body;

        console.log(req.body, "creating shift");

        // Validate required fields
        if (!name || !startTime || !endTime || !company_id) {
            return res.status(400).json({
                status: "error",
                message: "Missing required fields: name, startTime, endTime, company_id",
            });
        }

        // ✅ Validate time format (HH:MM)
        if (!isValidTimeFormat(startTime) || !isValidTimeFormat(endTime)) {
            return res.status(400).json({
                status: "error",
                message: "Invalid time format. Use HH:MM format",
            });
        }

        // Calculate duration hours
        const durationHours = calculateDuration(startTime, endTime);

        if (durationHours <= 0) {
            return res.status(400).json({
                status: "error",
                message: "End time must be after start time",
            });
        }

        // Validate effective dates
        if (effectiveUntil && effectiveFrom) {
            const from = new Date(effectiveFrom);
            const until = new Date(effectiveUntil);
            if (until < from) {
                return res.status(400).json({
                    status: "error",
                    message: "Effective until date must be after effective from date",
                });
            }
        }

        // ✅ Convert HH:MM to DateTime for @db.Time storage
        const shift = await prisma.shifts.create({
            data: {
                name,
                description,
                startTime: convertTimeStringToDateTime(startTime),  // ✅ Convert to DateTime
                endTime: convertTimeStringToDateTime(endTime),      // ✅ Convert to DateTime
                durationHours,
                effectiveFrom: effectiveFrom ? new Date(effectiveFrom) : new Date(),
                effectiveUntil: effectiveUntil ? new Date(effectiveUntil) : null,
                company_id: BigInt(company_id),
                status: true,
            },
            include: {
                company: {
                    select: {
                        id: true,
                        name: true,
                    },
                },
            },
        });

        // ✅ Convert back to HH:MM for response
        const formattedShift = formatShiftTimes(shift);

        res.status(201).json({
            status: "success",
            message: "Shift created successfully",
            data: serializeBigInt(formattedShift),
        });
    } catch (error) {
        console.error("Error creating shift:", error);
        res.status(500).json({
            status: "error",
            message: "Failed to create shift",
            error: process.env.NODE_ENV === "development" ? error.message : undefined,
        });
    }
};

export const updateShift = async (req, res) => {
    try {
        const { id } = req.params;
        const updateData = req.body;

        console.log(updateData, "update data");

        // Check if shift exists
        const existing = await prisma.shifts.findUnique({
            where: {
                id: BigInt(id),
                deleted_at: null,
            },
        });

        if (!existing) {
            return res.status(404).json({
                status: "error",
                message: "Shift not found",
            });
        }

        // Prepare update data
        const dataToUpdate = {
            ...(updateData.name !== undefined && { name: updateData.name }),
            ...(updateData.description !== undefined && {
                description: updateData.description,
            }),
            ...(updateData.status !== undefined && { status: updateData.status }),
            ...(updateData.effectiveFrom !== undefined && {
                effectiveFrom: new Date(updateData.effectiveFrom),
            }),
            ...(updateData.effectiveUntil !== undefined && {
                effectiveUntil: updateData.effectiveUntil
                    ? new Date(updateData.effectiveUntil)
                    : null,
            }),
        };

        // Handle time updates and recalculate duration
        if (updateData.startTime || updateData.endTime) {
            // ✅ Get existing times in HH:MM format
            const newStartTime = updateData.startTime || formatTimeFromDatabase(existing.startTime);
            const newEndTime = updateData.endTime || formatTimeFromDatabase(existing.endTime);

            // ✅ Validate time format
            if (!isValidTimeFormat(newStartTime) || !isValidTimeFormat(newEndTime)) {
                return res.status(400).json({
                    status: "error",
                    message: "Invalid time format. Use HH:MM format",
                });
            }

            const durationHours = calculateDuration(newStartTime, newEndTime);

            if (durationHours <= 0) {
                return res.status(400).json({
                    status: "error",
                    message: "End time must be after start time",
                });
            }

            // ✅ Convert to DateTime for storage
            dataToUpdate.startTime = convertTimeStringToDateTime(newStartTime);
            dataToUpdate.endTime = convertTimeStringToDateTime(newEndTime);
            dataToUpdate.durationHours = durationHours;
        }

        // Update shift
        const updatedShift = await prisma.shifts.update({
            where: {
                id: BigInt(id),
            },
            data: dataToUpdate,
            include: {
                company: {
                    select: {
                        id: true,
                        name: true,
                    },
                },
            },
        });

        // ✅ Convert back to HH:MM for response
        const formattedShift = formatShiftTimes(updatedShift);

        res.status(200).json({
            status: "success",
            message: "Shift updated successfully",
            data: serializeBigInt(formattedShift),
        });
    } catch (error) {
        console.error("Error updating shift:", error);
        res.status(500).json({
            status: "error",
            message: "Failed to update shift",
            error: process.env.NODE_ENV === "development" ? error.message : undefined,
        });
    }
};

// export const deleteShift = async (req, res) => {
//     try {
//         const { id } = req.params;

//         const existing = await prisma.shifts.findUnique({
//             where: {
//                 id: BigInt(id),
//                 deleted_at: null,
//             },
//             include: {
//                 assignments: true,
//             },
//         });

//         if (!existing) {
//             return res.status(404).json({
//                 status: "error",
//                 message: "Shift not found",
//             });
//         }

//         if (existing.assignments.length > 0) {
//             return res.status(400).json({
//                 status: "error",
//                 message: `Cannot delete shift. It has ${existing.assignments.length} assignment(s).`,
//                 assignments_count: existing.assignments.length,
//             });
//         }

//         const deletedShift = await prisma.shifts.update({
//             where: {
//                 id: BigInt(id),
//             },
//             data: {
//                 deleted_at: new Date(),
//                 status: false,
//             },
//         });

//         // ✅ Convert times to HH:MM format
//         const formattedShift = formatShiftTimes(deletedShift);

//         res.status(200).json({
//             status: "success",
//             message: "Shift deleted successfully",
//             data: serializeBigInt(formattedShift),
//         });
//     } catch (error) {
//         console.error("Error deleting shift:", error);
//         res.status(500).json({
//             status: "error",
//             message: "Failed to delete shift",
//             error: process.env.NODE_ENV === "development" ? error.message : undefined,
//         });
//     }
// };


export const deleteShift = async (req, res) => {
    try {
        const { id } = req.params;
        const shiftId = BigInt(id);

        const existing = await prisma.shifts.findUnique({
            where: {
                id: shiftId,
                deleted_at: null,
            },
        });

        if (!existing) {
            return res.status(404).json({
                status: "error",
                message: "Shift not found",
            });
        }

        // 1️⃣ Soft delete all related assignments
        await prisma.shift_assignments.updateMany({
            where: {
                shiftId: shiftId,
                deleted_at: null,
            },
            data: {
                deleted_at: new Date(),
                status: "inactive",
            },
        });

        // 2️⃣ Soft delete the shift
        const deletedShift = await prisma.shifts.update({
            where: { id: shiftId },
            data: {
                deleted_at: new Date(),
                status: false,
            },
        });

        const formattedShift = formatShiftTimes(deletedShift);

        res.status(200).json({
            status: "success",
            message: "Shift and related assignments deleted successfully",
            data: serializeBigInt(formattedShift),
        });

    } catch (error) {
        console.error("Error deleting shift:", error);
        res.status(500).json({
            status: "error",
            message: "Failed to delete shift",
            error: process.env.NODE_ENV === "development"
                ? error.message
                : undefined,
        });
    }
};

export const toggleShiftStatus = async (req, res) => {
    try {
        const { id } = req.params;

        const shift = await prisma.shifts.findUnique({
            where: { id: BigInt(id) }
        });

        if (!shift) {
            return res.status(404).json({
                success: false,
                message: "Shift not found",
            });
        }

        const updatedShift = await prisma.shifts.update({
            where: { id: BigInt(id) },
            data: { status: !shift.status }
        });

        // ✅ Convert times to HH:MM format
        const formattedShift = formatShiftTimes(updatedShift);
        const serializedShift = serializeBigInt(formattedShift);

        return res.status(200).json({
            success: true,
            message: `Shift ${updatedShift.status ? 'activated' : 'deactivated'} successfully`,
            data: serializedShift,
        });
    } catch (error) {
        console.error("Error toggling shift status:", error);
        return res.status(500).json({
            success: false,
            message: "Failed to toggle shift status",
            error: error.message,
        });
    }
};

// ✅ Helper function to validate time format
const isValidTimeFormat = (timeStr) => {
    const timeRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;
    return timeRegex.test(timeStr);
};

// Duration calculation
const calculateDuration = (startTime, endTime) => {
    const parseTime = (timeStr) => {
        const parts = timeStr.split(":");
        const hours = parseInt(parts[0], 10);
        const minutes = parseInt(parts[1], 10);
        return hours * 3600 + minutes * 60;
    };

    let startSeconds = parseTime(startTime);
    let endSeconds = parseTime(endTime);

    if (endSeconds <= startSeconds) {
        endSeconds += 24 * 3600;
    }

    const durationSeconds = endSeconds - startSeconds;
    const durationHours = durationSeconds / 3600;

    return parseFloat(durationHours.toFixed(2));
};
