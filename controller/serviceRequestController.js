import prisma from "../config/prismaClient.mjs";

// POST /api/service-requests
export const createServiceRequest = async (req, res) => {
  const { latitude, longitude, city, state, requestType } = req.body;

  // 1️⃣ Required fields
  if (!latitude || !longitude || !requestType) {
    return res.status(400).json({
      error: "latitude, longitude, and requestType are required",
    });
  }

  // 2️⃣ Allowed values
  const ALLOWED_REQUEST_TYPES = [
    "CITY_NOT_AVAILABLE",
    "NO_TOILET_WITHIN_RADIUS",
  ];

  if (!ALLOWED_REQUEST_TYPES.includes(requestType)) {
    return res.status(400).json({
      error: "Invalid requestType value",
    });
  }

  try {
    const data = await prisma.service_request.create({
      data: {
        latitude,
        longitude,
        city: city?.toLowerCase(),
        state: state?.toLowerCase(),
        request_type: requestType, // matches Prisma schema
      },
    });

    console.log(data, "data");
    return res.status(201).json({
      message: "Service request created",
      data: {
        ...data,
        id: data?.id?.toString(),
      },
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({
      error: "Failed to create service request",
    });
  }
};

// GET /api/service-requests
export const getServiceRequests = async (req, res) => {
  const { city, requestType } = req.query;

  const where = {};

  if (city) where.city = city.toLowerCase();
  if (requestType) where.request_type = requestType;

  try {
    const data = await prisma.service_request.findMany({
      where,
      orderBy: { created_at: "desc" },
    });

    console.log(data, "data");
    return res.json({
      count: data?.length,
      data: data?.map((item) => ({
        ...item,
        id: item?.id?.toString(),
      })),
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({
      error: "Failed to fetch service requests",
    });
  }
};
