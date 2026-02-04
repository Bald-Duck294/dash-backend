
export const parsePaginationParams = (query, options = {}) => {
  const {
    defaultPage = 1,
    defaultLimit = 10,
    maxLimit = 100,
  } = options;

  const page = Math.max(1, parseInt(query.page) || defaultPage);
  const limit = Math.min(
    Math.max(1, parseInt(query.limit) || defaultLimit),
    maxLimit
  );
  const skip = (page - 1) * limit;

  return {
    page,
    limit,
    skip,
  };
};

/**
 * Calculate pagination metadata
 * @param {number} totalCount - Total records count
 * @param {number} page - Current page
 * @param {number} limit - Items per page
 * @returns {Object} Pagination metadata
 */
export const calculatePaginationMeta = (totalCount, page, limit) => {
  const totalPages = Math.ceil(totalCount / limit);
  const hasNextPage = page < totalPages;
  const hasPrevPage = page > 1;

  return {
    currentPage: page,
    totalPages,
    totalCount,
    limit,
    hasNextPage,
    hasPrevPage,
    nextPage: hasNextPage ? page + 1 : null,
    prevPage: hasPrevPage ? page - 1 : null,
  };
};

/**
 * Prisma pagination helper - performs count and fetch in parallel
 * Optimized for performance with Promise.all
 * 
 * @param {Object} prismaModel - Prisma model (e.g., prisma.companies)
 * @param {Object} options - Query options
 * @returns {Object} Data and pagination metadata
 */
export const paginateWithPrisma = async (
  prismaModel,
  {
    where = {},
    include = {},
    orderBy = {},
    page = 1,
    limit = 10,
    select = undefined,
  }
) => {
  // Parse pagination params with defaults
  const { skip } = parsePaginationParams({ page, limit });

  // Parallel execution for better performance - both queries run simultaneously
  const [data, totalCount] = await Promise.all([
    prismaModel.findMany({
      where,
      include,
      orderBy,
      skip,
      take: limit,
      ...(select && { select }),
    }),
    prismaModel.count({ where }),
  ]);

  const meta = calculatePaginationMeta(totalCount, page, limit);

  return {
    data,
    meta,
  };
};
